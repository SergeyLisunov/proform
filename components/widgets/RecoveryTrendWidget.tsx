'use client'
import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Point = { date: string; recovery: number | null; hrv: number | null }

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function RecoveryTrendWidget({ userId }: { userId: string }) {
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const since = new Date(); since.setDate(since.getDate() - 13)
      const sinceStr = since.toISOString().slice(0, 10)
      const { data } = await sb()
        .from('workouts')
        .select('event_date, recovery_score, hrv')
        .eq('athlete_id', userId)
        .gte('event_date', sinceStr)
        .order('event_date', { ascending: true })
      if (cancelled) return
      const byDate = new Map<string, Point>()
      ;(data ?? []).forEach((r: { event_date: string | null; recovery_score: number | null; hrv: number | null }) => {
        if (!r.event_date) return
        byDate.set(r.event_date, { date: r.event_date, recovery: r.recovery_score, hrv: r.hrv })
      })
      // Fill 14 days
      const out: Point[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        out.push(byDate.get(ds) ?? { date: ds, recovery: null, hrv: null })
      }
      setPoints(out)
      setLoading(false)
    }
    if (userId) load()
    return () => { cancelled = true }
  }, [userId])

  const path = useMemo(() => {
    const vals = points.map(p => p.recovery)
    const W = 320, H = 56, P = 2
    const xs = vals.map((_, i) => P + (i * (W - 2 * P)) / (vals.length - 1))
    const ys = vals.map(v => {
      if (v == null) return null
      const clamped = Math.max(0, Math.min(100, v))
      return P + (1 - clamped / 100) * (H - 2 * P)
    })
    let d = ''
    let started = false
    for (let i = 0; i < vals.length; i++) {
      const y = ys[i]; if (y == null) continue
      d += (started ? ' L' : 'M') + xs[i].toFixed(1) + ' ' + y.toFixed(1)
      started = true
    }
    return { d, W, H }
  }, [points])

  const last = [...points].reverse().find(p => p.recovery != null)?.recovery
  const prev = [...points].reverse().slice(1).find(p => p.recovery != null)?.recovery
  const delta = last != null && prev != null ? last - prev : null

  return (
    <div
      className="rounded-[20px] border border-emerald-100 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#ECFDF5 0%,#F6FEFA 60%,#FFFFFF 100%)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-100/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-emerald-100">
            <i className="ki-filled ki-heart text-[14px] text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Готовность · 14 дней</h3>
        </div>
        {last != null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold pf-num text-foreground">{Math.round(last)}</span>
            {delta != null && delta !== 0 && (
              <span className={`text-[11px] font-bold pf-num ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(0)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="h-14 animate-pulse rounded bg-muted" />
        ) : path.d ? (
          <svg width="100%" height={path.H} viewBox={`0 0 ${path.W} ${path.H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="recGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path.d} L ${path.W - 2} ${path.H} L 2 ${path.H} Z`} fill="url(#recGrad)" />
            <path d={path.d} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <p className="text-xs text-muted-foreground">Пока нет данных о готовности.</p>
        )}
      </div>
    </div>
  )
}
