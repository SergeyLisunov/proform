'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type GroupSession = {
  id: string
  session_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  title: string
  session_type: string
  status: string
  participantCount: number
}

const TYPE_LABELS: Record<string, string> = {
  team_practice: 'Командная тренировка',
  competition:   'Соревнование',
  travel:        'Выезд',
  meeting:       'Встреча',
  camp:          'Сбор',
  other:         'Другое',
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
 * Расписание организации на сегодня и завтра — из org_group_sessions
 * c подсчётом участников. Группирует по дню.
 */
export default function OrgTodayEvents({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<GroupSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data: sessionsRaw } = await sb
        .from('org_group_sessions')
        .select('id, session_date, start_time, end_time, location, title, session_type, status')
        .eq('organization_id', orgId)
        .eq('status', 'planned')
        .gte('session_date', todayISO())
        .lte('session_date', tomorrowISO())
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true })

      const sessions = (sessionsRaw ?? []) as Array<Omit<GroupSession, 'participantCount'>>
      if (sessions.length === 0) { setRows([]); return }

      const sessionIds = sessions.map(s => s.id)
      const { data: partsRaw } = await sb
        .from('org_session_participants')
        .select('session_id')
        .in('session_id', sessionIds)
      const counts: Record<string, number> = {}
      for (const p of ((partsRaw ?? []) as Array<{ session_id: string }>)) {
        counts[p.session_id] = (counts[p.session_id] ?? 0) + 1
      }

      setRows(sessions.map(s => ({ ...s, participantCount: counts[s.id] ?? 0 })))
    } finally { setLoading(false) }
  }, [orgId])
  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">События</p>
        <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">События</p>
            <h3 className="text-base font-bold text-foreground mt-1">На сегодня командных событий нет</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Создайте через календарь — все участники получат уведомление.</p>
          </div>
          <Link href="/calendar"
            className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
            + Новое событие
          </Link>
        </div>
      </div>
    )
  }

  const byDate: Record<string, GroupSession[]> = {}
  for (const r of rows) (byDate[r.session_date] ??= []).push(r)
  const dates = Object.keys(byDate).sort()

  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700">События</p>
          <h3 className="text-base font-bold text-foreground">Сегодня и завтра — {rows.length}</h3>
        </div>
        <Link href="/calendar" className="text-[11px] font-semibold text-blue-600 hover:underline">
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
                  <div className="rounded-lg bg-blue-100 text-blue-700 px-2.5 py-1 text-[11px] font-bold tabular-nums shrink-0">
                    {s.start_time.slice(0, 5)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {s.title}
                    <span className="text-muted-foreground font-normal"> · {TYPE_LABELS[s.session_type] ?? s.session_type}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.start_time && s.end_time && `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`}
                    {s.location && (s.start_time && s.end_time ? ' · ' : '') + s.location}
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold shrink-0">
                  👥 {s.participantCount}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
