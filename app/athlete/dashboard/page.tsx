'use client'
/**
 * /athlete/dashboard — Sprint W5 Day 27 (PR #44).
 *
 * Coherent athlete landing — собирает все W5 surfaces в одну страницу:
 *   1. Greeting card (today's intent)
 *   2. This week's prescribed workouts (W5 Day 24 Coach Builder output)
 *   3. Active goals (W5 Day 25 portal)
 *   4. Recent recommendations / doctor inquiries про себя
 *   5. Quick links к /athlete/goals, /athlete/progress, /calendar, /settings/notifications
 *
 * Closes activation loop — после signup atlete видит coherent next steps,
 * не пустой dashboard.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { listMyGoals, STATUS_META as GOAL_STATUS_META, type AthleteGoal } from '@/services/athlete-goals.service'
import { countMyActivePasses } from '@/services/athlete-passes.service'
import { Card } from '@/components/ui/metronic'

interface PrescribedWorkout {
  id:                    string
  event_date:            string
  activity_type:         string | null
  name:                  string | null
  activity_duration_min: number | null
  completion_status:     string | null
  prescribed_note:       string | null
}

interface RecentRec {
  id:           string
  title:        string | null
  body:         string | null
  created_at:   string
}

export default function AthleteDashboardPage() {
  const { user, loading: userLoading } = useUser()

  const [workouts, setWorkouts] = useState<PrescribedWorkout[]>([])
  const [goals, setGoals]       = useState<AthleteGoal[]>([])
  const [recs, setRecs]         = useState<RecentRec[]>([])
  const [loading, setLoading]   = useState(true)
  const [name, setName]         = useState<string | null>(null)
  /** W8 Day 39: count of currently-usable passes for the quick-link badge. */
  const [activePassesCount, setActivePassesCount] = useState<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    const { data: auth } = await sb.auth.getUser()
    if (!auth?.user) { setLoading(false); return }
    const { data: meRow } = await sb.from('users').select('id, name').eq('auth_id', auth.user.id).maybeSingle()
    const me = meRow as { id: string; name: string | null } | null
    if (!me) { setLoading(false); return }
    setName(me.name)

    // This week's prescribed workouts (today → +7 days)
    const today = new Date().toISOString().slice(0, 10)
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)

    const [workoutsRes, goalsList, recsRes, passes] = await Promise.all([
      sb
        .from('workouts')
        .select('id, event_date, activity_type, name, activity_duration_min, completion_status, prescribed_note')
        .eq('athlete_id', me.id)
        .eq('event_type', 'prescribed')
        .gte('event_date', today)
        .lte('event_date', weekEndStr)
        .order('event_date', { ascending: true })
        .limit(20),
      listMyGoals('active'),
      sb
        .from('recommendations')
        .select('id, title, body, created_at')
        .eq('athlete_id', me.id)
        .order('created_at', { ascending: false })
        .limit(5),
      countMyActivePasses(),
    ])

    setWorkouts(((workoutsRes.data ?? []) as PrescribedWorkout[]))
    setGoals(goalsList.slice(0, 3))
    setRecs(((recsRes.data ?? []) as RecentRec[]))
    setActivePassesCount(passes)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    load()
  }, [user, userLoading, load])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Войдите в аккаунт</p>
        <Link href="/auth/login?next=/athlete/dashboard" className="text-sm text-orange-600 font-semibold hover:underline">
          → Войти
        </Link>
      </div>
    )
  }

  const todayStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayWorkout = workouts.find(w => w.event_date === new Date().toISOString().slice(0, 10))
  const upcomingWorkouts = workouts.filter(w => w.event_date > new Date().toISOString().slice(0, 10))

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Greeting hero */}
      <section className="rounded-3xl border border-orange-200 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.08),_transparent_30%),linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_50%,#FFFBEB_100%)] p-6">
        <p className="text-2xs font-bold uppercase tracking-[0.22em] text-orange-700 mb-1">{todayStr}</p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          Привет, {name ?? 'атлет'} 👋
        </h1>
        {todayWorkout ? (
          <p className="mt-3 text-sm text-slate-700 max-w-2xl">
            Сегодня по плану: <strong>{todayWorkout.name ?? todayWorkout.activity_type ?? 'тренировка'}</strong>
            {todayWorkout.activity_duration_min ? ` · ${todayWorkout.activity_duration_min} мин` : ''}
            {todayWorkout.completion_status === 'completed' ? ' · ✅ выполнено' :
             todayWorkout.completion_status === 'skipped' ? ' · ⏭ пропущено' : ''}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-700">
            На сегодня запланированных тренировок нет. Хорошее время для восстановления.
          </p>
        )}
      </section>

      {/* Quick links — W8 Day 39 added /athlete/passes (5th tile) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <QuickLink href="/athlete/goals"      icon="ki-flag"          color="#EA580C" bg="#FFF7ED" border="#FED7AA" label="Цели" />
        <QuickLink href="/athlete/progress"   icon="ki-chart-line-up" color="#2563EB" bg="#EFF6FF" border="#BFDBFE" label="Прогресс" />
        <QuickLink href="/calendar"           icon="ki-calendar-2"    color="#15803D" bg="#F0FDF4" border="#BBF7D0" label="Календарь" />
        <QuickLink
          href="/athlete/passes"
          icon="ki-cup"
          color="#D97706"
          bg="#FFFBEB"
          border="#FCD34D"
          label={activePassesCount > 0 ? `Абонементы · ${activePassesCount}` : 'Абонементы'}
        />
        <QuickLink href="/settings/notifications" icon="ki-notification" color="#7C3AED" bg="#FAF5FF" border="#E9D5FF" label="Уведомления" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* This week's plan */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Эта неделя</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Назначенные тренером тренировки</p>
            </div>
            <Link href="/calendar" className="text-xs text-orange-600 font-semibold hover:underline no-underline">
              Календарь →
            </Link>
          </div>

          {workouts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-accent/30 px-4 py-8 text-center">
              <i className="ki-filled ki-calendar-tick text-3xl text-muted-foreground mb-2 block" />
              <p className="text-sm text-foreground font-semibold">На неделе нет prescribed тренировок</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Когда тренер назначит план — он появится здесь и в календаре.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {workouts.slice(0, 7).map(w => {
                const isToday = w.event_date === new Date().toISOString().slice(0, 10)
                const isPast = w.event_date < new Date().toISOString().slice(0, 10)
                return (
                  <li key={w.id} className={`flex items-center gap-3 rounded-xl border p-3 ${
                    isToday ? 'border-orange-300 bg-orange-50/40' : 'border-border bg-background'
                  }`}>
                    <div className="text-center w-12 shrink-0">
                      <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        {new Date(w.event_date).toLocaleDateString('ru-RU', { weekday: 'short' })}
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {new Date(w.event_date).getDate()}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {w.name ?? w.activity_type ?? 'Тренировка'}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {w.activity_duration_min ? `${w.activity_duration_min} мин` : '—'}
                        {w.activity_type && w.name && ` · ${w.activity_type}`}
                        {w.prescribed_note && ` · ${w.prescribed_note.slice(0, 60)}`}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {w.completion_status === 'completed' ? (
                        <span className="text-[10px] font-bold text-emerald-700">✅</span>
                      ) : w.completion_status === 'skipped' ? (
                        <span className="text-[10px] font-bold text-red-700">⏭</span>
                      ) : isPast ? (
                        <span className="text-[10px] font-bold text-amber-700">⏳</span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {upcomingWorkouts.length > 7 && (
            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              … ещё {upcomingWorkouts.length - 7} тренировок в календаре
            </p>
          )}
        </Card>

        {/* Active goals */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Цели</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Top 3 активных</p>
            </div>
            <Link href="/athlete/goals" className="text-xs text-orange-600 font-semibold hover:underline no-underline">
              Все →
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-accent/30 px-4 py-6 text-center">
              <i className="ki-filled ki-flag text-2xl text-muted-foreground mb-2 block" />
              <Link href="/athlete/goals" className="text-sm text-orange-600 font-semibold hover:underline no-underline">
                + Создать первую цель
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {goals.map(g => {
                const progressPct = g.target_value && g.current_value != null && g.target_value !== 0
                  ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100)))
                  : null
                return (
                  <li key={g.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold text-foreground line-clamp-2">{g.metric_label}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5"
                        style={{ background: GOAL_STATUS_META.active.bg, color: GOAL_STATUS_META.active.color }}>
                        🎯
                      </span>
                    </div>
                    {g.target_value !== null && (
                      <div className="text-[11px] text-muted-foreground mb-1.5">
                        Цель: {g.target_value} {g.target_unit ?? ''}
                        {g.current_value != null && ` · сейчас ${g.current_value}`}
                      </div>
                    )}
                    {progressPct !== null && (
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent recommendations */}
      {recs.length > 0 && (
        <Card className="p-5">
          <div className="mb-3">
            <h2 className="text-base font-bold text-foreground">Недавние рекомендации</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Сообщения от тренера и врача</p>
          </div>
          <ul className="space-y-2">
            {recs.slice(0, 3).map(r => (
              <li key={r.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground line-clamp-1">
                      {r.title ?? 'Рекомендация'}
                      {/* Schema W5 Day 27: doctor_id NOT NULL → all recs are from doctor. */}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        · 🩺 Врач
                      </span>
                    </div>
                    {r.body && <div className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">{r.body}</div>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function QuickLink({ href, icon, color, bg, border, label }: {
  href: string
  icon: string
  color: string
  bg: string
  border: string
  label: string
}) {
  return (
    <Link href={href} className="rounded-2xl border-2 p-3 hover:-translate-y-0.5 hover:shadow-md transition-all no-underline flex items-center gap-3"
      style={{ background: bg, borderColor: border }}>
      <i className={`ki-filled ${icon} text-xl`} style={{ color }} />
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
    </Link>
  )
}
