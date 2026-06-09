'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const WorkoutCommentsDrawer = dynamic(
  () => import('@/components/workout/WorkoutCommentsDrawer'),
  { ssr: false }
)

type Row = {
  id: string
  athlete_id: string
  athlete_name: string
  activity_type: string | null
  name: string | null
  event_date: string
  activity_duration_min: number | null
  comments_count: number
  last_commented_at: string | null
  i_commented: boolean
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtDur(min: number | null | undefined): string {
  if (!min) return ''
  return min < 60 ? `${min} мин` : `${Math.floor(min / 60)}ч${min % 60 ? ` ${min % 60}м` : ''}`
}

export default function CoachFeedbackFeed({ coachId }: { coachId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [openFor, setOpenFor] = useState<{ id: string; title: string | null } | null>(null)
  const [filter, setFilter] = useState<'all' | 'uncommented'>('all')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      const sb = createClient()
      // 1. coach's athletes
      const { data: linksRaw } = await sb
        .from('trainer_athletes')
        .select('athlete_id')
        .eq('trainer_id', coachId)
        .eq('status', 'accepted')
      const links = (linksRaw ?? []) as Array<{ athlete_id: string }>
      const athleteIds = links.map(l => l.athlete_id)
      if (athleteIds.length === 0) {
        if (mounted) { setRows([]); setLoading(false) }
        return
      }

      // 2. last 20 workouts across these athletes
      const { data: wRaw } = await sb
        .from('workouts')
        .select('id, athlete_id, activity_type, name, event_date, activity_duration_min')
        .in('athlete_id', athleteIds)
        .order('event_date', { ascending: false })
        .limit(20)
      const workouts = (wRaw ?? []) as Array<{
        id: string; athlete_id: string; activity_type: string | null;
        name: string | null; event_date: string; activity_duration_min: number | null
      }>
      if (workouts.length === 0) {
        if (mounted) { setRows([]); setLoading(false) }
        return
      }

      // 3. athlete names
      const { data: usersRaw } = await sb
        .from('users')
        .select('id, name')
        .in('id', athleteIds)
      const nameById = new Map(
        ((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
          .map(u => [u.id, u.name ?? '—'])
      )

      // 4. comments aggregation
      const workoutIds = workouts.map(w => w.id)
      const { data: commentsRaw } = await sb
        .from('workout_comments')
        .select('workout_id, author_id, created_at')
        .in('workout_id', workoutIds)
      const comments = (commentsRaw ?? []) as Array<{
        workout_id: string; author_id: string; created_at: string
      }>
      const byWorkout: Record<string, { count: number; last: string; mine: boolean }> = {}
      for (const c of comments) {
        const b = byWorkout[c.workout_id] ?? { count: 0, last: c.created_at, mine: false }
        b.count += 1
        if (c.created_at > b.last) b.last = c.created_at
        if (c.author_id === coachId) b.mine = true
        byWorkout[c.workout_id] = b
      }

      const built: Row[] = workouts.map(w => ({
        id: w.id,
        athlete_id: w.athlete_id,
        athlete_name: nameById.get(w.athlete_id) ?? '—',
        activity_type: w.activity_type,
        name: w.name,
        event_date: w.event_date,
        activity_duration_min: w.activity_duration_min,
        comments_count: byWorkout[w.id]?.count ?? 0,
        last_commented_at: byWorkout[w.id]?.last ?? null,
        i_commented: byWorkout[w.id]?.mine ?? false,
      }))
      if (mounted) { setRows(built); setLoading(false) }
    })()
    return () => { mounted = false }
  }, [coachId])

  const filtered = useMemo(
    () => filter === 'uncommented' ? rows.filter(r => !r.i_commented) : rows,
    [rows, filter]
  )

  const uncommentedCount = rows.filter(r => !r.i_commented).length

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <i className="ki-filled ki-chat text-2xl text-slate-300" />
        <p className="text-sm font-medium text-slate-600 mt-2">Нет тренировок атлетов</p>
        <p className="text-xs text-slate-400 mt-1">Пригласите атлетов в сеть — здесь появятся их последние тренировки для обратной связи.</p>
        <Link href="/network" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-orange-600 hover:underline">
          Перейти в сеть <i className="ki-filled ki-arrow-right" style={{ fontSize: 10 }} />
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Обратная связь</p>
            <h3 className="text-base font-semibold text-navy-500 mt-0.5">Последние тренировки атлетов</h3>
          </div>
          <div className="flex items-center gap-2">
            {uncommentedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                {uncommentedCount} без комментария
              </span>
            )}
            <button
              onClick={() => setFilter(f => f === 'all' ? 'uncommented' : 'all')}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 border border-border rounded-full px-2.5 py-1"
            >
              {filter === 'all' ? 'Без ответа' : 'Все'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtered.slice(0, 10).map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: r.i_commented ? '#F0FDF4' : '#FEF0E7' }}
              >
                <i
                  className={`ki-filled ${r.i_commented ? 'ki-check-circle' : 'ki-abstract-26'} text-sm`}
                  style={{ color: r.i_commented ? '#16A34A' : '#D44A02' }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{r.athlete_name}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500">{fmtDate(r.event_date)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 truncate">
                    {r.name || r.activity_type || 'Тренировка'}
                    {r.activity_duration_min ? ` · ${fmtDur(r.activity_duration_min)}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.comments_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    <i className="ki-filled ki-message-text-2" style={{ fontSize: 9 }} />
                    {r.comments_count}
                  </span>
                )}
                <button
                  onClick={() => setOpenFor({ id: r.id, title: r.name ?? r.activity_type ?? 'Тренировка' })}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 text-[11px] font-semibold transition-colors"
                >
                  <i className="ki-filled ki-chat" style={{ fontSize: 10 }} />
                  {r.i_commented ? 'Открыть' : 'Ответить'}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-6 text-center text-xs text-slate-400">
              Все тренировки прокомментированы <i className="ki-filled ki-focus text-xs" />
            </div>
          )}
        </div>
      </div>

      <WorkoutCommentsDrawer
        workoutId={openFor?.id ?? null}
        workoutTitle={openFor?.title ?? null}
        currentUserId={coachId}
        onClose={() => setOpenFor(null)}
      />
    </>
  )
}
