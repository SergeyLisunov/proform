'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import NoteEditor from './NoteEditor'
import { createClient } from '@/lib/supabase/client'
import type { Note, NoteAttachment } from '@/services/notes.service'

interface QuickNoteModalProps {
  noteDate: string
  onClose: () => void
  onSaved: (note: Note) => void
}

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
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_DOC_SIZE   = 20 * 1024 * 1024
const MAX_FILES = 5

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function QuickNoteModal({ noteDate, onClose, onSaved }: QuickNoteModalProps) {
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [files,   setFiles]   = useState<PendingFile[]>([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 260)
  }, [onClose])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleClose])

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
    const paired: { file: File; tempId: string }[] = []

    for (const file of picked) {
      const attachType = ALLOWED_TYPES[file.type]
      if (!attachType) { setError(`Формат не поддерживается: ${file.name}`); continue }
      const maxSize = attachType === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE
      if (file.size > maxSize) {
        setError(`Файл слишком большой: ${file.name} (макс. ${attachType === 'image' ? '10' : '20'} МБ)`)
        continue
      }
      const tempId = `${Date.now()}-${Math.random()}`
      newFiles.push({
        tempId,
        name: file.name, size: file.size,
        mimeType: file.type, attachType,
        localUrl: URL.createObjectURL(file),
        uploading: true,
      })
      paired.push({ file, tempId })
    }

    setFiles(prev => [...prev, ...newFiles])
    await Promise.all(paired.map(p => uploadFile(p.file, p.tempId)))
  }, [files.length, uploadFile])

  const removeFile = useCallback((tempId: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.tempId === tempId)
      if (f) URL.revokeObjectURL(f.localUrl)
      return prev.filter(x => x.tempId !== tempId)
    })
  }, [])

  const handleSave = useCallback(async () => {
    const hasText  = content.trim().length > 0
    const hasFiles = files.length > 0
    if (!hasText && !hasFiles) { setError('Добавьте текст или файл'); return }
    if (files.some(f => f.uploading)) { setError('Дождитесь загрузки всех файлов'); return }
    setSaving(true); setError(null)
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
          content:   content.trim(),
          title:     title.trim() || null,
          note_date: noteDate,
          attachments: attachments.length ? attachments : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.note) throw new Error(json.error ?? 'Не удалось сохранить')
      files.forEach(f => URL.revokeObjectURL(f.localUrl))
      onSaved(json.note)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }, [content, title, files, noteDate, onSaved, handleClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  const canSave = (content.trim().length > 0 || files.length > 0) && !files.some(f => f.uploading) && !saving

  if (!mounted) return null

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[9999] flex justify-end"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-[250ms] ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Drawer panel */}
      <div
        className={`relative w-full max-w-[440px] h-full bg-card border-l border-border shadow-[-8px_0_40px_rgba(0,0,0,0.18)] flex flex-col transition-transform duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-br from-amber-50/60 via-card to-card shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <i className="ki-filled ki-notepad-edit text-base" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Новая заметка</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground capitalize truncate">{prettyDate(noteDate)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название (необязательно)"
            autoFocus
            maxLength={255}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-colors"
          />
          <NoteEditor
            value={content}
            onChange={setContent}
            placeholder="Напишите заметку… (математические выражения вычисляются автоматически)"
            minRows={8}
          />

          {/* Attachments preview */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map(f => (
                <div key={f.tempId} className="relative group">
                  {f.attachType === 'image' ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.localUrl} alt={f.name} className="w-full h-full object-cover" />
                      {f.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {f.error && (
                        <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                          <i className="ki-filled ki-information-4 text-white text-xs" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 max-w-[160px]">
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
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <i className="ki-filled ki-cross text-[9px]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-background/40 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setError(null); fileInputRef.current?.click() }}
              disabled={files.length >= MAX_FILES}
              title="Прикрепить файл"
              aria-label="Прикрепить файл"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background
                         text-muted-foreground hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600
                         transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ki-filled ki-paper-clip text-[14px]" />
            </button>
            <span className="text-[11px] text-muted-foreground hidden sm:block">⌘↵ сохранить</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={[
                'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                !canSave
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600',
              ].join(' ')}
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Сохранение…
                </>
              ) : (
                <>
                  <i className="ki-filled ki-check text-xs" />
                  Сохранить
                </>
              )}
            </button>
          </div>
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
    </div>,
    document.body
  )
}
