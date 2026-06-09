'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listUpcomingPrescribedForAthlete,
  setPrescribedCompletion,
  type PrescribedWorkout,
} from '@/services/prescribed-workouts.service'
import { Card, Badge } from '@/components/ui/metronic'

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function tomorrowISO(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
}

function dayLabel(iso: string): string {
  const t = todayISO(), tm = tomorrowISO()
  if (iso === t)  return 'Сегодня'
  if (iso === tm) return 'Завтра'
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * План на ближайшие 2 дня — что назначил тренер. Каждый пункт можно
 * пометить «Сделано» / «Пропуск» прямо отсюда. Если ничего не назначено,
 * показывает дружелюбную empty-state с CTA добавить тренировку самому.
 */
export default function AthleteTodayPlan({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<PrescribedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Celebratory micro-toast — Sprint W1 Day 5. Until this PR, marking
  // a workout "✓ Сделано" silently flipped the badge with no closure
  // ritual; now we briefly celebrate the action so the athlete gets a
  // small positive feedback loop (also nudges to debrief).
  const [celebrateId, setCelebrateId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await listUpcomingPrescribedForAthlete(athleteId)
      const limit = tomorrowISO()
      setRows(all.filter(w => w.event_date <= limit))
    } finally { setLoading(false) }
  }, [athleteId])
  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: 'completed' | 'skipped') => {
    setBusyId(id)
    const ok = await setPrescribedCompletion(id, status)
    if (ok) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, completion_status: status } : r))
      if (status === 'completed') {
        setCelebrateId(id)
        setTimeout(() => setCelebrateId(prev => (prev === id ? null : prev)), 4000)
      }
    }
    setBusyId(null)
  }

  if (loading && rows.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">План на ближайшие дни</p>
        <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">План тренировок</p>
            <h3 className="text-base font-bold text-navy-500 mt-1">Тренер не назначил тренировок на сегодня</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Можно записать сессию самостоятельно, она попадёт в дневник.</p>
          </div>
          <Link href="/diary"
            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold">
            + Записать тренировку
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/60 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700">План тренировок</p>
          <h3 className="text-base font-bold text-navy-500">Сегодня и завтра</h3>
        </div>
        <Link href="/diary" className="text-[11px] font-semibold text-orange-600 hover:underline">
          Все тренировки →
        </Link>
      </div>

      <div className="space-y-2">
        {rows.map(w => {
          const status = w.completion_status ?? 'pending'
          const overdue = status === 'pending' && w.event_date < todayISO()
          return (
            <div key={w.id}
              className={`rounded-xl border p-3 ${
                status === 'completed' ? 'border-green-200 bg-green-50/40' :
                status === 'skipped'   ? 'border-slate-200 bg-slate-50' :
                overdue                ? 'border-red-200 bg-red-50/40' :
                                         'border-border bg-white'
              }`}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-orange-100 text-orange-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {dayLabel(w.event_date)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{w.name ?? 'Тренировка'}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {w.activity_type ?? '—'}
                    {w.activity_duration_min ? ` · ${w.activity_duration_min} мин` : ''}
                  </div>
                  {w.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{w.description}</p>
                  )}
                </div>
                {status === 'pending' ? (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button disabled={busyId === w.id}
                      onClick={() => setStatus(w.id, 'completed')}
                      className="inline-flex items-center gap-1 rounded-md bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 text-[10px] font-bold disabled:opacity-50">
                      <i className="ki-filled ki-check text-[10px]" />
                      Сделано
                    </button>
                    <button disabled={busyId === w.id}
                      onClick={() => setStatus(w.id, 'skipped')}
                      className="rounded-md border border-border bg-background hover:bg-muted text-muted-foreground px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50">
                      Пропуск
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={status === 'completed' ? 'success' : 'secondary'} size="sm" className="uppercase tracking-wider">
                      {status === 'completed'
                        ? <span className="inline-flex items-center gap-1"><i className="ki-filled ki-check text-[10px]" />Сделано</span>
                        : 'Пропуск'}
                    </Badge>
                    {celebrateId === w.id && (
                      <Link href="/diary"
                        className="inline-flex items-center gap-1 rounded-md bg-green-500/10 text-green-700 px-2 py-0.5 text-[10px] font-semibold border border-green-200 hover:bg-green-500/20 animate-pulse"
                        title="Поделиться впечатлениями (опционально)">
                        <i className="ki-filled ki-medal-star text-[10px]" />
                        Отлично! Поделиться?
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
