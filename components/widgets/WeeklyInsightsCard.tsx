'use client'
import { useCallback, useEffect, useState } from 'react'

type Insights = {
  summary: string
  highlights: string[]
  warnings: string[]
  focus_next: string
  total_min: number
  total_strain: number
}

export default function WeeklyInsightsCard() {
  const [data, setData]         = useState<Insights | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/weekly-insights', { cache: 'no-store' })
      if (res.status === 503) { setDisabled(true); return }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      setData(json.data as Insights)
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#EEF2FF' }}>
            <i className="ki-filled ki-chart-line-up text-[14px] text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Неделя в цифрах</h3>
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
          <p className="text-xs text-muted-foreground leading-snug">
            AI-инсайты отключены: добавьте <code className="rounded bg-accent px-1">ANTHROPIC_API_KEY</code>.
          </p>
        ) : error ? (
          <p className="text-xs text-red-600">Не удалось получить анализ. <button onClick={load} className="underline">Повторить</button></p>
        ) : loading && !data ? (
          <div className="space-y-2">
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-2xs">
              <div>
                <div className="text-muted-foreground">Время</div>
                <div className="text-base font-extrabold text-foreground pf-num">{data.total_min} мин</div>
              </div>
              <div>
                <div className="text-muted-foreground">Strain</div>
                <div className="text-base font-extrabold text-foreground pf-num">{data.total_strain.toFixed(1)}</div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>

            {data.highlights.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">Хорошо</div>
                <ul className="space-y-1">
                  {data.highlights.map((h, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-foreground">
                      <i className="ki-filled ki-check-circle mt-[2px] text-[10px] text-emerald-500" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.warnings.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-600">Внимание</div>
                <ul className="space-y-1">
                  {data.warnings.map((w, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-foreground">
                      <i className="ki-filled ki-information-2 mt-[2px] text-[10px] text-amber-500" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-border bg-accent/40 px-3 py-2">
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Фокус на следующую неделю</div>
              <div className="text-xs font-semibold text-foreground">{data.focus_next}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
