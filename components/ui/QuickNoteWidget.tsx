'use client'

import { useState, useCallback } from 'react'
import NoteEditor from './NoteEditor'

interface QuickNoteWidgetProps {
  userId: string
  onSaved?: () => void
}

export default function QuickNoteWidget({ userId, onSaved }: QuickNoteWidgetProps) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), title: title.trim() || null }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save')
      }
      setContent('')
      setTitle('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }, [content, title, onSaved])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
    },
    [handleSave]
  )

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Quick Note</h3>
        <a href="/notes" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
          All notes →
        </a>
      </div>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />

      <div onKeyDown={handleKeyDown}>
        <NoteEditor
          value={content}
          onChange={setContent}
          placeholder="Write a note... (⌘↵ to save)"
          minRows={3}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {content.length > 0 ? `${content.length} chars` : 'Math expressions auto-calculate'}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className={[
            'rounded-lg px-4 py-1.5 text-xs font-medium transition-all',
            saved
              ? 'bg-green-500 text-white'
              : saving || !content.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600',
          ].join(' ')}
        >
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  )
}
