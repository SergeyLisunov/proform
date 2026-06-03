'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'

type Session = {
  id: string
  athlete_id: string
  athlete_name: string
  session_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  title: string | null
  status: string
}

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function tomorrowISO(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
}

function dayLabel(iso: string): string {
  if (iso === todayISO())    return 'Сегодня'
  if (iso === tomorrowISO()) return 'Завтра'
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/**
 * Расписание тренера на сегодня и завтра — из coach_sessions, где он
 * coach_id и status='planned'. Группирует по дню. Если ничего нет —
 * empty-state с CTA.
 */
export default function CoachTodaySchedule({ coachId }: { coachId: string }) {
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data } = await sb
        .from('coach_sessions')
        .select('id, athlete_id, session_date, start_time, end_time, location, title, status')
        .eq('coach_id', coachId)
        .eq('status', 'planned')
        .gte('session_date', todayISO())
        .lte('session_date', tomorrowISO())
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true })

      const sessions = (data ?? []) as Array<Omit<Session, 'athlete_name'>>
      const ids = [...new Set(sessions.map(s => s.athlete_id))]
      const { data: usersRaw } = ids.length
        ? await sb.from('users').select('id, name').in('id', ids)
        : { data: [] }
      const nameById = new Map(((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—']))

      setRows(sessions.map(s => ({ ...s, athlete_name: nameById.get(s.athlete_id) ?? '—' })))
    } finally { setLoading(false) }
  }, [coachId])
  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">Сегодня и завтра</p>
        <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Расписание</p>
            <h3 className="text-base font-bold text-navy-500 mt-1">На сегодня тренировок не запланировано</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Добавьте через календарь — попадёт в дневник атлета.</p>
          </div>
          <Link href="/calendar"
            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold">
            + В календарь
          </Link>
        </div>
      </div>
    )
  }

  // Group by date
  const byDate: Record<string, Session[]> = {}
  for (const r of rows) (byDate[r.session_date] ??= []).push(r)
  const dates = Object.keys(byDate).sort()

  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/60 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700">Расписание</p>
          <h3 className="text-base font-bold text-navy-500">Сегодня и завтра — {rows.length}</h3>
        </div>
        <Link href="/calendar" className="text-[11px] font-semibold text-orange-600 hover:underline">
          Календарь →
        </Link>
      </div>

      <div className="space-y-2">
        {dates.map(d => (
          <div key={d} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
              {dayLabel(d)} · {byDate[d].length}
            </p>
            {byDate[d].map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5">
                {s.start_time && (
                  <div className="rounded-lg bg-orange-100 text-orange-700 px-2.5 py-1 text-[11px] font-bold tabular-nums shrink-0">
                    {s.start_time.slice(0, 5)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {s.athlete_name}
                    {s.title && <span className="text-muted-foreground font-normal"> · {s.title}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.start_time && s.end_time && `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`}
                    {s.location && (s.start_time && s.end_time ? ' · ' : '') + s.location}
                  </div>
                </div>
                <Link href={`/athletes/${s.athlete_id}`}
                  className="text-[11px] font-semibold text-orange-600 hover:underline shrink-0">
                  Открыть →
                </Link>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
