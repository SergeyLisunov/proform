'use client'

/**
 * MyPlanWeekCard — план тренера на неделю на ГЛАВНОМ дашборде атлета
 * (P1, унификация кабинетов).
 *
 * До этого план недели жил только на /athlete/dashboard, а атлеты
 * приземляются на /dashboard — назначенные тренировки просто не были
 * видны. Карточка показывает неделю (сегодня → +7 дней) и даёт отметить
 * выполнение прямо здесь: setPrescribedCompletion замыкает петлю тренера
 * и кормит стрик с рекордами. Скрывается, если назначений нет.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'
import { setPrescribedCompletion, type CompletionStatus } from '@/services/prescribed-workouts.service'

interface PlanRow {
  id: string
  event_date: string
  activity_type: string | null
  name: string | null
  activity_duration_min: number | null
  completion_status: CompletionStatus | null
  prescribed_note: string | null
}

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MyPlanWeekCard({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<PlanRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sb as any)
      .from('workouts')
      .select('id, event_date, activity_type, name, activity_duration_min, completion_status, prescribed_note')
      .eq('athlete_id', athleteId)
      .eq('event_type', 'prescribed')
      .gte('event_date', today)
      .lte('event_date', weekEnd)
      .order('event_date', { ascending: true })
      .limit(10)
      .then(({ data }: { data: PlanRow[] | null }) => {
        if (!cancelled) setRows(data ?? [])
      })
    return () => { cancelled = true }
  }, [athleteId])

  if (rows.length === 0) return null

  async function mark(id: string, status: CompletionStatus) {
    setBusyId(id)
    const ok = await setPrescribedCompletion(id, status)
    if (ok) setRows(prev => prev.map(r => (r.id === id ? { ...r, completion_status: status } : r)))
    setBusyId(null)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2.5 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <i className="ki-filled ki-calendar-8 text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">План на неделю</h3>
            <p className="text-2xs text-muted-foreground">Назначено тренером</p>
          </div>
        </div>
        <Link href="/athlete/dashboard" className="text-2xs font-semibold text-orange-600 hover:underline">
          Весь план →
        </Link>
      </div>
      <div className="divide-y divide-border">
        {rows.map(w => {
          const done = w.completion_status === 'completed'
          const skipped = w.completion_status === 'skipped'
          return (
            <div key={w.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-20 shrink-0 text-2xs font-semibold ${w.event_date === today ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {w.event_date === today ? 'сегодня' : fmtDay(w.event_date)}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {w.name ?? w.activity_type ?? 'Тренировка'}
                  {w.activity_duration_min ? <span className="text-muted-foreground"> · {w.activity_duration_min} мин</span> : null}
                </div>
                {w.prescribed_note && (
                  <div className="truncate text-2xs text-muted-foreground">{w.prescribed_note}</div>
                )}
              </div>
              {done ? (
                <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-2xs font-semibold text-success">выполнено</span>
              ) : skipped ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-semibold text-muted-foreground">пропущено</span>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => mark(w.id, 'completed')}
                    disabled={busyId === w.id}
                    className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-2xs font-semibold text-success hover:bg-success/20 disabled:opacity-50"
                  >
                    Выполнил
                  </button>
                  <button
                    onClick={() => mark(w.id, 'skipped')}
                    disabled={busyId === w.id}
                    className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Пропустил
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
