'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeAcwr, ACWR_ZONE_META, type AcwrZone } from '@/lib/acwr/calc'
import { Card } from '@/components/ui/metronic'

interface WeekBucket { label: string; load: number; date: string }

interface AcwrSnapshot {
  acwr: number | null
  zone: AcwrZone
  acute: number
  chronic: number
  weeks: WeekBucket[]
  streakDays: number
}

function startOfMondayWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d); r.setHours(0, 0, 0, 0); r.setDate(r.getDate() + diff)
  return r
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Личный ACWR-индикатор для атлета. Считает 4-недельную нагрузку из
 * workouts (strain или duration*0.1) + текущий streak подряд тренировочных
 * дней. Кликабельная карточка ведёт в /tools/acwr.
 */
export default function AthletePersonalAcwr({ athleteId }: { athleteId: string }) {
  const [snap, setSnap] = useState<AcwrSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const from = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
      const { data } = await sb.from('workouts')
        .select('event_date, activity_strain, activity_duration_min')
        .eq('athlete_id', athleteId)
        .gte('event_date', from)
      const rows = ((data ?? []) as Array<{
        event_date: string | null; activity_strain: number | null; activity_duration_min: number | null
      }>).filter(w => !!w.event_date)

      // Aggregate per-day load
      const perDay: Record<string, number> = {}
      const trainingDays = new Set<string>()
      for (const w of rows) {
        const date = w.event_date!
        const load = (w.activity_strain != null && w.activity_strain > 0)
          ? w.activity_strain
          : ((w.activity_duration_min ?? 0) * 0.1)
        if (load <= 0) continue
        perDay[date] = (perDay[date] ?? 0) + load
        trainingDays.add(date)
      }

      // Build 4 weekly buckets W-3..W-0, ending today (week aligned by Monday)
      const todayMonday = startOfMondayWeek(new Date())
      const buckets: WeekBucket[] = []
      for (let i = 3; i >= 0; i--) {
        const start = new Date(todayMonday); start.setDate(start.getDate() - i * 7)
        const end   = new Date(start); end.setDate(end.getDate() + 7)
        let sum = 0
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          sum += perDay[isoDate(d)] ?? 0
        }
        const startStr = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        buckets.push({ label: i === 0 ? 'Эта' : `${i} нед`, load: Number(sum.toFixed(1)), date: startStr })
      }

      const result = computeAcwr({
        weeks: [buckets[0].load, buckets[1].load, buckets[2].load, buckets[3].load],
      })

      // Streak — последовательные тренировочные дни от сегодня назад
      let streak = 0
      const cur = new Date(); cur.setHours(0, 0, 0, 0)
      while (trainingDays.has(isoDate(cur))) {
        streak++
        cur.setDate(cur.getDate() - 1)
      }

      setSnap({
        acwr: result.acwr,
        zone: result.zone,
        acute: result.acute,
        chronic: result.chronic,
        weeks: buckets,
        streakDays: streak,
      })
    } finally { setLoading(false) }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  if (loading || !snap) {
    return (
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">Ваша нагрузка</p>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Считаем ACWR…</div>
      </Card>
    )
  }

  const meta = ACWR_ZONE_META[snap.zone]
  const maxLoad = Math.max(...snap.weeks.map(b => b.load), 1)

  return (
    <Link href="/tools/acwr"
      className="block rounded-2xl border bg-card p-5 hover:shadow-sm transition-shadow"
      style={{ borderColor: meta.border }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ваша нагрузка · ACWR</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="pf-num text-3xl font-bold" style={{ color: meta.color }}>
              {snap.acwr != null ? snap.acwr.toFixed(2) : '—'}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{meta.tagline}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-center">
            <div className="pf-num text-xl font-bold text-orange-600">{snap.streakDays}</div>
            <div className="text-[9px] uppercase tracking-wider text-orange-700">дней подряд</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 items-end h-16">
        {snap.weeks.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-1 min-w-0">
            <div className="w-full rounded-md transition-all"
              style={{
                height: `${Math.max(8, (b.load / maxLoad) * 56)}px`,
                background: i === 3 ? meta.color : '#E2E8F0',
              }} />
            <div className="text-[9px] text-muted-foreground truncate w-full text-center">{b.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Острая (7д) <strong className="text-foreground">{snap.acute}</strong></span>
        <span>Хроническая (28д) <strong className="text-foreground">{snap.chronic}</strong></span>
        <span className="text-orange-600 font-semibold">Подробнее →</span>
      </div>
    </Link>
  )
}
