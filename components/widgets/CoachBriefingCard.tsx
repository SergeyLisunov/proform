'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type AthleteItem = {
  athlete_id: string
  name: string
  status: 'ok' | 'watch' | 'risk'
  headline: string
  action: string
}

type Briefing = {
  overall: string
  athletes: AthleteItem[]
  priorities: string[]
}

const STATUS_STYLE: Record<AthleteItem['status'], { dot: string; bg: string; label: string }> = {
  ok:    { dot: '#10B981', bg: '#ECFDF5', label: 'OK' },
  watch: { dot: '#F59E0B', bg: '#FFFBEB', label: 'Внимание' },
  risk:  { dot: '#EF4444', bg: '#FEF2F2', label: 'Риск' },
}

export default function CoachBriefingCard() {
  const [data, setData]         = useState<Briefing | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/coach-briefing', { cache: 'no-store' })
      if (res.status === 503) { setDisabled(true); return }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      setData(json.data as Briefing)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI_ERROR')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#FFF7ED' }}>
            <i className="ki-filled ki-rocket text-[14px] text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">Утренний брифинг</h3>
            <div className="text-[10px] text-muted-foreground mt-0.5">AI-сводка по команде</div>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading || disabled}
          title="Пересчитать"
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition"
        >
          <i className={`ki-filled ki-arrows-circle text-[12px] text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-5">
        {disabled ? (
          <p className="text-xs text-muted-foreground">AI-брифинг отключён. Добавьте <code className="rounded bg-accent px-1">ANTHROPIC_API_KEY</code>.</p>
        ) : error ? (
          <p className="text-xs text-red-600">Не удалось получить брифинг. <button onClick={load} className="underline">Повторить</button></p>
        ) : loading && !data ? (
          <div className="space-y-2">
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground">{data.overall}</p>

            {data.priorities.length > 0 && (
              <div className="rounded-xl border border-border bg-accent/40 px-3 py-2">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Приоритеты сегодня</div>
                <ul className="space-y-1">
                  {data.priorities.map((p, i) => (
                    <li key={i} className="flex gap-1.5 text-xs font-semibold text-foreground">
                      <i className="ki-filled ki-arrow-right mt-[2px] text-[10px] text-orange-500" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.athletes.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Атлеты</div>
                {data.athletes.map(a => {
                  const s = STATUS_STYLE[a.status]
                  return (
                    <Link
                      key={a.athlete_id}
                      href={`/profile/${a.athlete_id}`}
                      className="flex gap-3 rounded-xl border border-border p-3 hover:bg-accent transition"
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: s.dot }}
                        title={s.label}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-foreground">{a.name}</span>
                          <span
                            className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                            style={{ background: s.bg, color: s.dot }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-foreground">{a.headline}</div>
                        <div className="mt-1 flex items-start gap-1 text-2xs text-muted-foreground">
                          <i className="ki-filled ki-flash mt-[2px] text-[9px] text-orange-500" />
                          <span>{a.action}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
