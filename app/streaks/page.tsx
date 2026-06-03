'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/lib/hooks/useToast'

type Workout = {
  event_date: string
  activity_type: string | null
  activity_duration_min: number | null
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // Mon=0
  return addDays(d, -dow)
}

type Stats = {
  total: number
  totalMinutes: number
  currentStreak: number
  longestStreak: number
  daysActive: number
  firstDate: string | null
  uniqueTypes: number
  topType: string | null
  weeksActive: number
  weekHeatmap: { date: string; count: number }[][]
}

function computeStats(workouts: Workout[]): Stats {
  const total = workouts.length
  const totalMinutes = workouts.reduce((a, w) => a + (w.activity_duration_min ?? 0), 0)

  const datesSet = new Set(workouts.map(w => w.event_date))
  const daysActive = datesSet.size

  // streaks
  const sortedDates = Array.from(datesSet).sort()
  let longestStreak = 0
  let run = 0
  let prev: Date | null = null
  for (const ds of sortedDates) {
    const d = new Date(ds + 'T00:00:00')
    if (!prev) run = 1
    else {
      const diff = Math.round((d.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      run = diff === 1 ? run + 1 : 1
    }
    longestStreak = Math.max(longestStreak, run)
    prev = d
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  // current streak: scan backwards from today (or yesterday if today not done yet)
  let cur = 0
  let cursor = new Date(today)
  if (!datesSet.has(iso(cursor))) cursor = addDays(cursor, -1)
  while (datesSet.has(iso(cursor))) {
    cur++
    cursor = addDays(cursor, -1)
  }
  const currentStreak = cur

  // types
  const typeCounts = new Map<string, number>()
  for (const w of workouts) {
    const k = w.activity_type || 'other'
    typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1)
  }
  const types = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])
  const uniqueTypes = types.length
  const topType = types[0]?.[0] ?? null

  // heatmap: last 12 weeks, 7 days each
  const countByDate = new Map<string, number>()
  for (const w of workouts) {
    countByDate.set(w.event_date, (countByDate.get(w.event_date) ?? 0) + 1)
  }
  const lastWeekStart = startOfWeek(today)
  const weekHeatmap: { date: string; count: number }[][] = []
  for (let wi = 11; wi >= 0; wi--) {
    const wkStart = addDays(lastWeekStart, -wi * 7)
    const week: { date: string; count: number }[] = []
    for (let di = 0; di < 7; di++) {
      const day = addDays(wkStart, di)
      const ds = iso(day)
      week.push({ date: ds, count: day <= today ? (countByDate.get(ds) ?? 0) : -1 })
    }
    weekHeatmap.push(week)
  }

  // weeks active (non-empty weeks in last 12)
  const weeksActive = weekHeatmap.filter(w => w.some(d => d.count > 0)).length

  return {
    total, totalMinutes,
    currentStreak, longestStreak, daysActive,
    firstDate: sortedDates[0] ?? null,
    uniqueTypes, topType, weeksActive,
    weekHeatmap,
  }
}

type Badge = {
  id: string
  title: string
  subtitle: string
  icon: string
  color: string
  earned: boolean
  progress: number // 0..1
  progressLabel: string
}

function buildBadges(s: Stats | null): Badge[] {
  if (!s) return []
  const mk = (
    id: string, title: string, icon: string, color: string,
    current: number, target: number, unit: string,
  ): Badge => {
    const earned = current >= target
    const progress = Math.max(0, Math.min(1, current / target))
    const subtitle = earned
      ? `Получено · ${target} ${unit}`
      : `${current}/${target} ${unit}`
    return { id, title, subtitle, icon, color, earned, progress, progressLabel: `${current}/${target}` }
  }

  return [
    // Streaks
    mk('streak3',   '3 дня подряд',    'ki-flash-circle',  '#F35703', s.currentStreak, 3,   'дней'),
    mk('streak7',   'Неделя подряд',   'ki-flash-circle',  '#F59E0B', s.currentStreak, 7,   'дней'),
    mk('streak14',  'Две недели',      'ki-crown-2',       '#EF4444', s.currentStreak, 14,  'дней'),
    mk('streak30',  'Месяц без пропусков','ki-crown',      '#DC2626', s.currentStreak, 30,  'дней'),
    mk('streakLongest100', 'Легенда · 100 дней', 'ki-medal', '#7C3AED', s.longestStreak, 100, 'дней'),
    // Volume
    mk('sessions10',  '10 тренировок',  'ki-barbell',       '#16A34A', s.total, 10,  'сессий'),
    mk('sessions50',  '50 тренировок',  'ki-barbell',       '#059669', s.total, 50,  'сессий'),
    mk('sessions100', '100 сессий',     'ki-barbell',       '#047857', s.total, 100, 'сессий'),
    mk('sessions500', '500 сессий',     'ki-medal',         '#065F46', s.total, 500, 'сессий'),
    // Time
    mk('hours10', '10 часов тренировок',  'ki-time', '#0EA5E9', Math.floor(s.totalMinutes / 60), 10,  'часов'),
    mk('hours50', '50 часов тренировок',  'ki-time', '#0284C7', Math.floor(s.totalMinutes / 60), 50,  'часов'),
    mk('hours100','100 часов',            'ki-time', '#0369A1', Math.floor(s.totalMinutes / 60), 100, 'часов'),
    // Variety
    mk('types3',  '3 вида активности',    'ki-dots-circle-vertical', '#8B5CF6', s.uniqueTypes, 3, 'типов'),
    mk('types5',  '5 видов активности',   'ki-dots-circle-vertical', '#7C3AED', s.uniqueTypes, 5, 'типов'),
    // Active weeks
    mk('weeks4',  '4 активные недели (из 12)', 'ki-calendar', '#06B6D4', s.weeksActive, 4, 'недель'),
    mk('weeks8',  '8 активных недель',          'ki-calendar', '#0891B2', s.weeksActive, 8, 'недель'),
    mk('weeks12', '12 активных недель подряд',  'ki-calendar-tick', '#0E7490', s.weeksActive, 12, 'недель'),
    // Days ever
    mk('firsts',  'Первая тренировка', 'ki-rocket', '#10B981', s.total > 0 ? 1 : 0, 1, ''),
  ]
}

function heatColor(count: number): string {
  if (count < 0) return 'bg-muted/20'
  if (count === 0) return 'bg-muted/40'
  if (count === 1) return 'bg-emerald-200'
  if (count === 2) return 'bg-emerald-400'
  return 'bg-emerald-600'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function StreaksPage() {
  const { error } = useToast()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)

  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setWorkouts([]); return }
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!me) { setWorkouts([]); return }
      const { data, error: err } = await (supabase as any)
        .from('workouts')
        .select('event_date, activity_type, activity_duration_min')
        .eq('athlete_id', me.id)
        .order('event_date', { ascending: true })
      if (err) { error(err.message); setWorkouts([]); return }
      setWorkouts((data ?? []) as Workout[])
    })()
  }, [supabase, error])

  const stats = useMemo(() => workouts ? computeStats(workouts) : null, [workouts])
  const badges = useMemo(() => buildBadges(stats), [stats])
  const earnedCount = badges.filter(b => b.earned).length

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(243,87,3,0.16),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-600">
            Стрик & достижения
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-navy-500">
            {stats ? (
              <>🔥 Серия {stats.currentStreak} {stats.currentStreak === 1 ? 'день' :
                stats.currentStreak < 5 ? 'дня' : 'дней'}</>
            ) : 'Загрузка…'}
          </h1>
          <p className="max-w-[680px] text-sm text-muted-foreground">
            Каждый день тренировки = +1 к серии. Пропуск обнуляет счётчик.
            Собирайте бейджи — в профиле видно достижения.
          </p>
        </div>
      </section>

      {/* KPIs */}
      {stats && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI label="Текущая серия" value={stats.currentStreak} suffix="дн." icon="ki-flash" color="#F35703" />
          <KPI label="Рекорд серии" value={stats.longestStreak} suffix="дн." icon="ki-crown" color="#EF4444" />
          <KPI label="Всего тренировок" value={stats.total} icon="ki-barbell" color="#16A34A" />
          <KPI label="Всего часов" value={Math.round(stats.totalMinutes / 60)} icon="ki-time" color="#0EA5E9" />
          <KPI label="Дней активно" value={stats.daysActive} icon="ki-calendar" color="#7C3AED" />
          <KPI label="Видов активности" value={stats.uniqueTypes} icon="ki-dots-circle-vertical" color="#8B5CF6" />
          <KPI label="Акт. недель (из 12)" value={stats.weeksActive} icon="ki-calendar-tick" color="#06B6D4" />
          <KPI label="Первая запись" value={fmtDate(stats.firstDate)} icon="ki-rocket" color="#10B981" small />
        </section>
      )}

      {/* Heatmap */}
      {stats && (
        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Карта активности · 12 недель
            </div>
            <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>реже</span>
              <span className="h-3 w-3 rounded-sm bg-muted/40" />
              <span className="h-3 w-3 rounded-sm bg-emerald-200" />
              <span className="h-3 w-3 rounded-sm bg-emerald-400" />
              <span className="h-3 w-3 rounded-sm bg-emerald-600" />
              <span>чаще</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-1">
              {stats.weekHeatmap.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map(d => (
                    <div
                      key={d.date}
                      className={`h-4 w-4 rounded-sm ${heatColor(d.count)}`}
                      title={`${d.date}: ${d.count < 0 ? 'будущее' : d.count === 0 ? '—' : `${d.count} сессий`}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Badges */}
      {stats && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Бейджи · {earnedCount} из {badges.length}
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {badges.map(b => (
              <li
                key={b.id}
                className={`rounded-2xl border p-4 shadow-sm transition ${
                  b.earned
                    ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
                    : 'border-border bg-card opacity-80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${
                      b.earned ? '' : 'grayscale'
                    }`}
                    style={{ background: `${b.color}22` }}
                  >
                    <i className={`ki-filled ${b.icon} text-[22px]`} style={{ color: b.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold ${b.earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {b.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{b.subtitle}</div>
                  </div>
                </div>
                {!b.earned && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(b.progress * 100)}%`, background: b.color }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function KPI({
  label, value, suffix, icon, color, small,
}: {
  label: string; value: React.ReactNode; suffix?: string
  icon: string; color: string; small?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
          <i className={`ki-filled ${icon} text-[14px]`} style={{ color }} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className={`pf-num mt-1 font-bold text-foreground ${small ? 'text-sm' : 'text-xl'}`}>
        {value}{suffix ? <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  )
}
