'use client'
/**
 * Deterministic training-load metrics — no AI.
 * Shows Acute:Chronic Workload Ratio (ACWR), weekly monotony, and 4-week strain trend.
 *
 * ACWR: acute (last 7d strain) / chronic (avg of last 28d strain).
 *   < 0.8  → detrained
 *   0.8-1.3 → sweet spot (safe)
 *   1.3-1.5 → caution
 *   > 1.5  → high injury risk
 *
 * Monotony: mean_daily_strain / stddev_daily_strain. >2 = monotonous, risk of overtraining.
 */
import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Row = { event_date: string | null; activity_strain: number | null }

export default function TrainingLoadWidget({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const since = new Date(); since.setDate(since.getDate() - 27)
      const sinceStr = since.toISOString().slice(0, 10)
      const { data } = await sb()
        .from('workouts')
        .select('event_date, activity_strain')
        .eq('athlete_id', userId)
        .gte('event_date', sinceStr)
      if (cancelled) return
      setRows((data ?? []) as Row[])
      setLoading(false)
    }
    if (userId) load()
    return () => { cancelled = true }
  }, [userId])

  const metrics = useMemo(() => {
    // Build 28 days of daily strain totals.
    const daily: number[] = new Array(28).fill(0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    rows.forEach(r => {
      if (!r.event_date) return
      const d = new Date(r.event_date + 'T00:00:00')
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
      if (diff < 0 || diff > 27) return
      daily[27 - diff] += Number(r.activity_strain) || 0
    })

    const last7  = daily.slice(-7)
    const last28 = daily
    const acute   = last7.reduce((s, v) => s + v, 0) / 7
    const chronic = last28.reduce((s, v) => s + v, 0) / 28
    const acwr    = chronic > 0 ? acute / chronic : 0

    const mean = last7.reduce((s, v) => s + v, 0) / 7
    const variance = last7.reduce((s, v) => s + (v - mean) ** 2, 0) / 7
    const stddev = Math.sqrt(variance)
    const monotony = stddev > 0 ? mean / stddev : 0

    const weekTotals = [0, 1, 2, 3].map(w => {
      const slice = daily.slice(w * 7, w * 7 + 7)
      return slice.reduce((s, v) => s + v, 0)
    })

    return { acwr, monotony, weekTotals, daily }
  }, [rows])

  const acwrZone = zoneForAcwr(metrics.acwr)
  const monZone  = zoneForMonotony(metrics.monotony)

  const barMax = Math.max(1, ...metrics.weekTotals)

  return (
    <div
      className="rounded-[20px] border border-sky-100 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#F0F9FF 0%,#F8FBFF 60%,#FFFFFF 100%)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-sky-100/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-sky-100">
            <i className="ki-filled ki-chart-line-up text-[14px] text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">Тренировочная нагрузка</h3>
            <div className="text-[10px] text-muted-foreground mt-0.5">ACWR · монотонность · 4 недели</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="ACWR (7 / 28)"
                value={metrics.acwr > 0 ? metrics.acwr.toFixed(2) : '—'}
                hint={acwrZone.label}
                color={acwrZone.color}
              />
              <Metric
                label="Монотонность (7д)"
                value={metrics.monotony > 0 ? metrics.monotony.toFixed(2) : '—'}
                hint={monZone.label}
                color={monZone.color}
              />
            </div>

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Объём strain по неделям
              </div>
              <div className="flex items-end gap-2 h-20">
                {metrics.weekTotals.slice().reverse().map((v, i) => {
                  const h = Math.max(4, (v / barMax) * 72)
                  const isCurrent = i === 3
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: h,
                          background: isCurrent ? '#F97316' : '#E2E8F0',
                        }}
                      />
                      <div className="text-[9px] text-muted-foreground font-bold">
                        {i === 3 ? 'тек.' : `−${3 - i}н`}
                      </div>
                      <div className="text-[10px] pf-num font-bold text-foreground">{v.toFixed(0)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-2xs text-muted-foreground leading-snug">
              ACWR 0.8–1.3 — безопасный диапазон. {'>'}1.5 — риск перегруза. Монотонность {'>'}2 — мало вариативности, риск переутомления.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-accent/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-extrabold pf-num" style={{ color }}>{value}</span>
      </div>
      <div className="text-2xs font-semibold" style={{ color }}>{hint}</div>
    </div>
  )
}

function zoneForAcwr(v: number): { label: string; color: string } {
  if (v === 0) return { label: 'Мало данных', color: '#94A3B8' }
  if (v < 0.8)  return { label: 'Низкая нагрузка', color: '#2563EB' }
  if (v <= 1.3) return { label: 'Безопасная зона',  color: '#10B981' }
  if (v <= 1.5) return { label: 'Осторожно',        color: '#F59E0B' }
  return                  { label: 'Высокий риск',   color: '#EF4444' }
}

function zoneForMonotony(v: number): { label: string; color: string } {
  if (v === 0) return { label: 'Мало данных', color: '#94A3B8' }
  if (v < 1.5) return { label: 'Вариативно',   color: '#10B981' }
  if (v <= 2)  return { label: 'Умеренно',     color: '#F59E0B' }
  return                { label: 'Монотонно',   color: '#EF4444' }
}
