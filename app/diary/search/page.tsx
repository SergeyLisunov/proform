'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { Badge, type BadgeVariant } from '@/components/ui/metronic'

type NoteData = { id: string; title: string | null; content: string; note_date: string }
type WorkoutData = {
  id: string
  event_date: string
  activity_type: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  description: string | null
}

type NoteHit = {
  source_type: 'note'
  source_id: string
  content_preview: string | null
  similarity: number
  note: NoteData | null
}
type WorkoutHit = {
  source_type: 'workout'
  source_id: string
  content_preview: string | null
  similarity: number
  workout: WorkoutData | null
}
type Hit = NoteHit | WorkoutHit

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function pct(sim: number): string {
  return `${Math.round(Math.max(0, Math.min(1, sim)) * 100)}%`
}

function simVariant(sim: number): BadgeVariant {
  if (sim >= 0.6) return 'success'
  if (sim >= 0.4) return 'warning'
  return 'secondary'
}

export default function DiarySearchPage() {
  const { success, error } = useToast()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [lastIndex, setLastIndex] = useState<{ indexed: number; total: number } | null>(null)

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await fetch('/api/diary/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, k: 25 }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'SEARCH_ERROR')
      setHits(json.hits as Hit[])
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка поиска')
    } finally {
      setSearching(false)
    }
  }, [query, error])

  const reindex = useCallback(async () => {
    setIndexing(true)
    try {
      const res = await fetch('/api/diary/index', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'INDEX_ERROR')
      setLastIndex({ indexed: json.indexed ?? 0, total: json.total ?? 0 })
      success(`Проиндексировано: ${json.indexed} из ${json.total}`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка индексации')
    } finally {
      setIndexing(false)
    }
  }, [success, error])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearch()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <Link href="/diary" className="hover:text-foreground">← К дневнику</Link>
        <button
          type="button"
          onClick={reindex}
          disabled={indexing}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent disabled:opacity-50"
          title="Пересчитать эмбеддинги для заметок и тренировок"
        >
          {indexing ? 'Индексируем…' : 'Пересобрать индекс'}
        </button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_42%)]" />
        <div className="relative flex flex-col gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-600">
            Семантический поиск
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-foreground">
            Найди, что думал или тренировал — по смыслу
          </h1>
          <p className="max-w-[640px] text-sm text-muted-foreground">
            Ищет по заметкам и тренировкам даже если слова не совпадают.
            Работает на многоязычных векторных эмбеддингах.
          </p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <i className="ki-filled ki-magnifier absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Например: устал после длинных пробежек"
                className="w-full rounded-full border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !query.trim()}
              className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {searching ? 'Ищем…' : 'Искать'}
            </button>
          </div>
          {lastIndex && (
            <div className="text-[11px] text-muted-foreground">
              Последняя индексация: {lastIndex.indexed} обновлено из {lastIndex.total}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {hits !== null && (
        <section className="flex flex-col gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Результаты · {hits.length}
          </div>

          {hits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/70 p-10 text-center text-sm text-muted-foreground">
              Ничего не нашлось. Попробуйте переформулировать запрос
              или нажмите «Пересобрать индекс», если недавно добавляли записи.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {hits.map(h => {
                const isNote = h.source_type === 'note'
                const href = isNote ? '/notes' : '/diary'
                const title = isNote
                  ? ((h as NoteHit).note?.title ?? null) ||
                    ((h as NoteHit).note?.content.slice(0, 60) ?? 'Заметка')
                  : ((h as WorkoutHit).workout?.activity_type ?? 'Тренировка')
                const dateIso = isNote
                  ? (h as NoteHit).note?.note_date
                  : (h as WorkoutHit).workout?.event_date
                const body = isNote
                  ? (h as NoteHit).note?.content ?? h.content_preview ?? ''
                  : (h as WorkoutHit).workout?.description ?? h.content_preview ?? ''

                return (
                  <li key={`${h.source_type}:${h.source_id}`}>
                    <Link
                      href={href}
                      className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                        <i
                          className={`ki-filled ${isNote ? 'ki-notepad-edit text-[18px] text-amber-500' : 'ki-flash text-[18px] text-emerald-500'}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" size="sm" className="uppercase tracking-wider">
                            {isNote ? 'Заметка' : 'Тренировка'}
                          </Badge>
                          {dateIso && (
                            <span className="text-[11px] text-muted-foreground">{fmtDate(dateIso)}</span>
                          )}
                          <Badge variant={simVariant(h.similarity)} size="sm" className="ml-auto">
                            {pct(h.similarity)}
                          </Badge>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-foreground group-hover:text-indigo-700">
                          {title}
                        </div>
                        {body && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{body}</p>
                        )}
                        {!isNote && (h as WorkoutHit).workout && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                            {(h as WorkoutHit).workout!.activity_duration_min != null && (
                              <span className="rounded bg-muted px-1.5 py-0.5">
                                {(h as WorkoutHit).workout!.activity_duration_min} мин
                              </span>
                            )}
                            {(h as WorkoutHit).workout!.activity_strain != null && (
                              <span className="rounded bg-muted px-1.5 py-0.5">
                                strain {(h as WorkoutHit).workout!.activity_strain}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {hits === null && (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Введите запрос, чтобы найти заметки и тренировки по смыслу.
          Первый раз? Нажмите «Пересобрать индекс».
        </section>
      )}
    </div>
  )
}
