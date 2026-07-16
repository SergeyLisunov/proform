'use client'

/**
 * PersonalRecordsCard — витрина личных рекордов атлета (P1 соц-ядро).
 *
 * Mastery-ориентация: соревнование с собой, никаких сравнений с другими.
 * Данные — athlete_records (детект в services/personal-records после каждой
 * записанной/выполненной тренировки). RLS: сам атлет + тренер + родитель.
 * Скрывается целиком, пока рекордов нет.
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card } from '@/components/ui/metronic'
import { RECORD_LABEL, formatRecordValue, type RecordKind } from '@/services/personal-records.service'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const KIND_ICON: Record<RecordKind, string> = {
  longest_workout:      'ki-timer',
  best_week_volume:     'ki-chart-simple',
  training_streak_days: 'ki-calendar-tick',
}

interface RecordRow {
  kind: RecordKind
  value: number
  achieved_on: string
}

export default function PersonalRecordsCard({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<RecordRow[]>([])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sb() as any)
      .from('athlete_records')
      .select('kind, value, achieved_on')
      .eq('athlete_id', athleteId)
      .then(({ data }: { data: RecordRow[] | null }) => {
        if (!cancelled) setRows(data ?? [])
      })
    return () => { cancelled = true }
  }, [athleteId])

  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <i className="ki-filled ki-medal-star text-sm" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-navy-500">Мои рекорды</h3>
          <p className="text-2xs text-muted-foreground">Соревнование с собой — каждый рекорд ваш</p>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {rows.map(r => (
          <div key={r.kind} className="flex flex-col gap-1 px-5 py-4">
            <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <i className={`ki-filled ${KIND_ICON[r.kind]} text-[11px] text-violet-500`} />
              {RECORD_LABEL[r.kind]}
            </div>
            <div className="pf-num text-2xl text-foreground">{formatRecordValue(r.kind, Number(r.value))}</div>
            <div className="text-2xs text-muted-foreground">
              {new Date(r.achieved_on + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
