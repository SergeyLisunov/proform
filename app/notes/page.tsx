'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import NoteEditor from '@/components/ui/NoteEditor'
import type { Note } from '@/services/notes.service'

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
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  const openNote = (note: Note) => {
    setSelectedId(note.id)
    setEditContent(note.content)
    setEditTitle(note.title ?? '')
    setEditDate(note.note_date)
    setIsNew(false)
    setDeleteConfirm(false)
  }

  const startNew = () => {
    setSelectedId(null)
    setEditContent('')
    setEditTitle('')
    setEditDate(todayISO())
    setIsNew(true)
    setDeleteConfirm(false)
  }

  const handleSave = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent.trim(),
            title: editTitle.trim() || null,
            note_date: editDate,
          }),
        })
        const json = await res.json()
        if (json.note) {
          setNotes(prev => [json.note, ...prev])
          setSelectedId(json.note.id)
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
          }),
        })
        const json = await res.json()
        if (json.note) {
          setNotes(prev => prev.map(n => n.id === selectedId ? json.note : n))
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
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />}
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
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
                <div className="flex items-center gap-3">
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
                  <span className="text-xs text-muted-foreground">⌘S для сохранения</span>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editContent.trim()}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                      saving || !editContent.trim()
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
