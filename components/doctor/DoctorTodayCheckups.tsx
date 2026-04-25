'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Checkup = {
  id: string
  athlete_id: string
  athlete_name: string
  checkup_date: string
  start_time: string | null
  end_time: string | null
  checkup_type: string
  status: string
  location: string | null
}

const TYPE_LABELS: Record<string, string> = {
  general: 'Общий',
  cardiology: 'Кардио',
  blood: 'Анализы',
  injury: 'Травма',
  mobility: 'Мобильность',
  return_to_sport: 'Возврат',
  nutrition: 'Питание',
  other: 'Другое',
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
 * Расписание врача на сегодня и завтра — из medical_checkups,
 * status='scheduled'. Группирует по дню.
 */
export default function DoctorTodayCheckups({ doctorId }: { doctorId: string }) {
  const [rows, setRows] = useState<Checkup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data } = await sb
        .from('medical_checkups')
        .select('id, athlete_id, checkup_date, start_time, end_time, checkup_type, status, location')
        .eq('doctor_id', doctorId)
        .eq('status', 'scheduled')
        .gte('checkup_date', todayISO())
        .lte('checkup_date', tomorrowISO())
        .order('checkup_date', { ascending: true })
        .order('start_time', { ascending: true })

      const checkups = (data ?? []) as Array<Omit<Checkup, 'athlete_name'>>
      const ids = [...new Set(checkups.map(c => c.athlete_id))]
      const { data: usersRaw } = ids.length
        ? await sb.from('users').select('id, name').in('id', ids)
        : { data: [] }
      const nameById = new Map(((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—']))

      setRows(checkups.map(c => ({ ...c, athlete_name: nameById.get(c.athlete_id) ?? '—' })))
    } finally { setLoading(false) }
  }, [doctorId])
  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">Приёмы</p>
        <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Приёмы</p>
            <h3 className="text-base font-bold text-foreground mt-1">На сегодня приёмов нет</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Назначьте через календарь — пациенты получат уведомление.</p>
          </div>
          <Link href="/calendar"
            className="rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-semibold">
            + В календарь
          </Link>
        </div>
      </div>
    )
  }

  const byDate: Record<string, Checkup[]> = {}
  for (const r of rows) (byDate[r.checkup_date] ??= []).push(r)
  const dates = Object.keys(byDate).sort()

  return (
    <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/60 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-700">Расписание</p>
          <h3 className="text-base font-bold text-foreground">Сегодня и завтра — {rows.length}</h3>
        </div>
        <Link href="/calendar" className="text-[11px] font-semibold text-red-600 hover:underline">
          Календарь →
        </Link>
      </div>

      <div className="space-y-2">
        {dates.map(d => (
          <div key={d} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
              {dayLabel(d)} · {byDate[d].length}
            </p>
            {byDate[d].map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5">
                {c.start_time && (
                  <div className="rounded-lg bg-red-100 text-red-700 px-2.5 py-1 text-[11px] font-bold tabular-nums shrink-0">
                    {c.start_time.slice(0, 5)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {c.athlete_name}
                    <span className="text-muted-foreground font-normal"> · {TYPE_LABELS[c.checkup_type] ?? c.checkup_type}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.start_time && c.end_time && `${c.start_time.slice(0, 5)} – ${c.end_time.slice(0, 5)}`}
                    {c.location && (c.start_time && c.end_time ? ' · ' : '') + c.location}
                  </div>
                </div>
                <Link href={`/profile/${c.athlete_id}`}
                  className="text-[11px] font-semibold text-red-600 hover:underline shrink-0">
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
