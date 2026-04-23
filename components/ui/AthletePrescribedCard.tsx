'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listUpcomingPrescribedForAthlete,
  setPrescribedCompletion,
  type PrescribedWorkout,
} from '@/services/prescribed-workouts.service'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })
}

function isPast(iso: string): boolean {
  return iso < new Date().toISOString().slice(0, 10)
}

/** Athlete dashboard widget — upcoming prescriptions from coach. */
export default function AthletePrescribedCard({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<PrescribedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listUpcomingPrescribedForAthlete(athleteId)) }
    finally { setLoading(false) }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  const handleStatus = useCallback(async (id: string, status: 'completed' | 'skipped') => {
    setBusy(b => ({ ...b, [id]: true }))
    const ok = await setPrescribedCompletion(id, status)
    if (ok) setRows(prev => prev.map(r => r.id === id ? { ...r, completion_status: status } : r))
    setBusy(b => ({ ...b, [id]: false }))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">План от тренера</p>
        <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </div>
    )
  }
  if (rows.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          План от тренера
        </p>
        <span className="rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5">
          {rows.filter(r => !r.completion_status || r.completion_status === 'pending').length} открыто
        </span>
      </div>
      <div className="space-y-2">
        {rows.map(w => {
          const status = w.completion_status ?? 'pending'
          const overdue = status === 'pending' && isPast(w.event_date)
          return (
            <div key={w.id}
              className={`rounded-xl border p-3 ${
                status === 'completed' ? 'border-green-200 bg-green-50/50' :
                status === 'skipped'   ? 'border-slate-200 bg-slate-50'    :
                overdue                ? 'border-red-200 bg-red-50/40'     :
                                         'border-border bg-background'
              }`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <i className="ki-filled ki-book text-base"/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {w.name ?? 'Тренировка'}
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                      {fmtDate(w.event_date)}{w.activity_duration_min ? ` · ${w.activity_duration_min} мин` : ''}
                    </span>
                  </div>
                  {w.description && (
                    <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {w.description}
                    </div>
                  )}
                  {status === 'pending' && (
                    <div className="mt-2 flex gap-1.5">
                      <button disabled={busy[w.id]} onClick={() => handleStatus(w.id, 'completed')}
                        className="inline-flex items-center gap-1 rounded-md bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50">
                        <i className="ki-filled ki-check text-[9px]"/>
                        Сделано
                      </button>
                      <button disabled={busy[w.id]} onClick={() => handleStatus(w.id, 'skipped')}
                        className="rounded-md border border-border bg-background hover:bg-muted text-muted-foreground px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50">
                        Пропуск
                      </button>
                      {overdue && (
                        <span className="ml-auto text-[10px] text-red-600 font-semibold">просрочено</span>
                      )}
                    </div>
                  )}
                  {status === 'completed' && (
                    <div className="mt-2 text-[10px] font-semibold text-green-700">
                      <i className="ki-filled ki-check-circle text-[10px] mr-1"/>
                      Отмечено выполненным
                    </div>
                  )}
                  {status === 'skipped' && (
                    <div className="mt-2 text-[10px] font-semibold text-slate-500">
                      Пропущено
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
