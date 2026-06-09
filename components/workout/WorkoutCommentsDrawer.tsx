'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '@/lib/hooks/useDialog'
import { Alert } from '@/components/ui/metronic'

type Author = {
  id: string
  name: string | null
  nickname: string | null
  avatar_url: string | null
  role: string | null
}

type Comment = {
  id: string
  workout_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  author: Author | null
}

function displayAuthor(a: Author | null): string {
  if (!a) return 'Автор'
  return a.name || a.nickname || 'Автор'
}

function roleBadge(role: string | null): { label: string; cls: string } | null {
  switch (role) {
    case 'doctor':       return { label: 'Доктор', cls: 'bg-red-50 text-red-700 border-red-200' }
    case 'coach':        return { label: 'Тренер', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
    case 'organization': return { label: 'Команда', cls: 'bg-violet-50 text-violet-700 border-violet-200' }
    case 'athlete':      return { label: 'Атлет',  cls: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'admin':        return { label: 'Admin',  cls: 'bg-slate-900 text-white border-slate-900' }
    default: return null
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function WorkoutCommentsDrawer({
  workoutId,
  workoutTitle,
  currentUserId,
  onClose,
}: {
  workoutId: string | null
  workoutTitle?: string | null
  currentUserId: string
  onClose: () => void
}) {
  const { confirm } = useDialog()
  const [mounted, setMounted]     = useState(false)
  const [visible, setVisible]     = useState(false)
  const [comments, setComments]   = useState<Comment[]>([])
  const [loading, setLoading]     = useState(false)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const scrollRef                 = useRef<HTMLDivElement | null>(null)

  const open = !!workoutId

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) { setVisible(false); return }
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [open])

  const load = useCallback(async () => {
    if (!workoutId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workouts/${workoutId}/comments`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setComments(json.comments as Comment[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LOAD_ERROR')
    } finally {
      setLoading(false)
    }
  }, [workoutId])

  useEffect(() => {
    if (open) load()
    else { setComments([]); setText(''); setError(null) }
  }, [open, load])

  useEffect(() => {
    if (!comments.length || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [comments])

  async function submit() {
    const value = text.trim()
    if (!value || !workoutId || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/workouts/${workoutId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: value }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'SEND_ERROR')
      setComments(prev => [...prev, json.comment as Comment])
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SEND_ERROR')
    } finally {
      setSending(false)
    }
  }

  async function remove(commentId: string) {
    if (!(await confirm('Удалить комментарий?'))) return
    const snapshot = comments
    setComments(prev => prev.filter(c => c.id !== commentId))
    try {
      const res = await fetch(`/api/workout-comments/${commentId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'DELETE_ERROR')
    } catch (e) {
      setComments(snapshot)
      setError(e instanceof Error ? e.message : 'DELETE_ERROR')
    }
  }

  function close() {
    setVisible(false)
    setTimeout(() => onClose(), 180)
  }

  if (!mounted || !open) return null

  const body = (
    <div
      className="fixed inset-0 z-[9999] flex justify-end"
      role="dialog"
      aria-modal="true"
      onKeyDown={e => { if (e.key === 'Escape') close() }}
    >
      <div
        className={`absolute inset-0 bg-slate-900/35 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`relative flex h-full w-full max-w-[440px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Комментарии</div>
            <div className="mt-1 truncate text-sm font-bold text-foreground">
              {workoutTitle || 'Тренировка'}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Закрыть"
          >
            <i className="ki-filled ki-cross text-[13px]" />
          </button>
        </div>

        {/* List */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 py-10 text-center">
              <i className="ki-filled ki-messages text-[18px] text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Пока нет комментариев</p>
              <p className="text-2xs text-muted-foreground/70">Оставьте заметку тренеру или врачу.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map(c => {
                const mine   = c.author_id === currentUserId
                const badge  = roleBadge(c.author?.role ?? null)
                return (
                  <div
                    key={c.id}
                    className={`flex ${mine ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${mine ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                      {c.author?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.author.avatar_url} alt="" className="h-8 w-8 rounded-xl object-cover" />
                      ) : (
                        <i className="ki-filled ki-user text-[13px]" />
                      )}
                    </div>
                    <div className={`flex min-w-0 flex-1 flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                        <span className="text-2xs font-semibold text-foreground">{displayAuthor(c.author)}</span>
                        {badge && (
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</span>
                      </div>
                      <div
                        className={`mt-1 inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'bg-orange-500 text-white rounded-tr-sm'
                            : 'bg-card border border-border text-foreground rounded-tl-sm'
                        }`}
                      >
                        {c.body}
                      </div>
                      {mine && (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          className="mt-1 text-[10px] text-muted-foreground hover:text-red-600"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-3">
              {error}
            </Alert>
          )}
        </div>

        {/* Composer */}
        <form
          className="border-t border-border bg-card/60 px-4 py-3"
          onSubmit={e => { e.preventDefault(); submit() }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Написать комментарий…"
              rows={2}
              maxLength={4000}
              className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus:border-orange-400"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Отправить"
            >
              {sending ? (
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent pf-spin" />
              ) : (
                <i className="ki-filled ki-send text-[14px]" />
              )}
            </button>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">⌘/Ctrl + Enter — отправить</div>
        </form>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
