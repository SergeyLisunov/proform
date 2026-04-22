'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import NoteEditor from '@/components/ui/NoteEditor'
import { createClient } from '@/lib/supabase/client'
import type { Note, NoteAttachment } from '@/services/notes.service'

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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NotesPage() {
  const { user, loading: userLoading } = useUser()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState(todayISO())
  const [editAttachments, setEditAttachments] = useState<NoteAttachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadNotes = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const url = q
        ? `/api/notes?search=${encodeURIComponent(q)}&limit=100`
        : '/api/notes?limit=100'
      const res = await fetch(url)
      const json = await res.json()
      setNotes(json.notes ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userLoading && user) loadNotes()
  }, [user, userLoading, loadNotes])

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(val)
      loadNotes(val || undefined)
    }, 400)
  }

  const resetPending = useCallback(() => {
    pendingFiles.forEach(f => URL.revokeObjectURL(f.localUrl))
    setPendingFiles([])
    setAttachError(null)
  }, [pendingFiles])

  const openNote = (note: Note) => {
    resetPending()
    setSelectedId(note.id)
    setEditContent(note.content)
    setEditTitle(note.title ?? '')
    setEditDate(note.note_date)
    setEditAttachments(note.attachments ?? [])
    setIsNew(false)
    setDeleteConfirm(false)
  }

  const startNew = () => {
    resetPending()
    setSelectedId(null)
    setEditContent('')
    setEditTitle('')
    setEditDate(todayISO())
    setEditAttachments([])
    setIsNew(true)
    setDeleteConfirm(false)
  }

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
      setPendingFiles(prev => prev.map(f => f.tempId === tempId ? { ...f, storageUrl: publicUrl, uploading: false } : f))
    } catch (err) {
      setPendingFiles(prev => prev.map(f => f.tempId === tempId
        ? { ...f, uploading: false, error: err instanceof Error ? err.message : 'Ошибка загрузки' }
        : f
      ))
    }
  }, [])

  const totalAttachments = editAttachments.length + pendingFiles.length

  const handleFilePick = useCallback(async (fileList: FileList) => {
    const remaining = MAX_FILES - totalAttachments
    if (remaining <= 0) { setAttachError(`Максимум ${MAX_FILES} файлов`); return }
    setAttachError(null)
    const picked = Array.from(fileList).slice(0, remaining)
    const newFiles: PendingFile[] = []
    const paired: { file: File; tempId: string }[] = []

    for (const file of picked) {
      const attachType = ALLOWED_TYPES[file.type]
      if (!attachType) { setAttachError(`Формат не поддерживается: ${file.name}`); continue }
      const maxSize = attachType === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE
      if (file.size > maxSize) {
        setAttachError(`Файл слишком большой: ${file.name} (макс. ${attachType === 'image' ? '10' : '20'} МБ)`)
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

    setPendingFiles(prev => [...prev, ...newFiles])
    await Promise.all(paired.map(p => uploadFile(p.file, p.tempId)))
  }, [totalAttachments, uploadFile])

  const removePending = (tempId: string) => {
    setPendingFiles(prev => {
      const f = prev.find(x => x.tempId === tempId)
      if (f) URL.revokeObjectURL(f.localUrl)
      return prev.filter(x => x.tempId !== tempId)
    })
  }

  const removeExisting = (idx: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!editContent.trim()) return
    if (pendingFiles.some(f => f.uploading)) { setAttachError('Дождитесь загрузки всех файлов'); return }
    setSaving(true)
    try {
      const newAttachments: NoteAttachment[] = pendingFiles
        .filter(f => !f.error && f.storageUrl)
        .map(f => ({
          name: f.name, url: f.storageUrl!,
          type: f.attachType, size: f.size, mimeType: f.mimeType,
        }))
      const allAttachments = [...editAttachments, ...newAttachments]

      if (isNew) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent.trim(),
            title: editTitle.trim() || null,
            note_date: editDate,
            attachments: allAttachments.length ? allAttachments : undefined,
          }),
        })
        const json = await res.json()
        if (json.note) {
          setNotes(prev => [json.note, ...prev])
          setSelectedId(json.note.id)
          setEditAttachments(json.note.attachments ?? [])
          pendingFiles.forEach(f => URL.revokeObjectURL(f.localUrl))
          setPendingFiles([])
          setIsNew(false)
        }
      } else if (selectedId) {
        const res = await fetch(`/api/notes/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent.trim(),
            title: editTitle.trim() || null,
            note_date: editDate,
            attachments: allAttachments,
          }),
        })
        const json = await res.json()
        if (json.note) {
          setNotes(prev => prev.map(n => n.id === selectedId ? json.note : n))
          setEditAttachments(json.note.attachments ?? [])
          pendingFiles.forEach(f => URL.revokeObjectURL(f.localUrl))
          setPendingFiles([])
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    await fetch(`/api/notes/${selectedId}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== selectedId))
    resetPending()
    setSelectedId(null)
    setIsNew(false)
    setDeleteConfirm(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  if (userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasEditor = isNew || selectedId !== null

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Заметки</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {notes.length} {notes.length === 1 ? 'заметка' : notes.length < 5 ? 'заметки' : 'заметок'}
          </p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <i className="ki-filled ki-plus text-sm" />
          Новая заметка
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: note list */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col bg-card overflow-hidden">
          {/* Search */}
          <div className="px-3 py-3 border-b border-border shrink-0">
            <div className="relative">
              <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Поиск заметок…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <i className="ki-filled ki-notepad-edit text-3xl text-muted-foreground/40 block mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Ничего не найдено' : 'Нет заметок'}
                </p>
              </div>
            ) : (
              notes.map(note => {
                const active = note.id === selectedId
                return (
                  <button
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={[
                      'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
                      active ? 'bg-orange-50' : 'hover:bg-accent',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium truncate flex-1 ${active ? 'text-orange-600' : 'text-foreground'}`}>
                        {note.title || note.content.slice(0, 40) || 'Без названия'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(note.attachments?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                            <i className="ki-filled ki-paper-clip text-[10px]" />
                            {note.attachments!.length}
                          </span>
                        )}
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {note.content.slice(0, 60)}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(note.note_date)}</p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {hasEditor ? (
            <>
              {/* Editor toolbar */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Заголовок (необязательно)"
                  className="flex-1 text-base font-semibold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
                />
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="text-xs text-muted-foreground border border-border rounded-md px-2 py-1 outline-none focus:border-orange-400"
                />
              </div>

              {/* Note content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <NoteEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Напишите заметку… (математические выражения вычисляются автоматически)"
                  minRows={12}
                />

                {/* Attachments (existing + pending) */}
                {(editAttachments.length > 0 || pendingFiles.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      Вложения · {editAttachments.length + pendingFiles.length}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {/* Existing attachments */}
                      {editAttachments.map((att, i) => (
                        <div key={`existing-${i}`} className="relative group">
                          {att.type === 'image' ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/30 hover:opacity-90 transition-opacity"
                              title={att.name}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                            </a>
                          ) : (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 max-w-[160px] hover:border-orange-300 hover:bg-orange-50 transition-colors no-underline"
                              title={att.name}
                            >
                              <i className="ki-filled ki-document text-muted-foreground text-sm shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[11px] text-foreground truncate">{att.name}</div>
                                <div className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</div>
                              </div>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeExisting(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground/85 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            aria-label="Удалить вложение"
                          >
                            <i className="ki-filled ki-cross text-[9px]" />
                          </button>
                        </div>
                      ))}

                      {/* Pending uploads */}
                      {pendingFiles.map(f => (
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
                                  <i className="ki-filled ki-warning text-white text-xs" />
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
                            onClick={() => removePending(f.tempId)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground/85 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            aria-label="Удалить файл"
                          >
                            <i className="ki-filled ki-cross text-[9px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {attachError && <p className="mt-2 text-[11px] text-red-500">{attachError}</p>}
                  </div>
                )}
                {attachError && editAttachments.length === 0 && pendingFiles.length === 0 && (
                  <p className="mt-2 text-[11px] text-red-500">{attachError}</p>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setAttachError(null); fileInputRef.current?.click() }}
                    disabled={totalAttachments >= MAX_FILES}
                    title="Прикрепить файл"
                    aria-label="Прикрепить файл"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background
                               text-muted-foreground hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500
                               transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ki-filled ki-paper-clip text-[14px]" />
                  </button>
                  {!isNew && (
                    deleteConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500">Удалить?</span>
                        <button onClick={handleDelete} className="text-xs text-red-600 font-medium hover:underline">Да</button>
                        <button onClick={() => setDeleteConfirm(false)} className="text-xs text-muted-foreground hover:underline">Нет</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1"
                      >
                        <i className="ki-filled ki-trash text-xs" />
                        Удалить
                      </button>
                    )
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground hidden sm:block">⌘S сохранить</span>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editContent.trim() || pendingFiles.some(f => f.uploading)}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                      saving || !editContent.trim() || pendingFiles.some(f => f.uploading)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white',
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
                <i className="ki-filled ki-notepad-edit text-3xl text-orange-400" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Выберите заметку</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Выберите заметку из списка или создайте новую
              </p>
              <button
                onClick={startNew}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <i className="ki-filled ki-plus text-sm" />
                Новая заметка
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
