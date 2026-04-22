'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import NoteEditor from './NoteEditor'
import type { Note } from '@/services/notes.service'

interface QuickNoteModalProps {
  noteDate: string
  onClose: () => void
  onSaved: (note: Note) => void
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
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

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
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleClose])

  const handleSave = useCallback(async () => {
    if (!content.trim()) { setError('Добавьте текст заметки'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:   content.trim(),
          title:     title.trim() || null,
          note_date: noteDate,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.note) throw new Error(json.error ?? 'Не удалось сохранить')
      onSaved(json.note)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }, [content, title, noteDate, onSaved, handleClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  if (!mounted) return null

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        className={`relative w-full max-w-[540px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden transition-all duration-200 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-br from-amber-50/70 via-card to-card">
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

        <div className="px-5 py-4 space-y-3">
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
            minRows={6}
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-background/40">
          <span className="text-[11px] text-muted-foreground hidden sm:block">⌘↵ — сохранить · Esc — закрыть</span>
          <div className="flex items-center gap-2 ml-auto">
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
              disabled={saving || !content.trim()}
              className={[
                'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                saving || !content.trim()
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
      </div>
    </div>,
    document.body
  )
}
