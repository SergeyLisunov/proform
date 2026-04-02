'use client'
import { PlanGuard } from '@/components/ui/Paywall'
import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import dynamic from 'next/dynamic'
import { getWorkouts, type Workout } from '@/services/workouts.service'
import { recoveryColor } from '@/lib/utils/data'
import { createBrowserClient } from '@supabase/ssr'

const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ZC = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444']
const PERIOD_OPTS = [
  { label: '7д', days: 7 },
  { label: '30д', days: 30 },
  { label: '90д', days: 90 },
]

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return toISO(d)
}

// ── ATHLETE ANALYTICS ────────────────────────────────────────────────────────
function AthleteAnalytics({ userId, name }: { userId: string; name: string }) {
  const [period, setPeriod] = useState(PERIOD_OPTS[0])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = daysAgo(period.days)
    const to   = toISO(new Date())
    import('@/services/workouts.service').then(({ getWorkoutsRange }) => {
      getWorkoutsRange(userId, from, to).then(data => {
        setWorkouts(data)
        setLoading(false)
      })
    })
  }, [userId, period])

  // Метрики
  const avgRecovery = workouts.filter(w => w.recovery_score != null).length
    ? Math.round(workouts.reduce((s, w) => s + (w.recovery_score ?? 0), 0) / workouts.filter(w => w.recovery_score != null).length)
    : null
  const avgHRV = workouts.filter(w => w.hrv != null).length
    ? (workouts.reduce((s, w) => s + (w.hrv ?? 0), 0) / workouts.filter(w => w.hrv != null).length)
    : null
  const avgStrain = workouts.filter(w => w.activity_strain != null).length
    ? (workouts.reduce((s, w) => s + (w.activity_strain ?? 0), 0) / workouts.filter(w => w.activity_strain != null).length)
    : null
  const totalMin = workouts.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)

  // Зоны пульса суммарно
  const zones = [
    workouts.reduce((s, w) => s + (w.hr_zone_1_min ?? 0), 0),
    workouts.reduce((s, w) => s + (w.hr_zone_2_min ?? 0), 0),
    workouts.reduce((s, w) => s + (w.hr_zone_3_min ?? 0), 0),
    workouts.reduce((s, w) => s + (w.hr_zone_4_min ?? 0), 0),
    workouts.reduce((s, w) => s + (w.hr_zone_5_min ?? 0), 0),
  ]
  const hasZones = zones.some(z => z > 0)

  // Дневной тренд (последние 14 тренировок)
  const trend = workouts.slice(0, 14).reverse()
  const trendDays = trend.map(w => (w.event_date ?? '').slice(5)) // MM-DD

  const areaOpts = {
    chart: { type: 'area' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    colors: ['#F97316', '#16A34A'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.12, opacityTo: 0.0 } },
    xaxis: { categories: trendDays, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: [{ labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }, { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const donutOpts = {
    chart: { type: 'donut' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ZC,
    labels: ['Z1 Восстановление', 'Z2 Аэробная', 'Z3 Темп', 'Z4 Порог', 'Z5 VO₂max'],
    legend: { position: 'bottom' as const, fontSize: '12px', fontFamily: 'DM Sans' },
    plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Итого мин', fontSize: '11px', fontFamily: 'DM Sans', color: '#A1A1AA' } } } } },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  return (
    <PlanGuard requiredPlan="pro" feature="analytics"
      title="Полная аналитика"
      description="Детальные графики восстановления, нагрузки и зон пульса доступны на плане Pro">
      <div className="flex flex-col gap-5 pf-enter">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              {name}
            </p>
            <h2 className="pf-num text-[36px] text-foreground leading-none">Аналитика</h2>
          </div>
          <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
            {PERIOD_OPTS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-2sm font-medium transition-all ${period.label === p.label ? 'bg-orange-50 text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Ср. восстановление', value: avgRecovery != null ? `${avgRecovery}%` : '—', bg: 'bg-green-50 text-green-600',  icon: 'ki-abstract-26' },
            { label: 'Ср. HRV',            value: avgHRV     != null ? `${avgHRV.toFixed(0)} ms` : '—', bg: 'bg-blue-50 text-blue-600',   icon: 'ki-heart-circle' },
            { label: 'Ср. нагрузка',       value: avgStrain  != null ? avgStrain.toFixed(1) : '—', bg: 'bg-orange-50 text-orange-500', icon: 'ki-chart-line-up' },
            { label: 'Тренировок',          value: workouts.length, bg: 'bg-violet-50 text-violet-600', icon: 'ki-calendar' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                <i className={`ki-filled ${s.icon} text-base`} />
              </div>
              <div>
                <div className="pf-num text-2xl text-foreground">{loading ? '…' : s.value}</div>
                <div className="text-2xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Тренд нагрузки и восстановления */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Нагрузка и восстановление</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">Тренд за период</p>
            </div>
            {!loading && trend.length > 0 ? (
              <ApexChart type="area"
                series={[
                  { name: 'Нагрузка',          data: trend.map(w => w.activity_strain ?? 0) },
                  { name: 'Восстановление %',   data: trend.map(w => w.recovery_score ?? 0) },
                ]}
                options={areaOpts} height={200} />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-2sm">
                {loading ? 'Загрузка…' : 'Нет данных за период'}
              </div>
            )}
          </div>

          {/* Зоны пульса */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Распределение по зонам пульса</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">Суммарное время в каждой зоне</p>
            </div>
            {hasZones ? (
              <>
                <ZoneBar zones={zones} height={28} showLabels />
                <ApexChart type="donut" series={zones} options={donutOpts} height={180} />
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-2sm">
                {loading ? 'Загрузка…' : 'Нет данных о зонах пульса'}
              </div>
            )}
          </div>

          {/* Список тренировок */}
          <div className="xl:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Тренировки за период</h3>
              <span className="text-2xs text-muted-foreground">{workouts.length} записей · {Math.round(totalMin / 60)} ч суммарно</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
              </div>
            ) : workouts.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-2sm">
                Тренировок за выбранный период нет
              </div>
            ) : (
              <div className="divide-y divide-border">
                {workouts.slice(0, 10).map(w => {
                  const rc = recoveryColor(w.recovery_score ?? 50)
                  return (
                    <div key={w.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors">
                      <div className="text-2xs text-muted-foreground shrink-0 w-16">{(w.event_date ?? '').slice(5)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2sm font-semibold text-foreground truncate">
                          {w.name ?? w.activity_type ?? 'Тренировка'}
                        </div>
                        {w.activity_duration_min && (
                          <div className="text-2xs text-muted-foreground">{w.activity_duration_min} мин</div>
                        )}
                      </div>
                      {w.activity_strain != null && (
                        <div className="text-right shrink-0">
                          <div className="pf-num text-sm font-bold text-foreground">{w.activity_strain.toFixed(1)}</div>
                          <div className="text-[9px] text-muted-foreground">strain</div>
                        </div>
                      )}
                      {w.recovery_score != null && (
                        <div className="text-right shrink-0">
                          <div className="pf-num text-sm font-bold" style={{ color: rc }}>{w.recovery_score}%</div>
                          <div className="text-[9px] text-muted-foreground">recovery</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PlanGuard>
  )
}

// ── COACH ANALYTICS ──────────────────────────────────────────────────────────
type AthleteStats = {
  id: string; name: string; sport_type: string | null
  recovery: number | null; hrv: number | null; sessions: number; totalStrain: number
}

function CoachAnalytics({ userId }: { userId: string }) {
  const [period, setPeriod] = useState(PERIOD_OPTS[1])
  const [athletes, setAthletes] = useState<AthleteStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: users } = await sb().from('users').select('id, name, sport_type').eq('role', 'athlete').limit(20)
      if (!users) { setLoading(false); return }

      const from = daysAgo(period.days)
      const to   = toISO(new Date())

      const rows: AthleteStats[] = await Promise.all(
        users.map(async u => {
          const { data: wData } = await sb()
            .from('workouts')
            .select('recovery_score, hrv, activity_strain, id')
            .eq('athlete_id', u.id)
            .gte('event_date', from)
            .lte('event_date', to)
          const ws = wData ?? []
          const withRecovery = ws.filter(w => w.recovery_score != null)
          const withHRV      = ws.filter(w => w.hrv != null)
          return {
            id:          u.id,
            name:        u.name,
            sport_type:  u.sport_type,
            recovery:    withRecovery.length ? Math.round(withRecovery.reduce((s, w) => s + w.recovery_score, 0) / withRecovery.length) : null,
            hrv:         withHRV.length      ? parseFloat((withHRV.reduce((s, w) => s + w.hrv, 0) / withHRV.length).toFixed(1)) : null,
            sessions:    ws.length,
            totalStrain: parseFloat(ws.reduce((s, w) => s + (w.activity_strain ?? 0), 0).toFixed(1)),
          }
        })
      )
      setAthletes(rows)
      setLoading(false)
    }
    load()
  }, [period])

  const avgRecovery = athletes.filter(a => a.recovery != null).length
    ? Math.round(athletes.reduce((s, a) => s + (a.recovery ?? 0), 0) / athletes.filter(a => a.recovery != null).length)
    : null
  const atRisk = athletes.filter(a => (a.recovery ?? 100) < 40).length
  const totalSessions = athletes.reduce((s, a) => s + a.sessions, 0)

  const radarOpts = {
    chart: { type: 'radar' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ['#2563EB', '#F97316', '#16A34A', '#7C3AED', '#EC4899', '#14B8A6'],
    xaxis: { categories: ['Нагрузка', 'HRV', 'Восстановление', 'Тренировки'] },
    yaxis: { show: false },
    grid: { padding: { top: 10, bottom: 10 } },
    legend: { position: 'bottom' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const barOpts = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 5 } },
    colors: ['#F97316'],
    xaxis: {
      categories: athletes.map(a => a.name.split(' ')[0]),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, max: 100 },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  // Нормализуем для радара (0-100)
  const maxStrain = Math.max(...athletes.map(a => a.totalStrain), 1)
  const maxHRV    = Math.max(...athletes.map(a => a.hrv ?? 0), 1)
  const maxSess   = Math.max(...athletes.map(a => a.sessions), 1)

  return (
    <PlanGuard requiredPlan="team" feature="analytics"
      title="Аналитика команды"
      description="Сравнение атлетов и командные метрики доступны на плане Team">
      <div className="flex flex-col gap-5 pf-enter">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Аналитика команды</p>
            <h2 className="pf-num text-[36px] text-foreground leading-none">Аналитика тренера</h2>
          </div>
          <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
            {PERIOD_OPTS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-2sm font-medium transition-all ${period.label === p.label ? 'bg-orange-50 text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Атлеты',             value: loading ? '…' : athletes.length,                     bg: 'bg-blue-50 text-blue-600',    icon: 'ki-people' },
            { label: 'Ср. восстановление', value: loading ? '…' : avgRecovery != null ? `${avgRecovery}%` : '—', bg: 'bg-green-50 text-green-600',   icon: 'ki-abstract-26' },
            { label: 'В зоне риска',       value: loading ? '…' : atRisk,                               bg: atRisk > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600', icon: 'ki-warning-2' },
            { label: 'Всего тренировок',   value: loading ? '…' : totalSessions,                        bg: 'bg-violet-50 text-violet-600', icon: 'ki-calendar' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                <i className={`ki-filled ${s.icon} text-base`} />
              </div>
              <div>
                <div className="pf-num text-2xl text-foreground">{s.value}</div>
                <div className="text-2xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Карточки атлетов */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {athletes.map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-orange-200 transition-all">
                <RecoveryRing score={a.recovery ?? 0} size={72} />
                <div className="text-center">
                  <div className="text-2sm font-semibold text-foreground">{a.name.split(' ')[0]}</div>
                  <div className="text-2xs text-muted-foreground">{a.sport_type ?? '—'}</div>
                </div>
                <div className="flex gap-3 text-center w-full">
                  <div className="flex-1">
                    <div className="text-2xs font-bold text-blue-600">{a.hrv ?? '—'}</div>
                    <div className="text-[9px] text-muted-foreground">HRV</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-2xs font-bold text-foreground">{a.sessions}</div>
                    <div className="text-[9px] text-muted-foreground">тренировок</div>
                  </div>
                </div>
              </div>
            ))}
            {athletes.length === 0 && (
              <div className="col-span-4 flex items-center justify-center py-10 text-muted-foreground text-2sm">
                Нет атлетов с данными за выбранный период
              </div>
            )}
          </div>
        )}

        {/* Charts */}
        {!loading && athletes.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">Восстановление атлетов</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">Средний % за период</p>
              </div>
              <ApexChart type="bar"
                series={[{ name: 'Восстановление %', data: athletes.map(a => a.recovery ?? 0) }]}
                options={barOpts} height={220} />
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">Сравнение нагрузок (радар)</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">Нормализованные метрики</p>
              </div>
              <ApexChart type="radar"
                series={athletes.slice(0, 6).map(a => ({
                  name: a.name.split(' ')[0],
                  data: [
                    Math.round((a.totalStrain / maxStrain) * 100),
                    Math.round(((a.hrv ?? 0) / maxHRV) * 100),
                    a.recovery ?? 0,
                    Math.round((a.sessions / maxSess) * 100),
                  ],
                }))}
                options={radarOpts} height={220} />
            </div>
          </div>
        )}
      </div>
    </PlanGuard>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useUser()
  if (!user) return null
  if (user.role === 'coach' || user.role === 'organization') return <CoachAnalytics userId={user.id} />
  return <AthleteAnalytics userId={user.id} name={user.name} />
}
