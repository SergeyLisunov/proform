'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import dynamic from 'next/dynamic'
import { getWorkouts, type Workout } from '@/services/workouts.service'
import { recoveryColor } from '@/lib/utils/data'
import { createBrowserClient } from '@supabase/ssr'

const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })
const AthleteProfileCard = dynamic(() => import('@/components/ui/AthleteProfileCard'), { ssr: false })

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const weekLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const sparkOpts = (color: string) => ({
  chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth' as const, width: 2, colors: [color] },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.0 } },
  colors: [color],
  tooltip: { enabled: false },
  dataLabels: { enabled: false },
})

function StatCard({ label, value, unit, icon, iconBg, delta, sub, sparkData, sparkColor }: {
  label: string; value: string | number; unit?: string; icon: string; iconBg: string
  delta?: number; sub?: string; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-2sm text-muted-foreground font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="pf-num text-4xl text-foreground leading-none">{value}</span>
        {unit && <span className="text-sm text-muted-foreground mb-0.5 font-medium">{unit}</span>}
        {delta !== undefined && (
          <span className={`text-2xs font-bold ml-auto mb-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {sparkData && sparkColor && (
        <div className="-mx-1">
          <ApexChart type="area" series={[{ data: sparkData }]} options={sparkOpts(sparkColor)} height={48} />
        </div>
      )}
      {sub && <p className="text-2xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function getActivityIcon(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('run') || t.includes('бег')) return 'ki-geolocation'
  if (t.includes('swim') || t.includes('плав')) return 'ki-abstract-26'
  if (t.includes('cycl') || t.includes('велос') || t.includes('bike')) return 'ki-abstract-31'
  if (t.includes('strength') || t.includes('силов') || t.includes('gym')) return 'ki-abstract-14'
  return 'ki-abstract-26'
}

// ── ATHLETE DASHBOARD ────────────────────────────────────────────────────────
function AthleteDash({ userId, name }: { userId: string; name: string }) {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkouts(userId).then(data => {
      setWorkouts(data)
      setLoading(false)
    })
  }, [userId])

  const lastRecovery = workouts[0]?.recovery_score ?? null

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <AthleteProfileCard />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Дашборд атлета
          </p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">
            Привет, {name.split(' ')[0]} 🏃
          </h2>
        </div>
        {lastRecovery !== null && <RecoveryRing score={lastRecovery} size={100} />}
      </div>

      {/* Recent Sessions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Последние тренировки</h3>
          <Link href="/diary" className="text-2xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
            Все →
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <i className="ki-filled ki-abstract-26 text-2xl text-muted-foreground/30" />
            <p className="text-2sm text-muted-foreground">Тренировок пока нет</p>
            <Link href="/diary" className="mt-1 kt-btn kt-btn-sm kt-btn-outline gap-1.5">
              <i className="ki-filled ki-plus text-xs" />Добавить
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {workouts.slice(0, 5).map(w => {
              const zones = [
                w.hr_zone_1_min ?? 0, w.hr_zone_2_min ?? 0, w.hr_zone_3_min ?? 0,
                w.hr_zone_4_min ?? 0, w.hr_zone_5_min ?? 0,
              ]
              const hasZones = zones.some(z => z > 0)
              return (
                <div key={w.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                    <i className={`ki-filled ${getActivityIcon(w.activity_type)} text-orange-500 text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {w.name ?? w.activity_type ?? 'Тренировка'}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {w.activity_duration_min ? `${w.activity_duration_min} мин · ` : ''}
                      {w.event_date}
                    </div>
                  </div>
                  {hasZones && <ZoneBar zones={zones} height={28} />}
                  {w.activity_strain != null && (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-foreground pf-num">{w.activity_strain.toFixed(1)}</div>
                      <div className="text-2xs text-muted-foreground">strain</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── COACH DASHBOARD ──────────────────────────────────────────────────────────
type AthleteRow = {
  id: string; name: string; role: string; sport_type: string | null
  recovery_score: number | null; hrv: number | null; workouts_count: number
}

function CoachDash({ userId, name }: { userId: string; name: string }) {
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await sb()
        .from('users')
        .select('id, name, role, sport_type')
        .eq('role', 'athlete')
        .limit(20)
      if (!data) { setLoading(false); return }

      // Для каждого атлета подгружаем последнюю тренировку
      const rows: AthleteRow[] = await Promise.all(
        data.map(async a => {
          const { data: wData } = await sb()
            .from('workouts')
            .select('recovery_score, hrv, id')
            .eq('athlete_id', a.id)
            .order('event_date', { ascending: false })
            .limit(10)
          const lastWithRecovery = (wData ?? []).find(w => w.recovery_score != null)
          const lastWithHRV      = (wData ?? []).find(w => w.hrv != null)
          return {
            id:             a.id,
            name:           a.name,
            role:           a.role,
            sport_type:     a.sport_type,
            recovery_score: lastWithRecovery?.recovery_score ?? null,
            hrv:            lastWithHRV?.hrv ?? null,
            workouts_count: wData?.length ?? 0,
          }
        })
      )
      setAthletes(rows)
      setLoading(false)
    }
    load()
  }, [userId])

  const avgRecovery = athletes.filter(a => a.recovery_score != null).length
    ? Math.round(athletes.reduce((s, a) => s + (a.recovery_score ?? 0), 0) / athletes.filter(a => a.recovery_score != null).length)
    : null
  const alerts = athletes.filter(a => (a.recovery_score ?? 100) < 40).length

  const barOpts = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 6 } },
    colors: ['#F97316'],
    xaxis: {
      categories: athletes.map(a => a.name.split(' ')[0]),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, max: 100 },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    tooltip: { theme: 'light' },
    dataLabels: { enabled: false },
  }

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Тренер</p>
        <h2 className="pf-num text-[36px] text-foreground leading-none">
          Привет, {name.split(' ')[0]} 👋
        </h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Атлеты',         value: loading ? '…' : athletes.length.toString(), icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Ср. восстановление', value: loading ? '…' : avgRecovery != null ? `${avgRecovery}%` : '—', icon: 'ki-abstract-26', bg: 'bg-green-50 text-green-600' },
          { label: 'Тренировок (посл.)', value: loading ? '…' : athletes.reduce((s, a) => s + a.workouts_count, 0).toString(), icon: 'ki-calendar', bg: 'bg-orange-50 text-orange-500' },
          { label: 'Предупреждения', value: loading ? '…' : alerts.toString(), icon: 'ki-notification', bg: alerts > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Статус атлетов</h3>
            <Link href="/athletes" className="text-2xs font-semibold text-orange-500 hover:text-orange-600">Управление →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
            </div>
          ) : athletes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <i className="ki-filled ki-people text-2xl text-muted-foreground/30" />
              <p className="text-2sm text-muted-foreground">Атлетов пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {athletes.map(a => {
                const rc = recoveryColor(a.recovery_score ?? 0)
                const score = a.recovery_score
                const status = score == null ? 'unknown' : score < 40 ? 'warning' : score > 65 ? 'good' : 'ok'
                const statusIcon  = status === 'good' ? 'ki-check-circle' : status === 'warning' ? 'ki-warning-2' : status === 'ok' ? 'ki-information-2' : 'ki-minus-circle'
                const statusColor = status === 'good' ? 'text-green-500' : status === 'warning' ? 'text-orange-500' : 'text-blue-500'
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num"
                      style={{ background: rc + '20', color: rc }}>
                      {a.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{a.name}</div>
                      <div className="text-2xs text-muted-foreground">{a.sport_type ?? 'Спорт не указан'}</div>
                    </div>
                    <div className="text-right">
                      <div className="pf-num text-lg leading-none" style={{ color: rc }}>
                        {score != null ? `${score}%` : '—'}
                      </div>
                      <div className="text-2xs text-muted-foreground">восстановление</div>
                    </div>
                    {a.hrv != null && (
                      <div className="w-28 hidden sm:block">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs text-muted-foreground">HRV</span>
                          <span className="text-2xs font-bold text-foreground">{a.hrv.toFixed(1)} ms</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                        </div>
                      </div>
                    )}
                    <i className={`ki-filled ${statusIcon} text-base ${statusColor} shrink-0`} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Восстановление команды</h3>
          {!loading && athletes.length > 0 ? (
            <ApexChart
              type="bar"
              series={[{ name: 'Восстановление %', data: athletes.map(a => a.recovery_score ?? 0) }]}
              options={barOpts}
              height={200}
            />
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-2sm">
              {loading ? 'Загрузка…' : 'Нет данных'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDash({ name }: { name: string }) {
  const [stats, setStats] = useState({ total: 0, athletes: 0, coaches: 0, orgs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await sb().from('users').select('role')
      if (data) {
        setStats({
          total:    data.length,
          athletes: data.filter(u => u.role === 'athlete').length,
          coaches:  data.filter(u => u.role === 'coach').length,
          orgs:     data.filter(u => u.role === 'organization').length,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Admin View</p>
        <h2 className="pf-num text-[36px] text-foreground leading-none">System Overview</h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Всего пользователей', value: loading ? '…' : stats.total.toString(),    icon: 'ki-people',       bg: 'bg-blue-50 text-blue-600' },
          { label: 'Атлеты',             value: loading ? '…' : stats.athletes.toString(),  icon: 'ki-abstract-26',  bg: 'bg-orange-50 text-orange-500' },
          { label: 'Тренеры',            value: loading ? '…' : stats.coaches.toString(),   icon: 'ki-notepad-edit', bg: 'bg-green-50 text-green-600' },
          { label: 'Организации',        value: loading ? '…' : stats.orgs.toString(),      icon: 'ki-office-bag',   bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">System Health</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Supabase DB',    status: 'Online',  badge: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Auth Service',   status: 'Healthy', badge: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Vercel Deploy',  status: 'Active',  badge: 'bg-green-50 text-green-700 border-green-200' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{s.label}</div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${s.badge}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Link href="/admin" className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-setting-2 text-sm" />
          Перейти в Admin Panel
        </Link>
      </div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          <span className="text-2sm text-muted-foreground">Загрузка…</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (user.role === 'coach' || user.role === 'organization') return <CoachDash userId={user.id} name={user.name} />
  if (user.role === 'admin') return <AdminDash name={user.name} />
  return <AthleteDash userId={user.id} name={user.name} />
}
