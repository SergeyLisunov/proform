'use client'
import { useCallback, useEffect, useState } from 'react'

type Suggestion = {
  headline: string
  activity: 'Бег' | 'Велоспорт' | 'Плавание' | 'Силовые' | 'Ходьба' | 'Отдых' | 'Другое'
  duration_min: number
  intensity: 'rest' | 'easy' | 'moderate' | 'hard' | 'peak'
  rationale: string
  readiness: number
  tips: string[]
}

const INTENSITY_STYLE: Record<Suggestion['intensity'], { label: string; bg: string; color: string }> = {
  rest:     { label: 'Отдых',     bg: '#DCFCE7', color: '#166534' },
  easy:     { label: 'Лёгко',     bg: '#DBEAFE', color: '#1D4ED8' },
  moderate: { label: 'Умеренно',  bg: '#FEF3C7', color: '#B45309' },
  hard:     { label: 'Тяжело',    bg: '#FEE2E2', color: '#B91C1C' },
  peak:     { label: 'Пиково',    bg: '#EDE9FE', color: '#6D28D9' },
}

export default function AiCoachCard() {
  const [data, setData]         = useState<Suggestion | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/coach-suggest', { cache: 'no-store' })
      if (res.status === 503) { setDisabled(true); return }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      setData(json.data as Suggestion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI_ERROR')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-border bg-card"
      style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#312E81 100%)' }}
    >
      {/* glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full"
           style={{ background: 'radial-gradient(circle,#A855F7 0%,transparent 70%)', opacity: 0.35 }} />

      <div className="relative p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
              <i className="ki-filled ki-flash-circle text-[14px] text-amber-300" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">AI-тренер</span>
          </div>
          <button
            onClick={load}
            disabled={loading || disabled}
            title="Пересчитать"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            <i className={`ki-filled ki-arrows-circle text-[12px] text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {disabled ? (
          <div className="text-xs leading-snug text-white/80">
            AI-рекомендации скоро появятся — эта функция настраивается.
          </div>
        ) : error ? (
          <div className="text-xs text-red-200">Не удалось получить рекомендацию. <button onClick={load} className="underline">Повторить</button></div>
        ) : loading && !data ? (
          <div className="space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/15" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-white/15" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/15" />
          </div>
        ) : data ? (
          <>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/60">Рекомендация на завтра</div>
            <div className="mb-2 text-[17px] font-extrabold leading-tight">{data.headline}</div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">{data.activity}</span>
              {data.duration_min > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">{data.duration_min} мин</span>
              )}
              <span
                className="rounded-full px-2 py-0.5 font-bold"
                style={{ background: INTENSITY_STYLE[data.intensity].bg, color: INTENSITY_STYLE[data.intensity].color }}
              >
                {INTENSITY_STYLE[data.intensity].label}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">готовность {data.readiness}</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-white/85">{data.rationale}</p>
            {data.tips.length > 0 && (
              <ul className="mt-3 space-y-1">
                {data.tips.slice(0, 3).map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-white/80">
                    <i className="ki-filled ki-check-circle mt-[2px] text-[10px] text-emerald-300" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
