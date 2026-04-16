'use client'

import { useState, useCallback, useRef } from 'react'
import NoteEditor from './NoteEditor'
import VoiceButton from './VoiceButton'
import { createClient } from '@/lib/supabase/client'
import type { NoteAttachment } from '@/services/notes.service'

type AttachType = 'image' | 'document'

interface PendingFile {
  tempId: string
  name: string
  size: number
  mimeType: string
  attachType: AttachType
  localUrl: string
  storageUrl?: string
  uploading: boolean
  error?: string
}

const ALLOWED_TYPES: Record<string, AttachType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
}
const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10 МБ
const MAX_DOC_SIZE   = 20 * 1024 * 1024  // 20 МБ
const MAX_FILES = 5

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

interface QuickNoteWidgetProps {
  userId: string
  onSaved?: () => void
}

export default function QuickNoteWidget({ userId, onSaved }: QuickNoteWidgetProps) {
  const [content, setContent]     = useState('')
  const [title, setTitle]         = useState('')
  const [files, setFiles]         = useState<PendingFile[]>([])
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = useCallback(async () => {
    const hasText  = content.trim().length > 0
    const hasFiles = files.length > 0
    if (!hasText && !hasFiles) return
    if (files.some(f => f.uploading)) { setError('Дождитесь загрузки всех файлов'); return }

    setSaving(true)
    setError(null)
    try {
      const attachments: NoteAttachment[] = files
        .filter(f => !f.error)
        .map(f => ({
          name: f.name, url: f.storageUrl ?? f.localUrl,
          type: f.attachType, size: f.size, mimeType: f.mimeType,
        }))

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          title:   title.trim() || null,
          attachments: attachments.length ? attachments : undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Ошибка сохранения')
      }
      files.forEach(f => URL.revokeObjectURL(f.localUrl))
      setContent(''); setTitle(''); setFiles([])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения заметки')
    } finally {
      setSaving(false)
    }
  }, [content, title, files, onSaved])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSave() }
  }, [handleSave])

  const handleTranscript = useCallback((text: string) => {
    setContent(prev => { const t = prev.trimEnd(); return t ? `${t}\n${text}` : text })
  }, [])

  const uploadFile = useCallback(async (file: File, tempId: string) => {
    try {
      const sb = createClient()
      const { data: { user: authUser } } = await sb.auth.getUser()
      if (!authUser) throw new Error('Не авторизован')
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `${authUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await sb.storage.from('note-attachments').upload(path, file, { upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = sb.storage.from('note-attachments').getPublicUrl(path)
      setFiles(prev => prev.map(f => f.tempId === tempId ? { ...f, storageUrl: publicUrl, uploading: false } : f))
    } catch (err) {
      setFiles(prev => prev.map(f => f.tempId === tempId
        ? { ...f, uploading: false, error: err instanceof Error ? err.message : 'Ошибка загрузки' }
        : f
      ))
    }
  }, [])

  const handleFilePick = useCallback(async (fileList: FileList) => {
    const remaining = MAX_FILES - files.length
    if (remaining <= 0) { setError(`Максимум ${MAX_FILES} файлов`); return }
    setError(null)
    const picked = Array.from(fileList).slice(0, remaining)
    const newFiles: PendingFile[] = []

    for (const file of picked) {
      const attachType = ALLOWED_TYPES[file.type]
      if (!attachType) { setError(`Формат не поддерживается: ${file.name}`); continue }
      const maxSize = attachType === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE
      if (file.size > maxSize) {
        setError(`Файл слишком большой: ${file.name} (макс. ${attachType === 'image' ? '10' : '20'} МБ)`)
        continue
      }
      newFiles.push({
        tempId: `${Date.now()}-${Math.random()}`,
        name: file.name, size: file.size,
        mimeType: file.type, attachType,
        localUrl: URL.createObjectURL(file),
        uploading: true,
      })
    }

    setFiles(prev => [...prev, ...newFiles])
    // upload each
    for (let i = 0; i < newFiles.length; i++) {
      await uploadFile(picked[i], newFiles[i].tempId)
    }
  }, [files.length, uploadFile])

  const removeFile = useCallback((tempId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.tempId === tempId)
      if (f) URL.revokeObjectURL(f.localUrl)
      return prev.filter(x => x.tempId !== tempId)
    })
  }, [])

  const canSave = (content.trim().length > 0 || files.length > 0) && !files.some(f => f.uploading) && !saving

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Быстрая заметка
        </h3>
        <a href="/notes" className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
          Все заметки →
        </a>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Название (необязательно)"
        className="w-full mb-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground
                   placeholder:text-muted-foreground/60 outline-none bg-background
                   focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
      />

      {/* Editor */}
      <div onKeyDown={handleKeyDown} className="flex-1">
        <NoteEditor
          value={content}
          onChange={setContent}
          placeholder="Напишите заметку… (⌘↵ для сохранения)"
          minRows={3}
          showVoice={false}
        />
      </div>

      {/* Attachments preview */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map(f => (
            <div key={f.tempId} className="relative group">
              {f.attachType === 'image' ? (
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.localUrl} alt={f.name} className="w-full h-full object-cover" />
                  {f.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {f.error && (
                    <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                      <i className="ki-filled ki-warning text-white text-xs" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 max-w-[130px]">
                  <i className="ki-filled ki-document text-muted-foreground text-sm shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-foreground truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtSize(f.size)}</div>
                  </div>
                  {f.uploading && (
                    <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(f.tempId)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-foreground/80 text-background rounded-full
                           flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <i className="ki-filled ki-cross text-[9px]" />
              </button>
            </div>
          ))}
          {files.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-lg border border-dashed border-border text-muted-foreground/60
                         hover:border-orange-300 hover:text-orange-400 transition-colors flex items-center justify-center"
            >
              <i className="ki-filled ki-plus text-lg" />
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

      {/* Footer actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setError(null); fileInputRef.current?.click() }}
            disabled={files.length >= MAX_FILES}
            title="Прикрепить файл"
            aria-label="Прикрепить файл"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background
                       text-muted-foreground hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ki-filled ki-paper-clip text-[14px]" />
          </button>
          <VoiceButton onTranscript={handleTranscript} size="sm" />
          {files.length === 0 && content.length === 0 && (
            <span className="text-[11px] text-muted-foreground/60 truncate hidden sm:block">
              Выражения вычисляются
            </span>
          )}
          {content.length > 0 && (
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {content.length} симв.
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={[
            'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all shrink-0',
            saved
              ? 'bg-green-500 text-white'
              : !canSave
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600',
          ].join(' ')}
        >
          {saved ? 'Сохранено!' : saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt"
        className="hidden"
        onChange={e => { if (e.target.files?.length) handleFilePick(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
