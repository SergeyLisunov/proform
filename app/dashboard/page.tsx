'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { recoveryColor, DEMO_SESSIONS } from '@/lib/utils/data'
const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })
const AthleteProfileCard = dynamic(() => import('@/components/ui/AthleteProfileCard'), { ssr: false })

const sparkOpts = (color: string) => ({
  chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth' as const, width: 2, colors: [color] },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.0 } },
  colors: [color],
  tooltip: { enabled: false },
  dataLabels: { enabled: false },
})

const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type WeeklyGoalProgress = {
  targetHours: number | null
  completedHours: number
  completionPercent: number
  remainingHours: number | null
}

type AthleteGoalRow = {
  weekly_training_hours: number | null
}

type WorkoutDurationRow = {
  activity_duration_min: number | null
  event_date: string
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentWeekRange() {
  const now = new Date()
  const currentDay = now.getDay()
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMonday)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return {
    from: toISODate(weekStart),
    to: toISODate(weekEnd),
  }
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10
}

function formatHours(value: number) {
  const rounded = roundHours(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ eyebrow, title, subtitle, action }: {
  eyebrow: string; title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ label, value, unit, icon, iconBg, delta, sub, sparkData, sparkColor }: {
  label: string; value: string | number; unit?: string; icon: string; iconBg: string
  delta?: number; sub?: string; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="pf-num text-[clamp(2rem,3vw,2.75rem)] leading-none text-foreground">{value}</span>
        {unit && <span className="mb-0.5 text-sm font-medium text-muted-foreground">{unit}</span>}
        {delta !== undefined && (
          <span className={`ml-auto mb-1 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
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

function SmallSignal({ label, value, hint, icon, tone }: {
  label: string; value: string; hint: string; icon: string; tone: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-2xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <i className={`ki-filled ${icon} text-sm`} />
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ title, meta, strain, zones, iconBg, icon, accent }: {
  title: string; meta: string; strain: string | number; zones: number[]; iconBg: string; icon: string; accent: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4 transition-colors hover:bg-accent/40">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <i className={`ki-filled ${icon} text-sm ${accent}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{title}</h4>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Записано
            </span>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">{meta}</p>
          <div className="mt-3">
            <ZoneBar zones={zones} height={26} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="pf-num text-xl leading-none text-foreground">{strain}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">нагрузка</div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
function AthleteDash({ name, userId }: { name: string; userId: string }) {
  const firstName = name.split(' ')[0]
  const hrv7d = [41, 44, 50, 48, 47, 45, 47]
  const strain7d = [8.2, 11.5, 7.1, 14.2, 10.8, 6.3, 12.1]
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalProgress>({
    targetHours: null,
    completedHours: 0,
    completionPercent: 0,
    remainingHours: null,
  })
  const [weeklyGoalLoading, setWeeklyGoalLoading] = useState(true)
  const athleteSignals = [
    { label: 'Следующая сессия', value: 'Легкая аэробика', hint: 'Держите следующий блок в Z2 и не допускайте скачков.', icon: 'ki-abstract-14', tone: 'bg-blue-50 text-blue-600' },
    { label: 'Сон', value: '7.8 ч', hint: 'Хороший уровень для объема, который поддерживает восстановление.', icon: 'ki-moon', tone: 'bg-violet-50 text-violet-600' },
    { label: 'Тренд ВСР', value: '+2.1 мс', hint: 'Среднее за 7 дней остается стабильным и постепенно растет.', icon: 'ki-abstract-26', tone: 'bg-emerald-50 text-emerald-600' },
  ]

  useEffect(() => {
    let cancelled = false

    async function loadWeeklyGoal() {
      setWeeklyGoalLoading(true)
      const supabase = createClient()
      const { from, to } = getCurrentWeekRange()

      const [{ data: athleteData }, { data: workoutsData }] = await Promise.all([
        supabase
          .from('athletes')
          .select('weekly_training_hours')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('workouts')
          .select('activity_duration_min, event_date')
          .eq('athlete_id', userId)
          .gte('event_date', from)
          .lte('event_date', to),
      ])

      if (cancelled) return

      const athleteGoal = athleteData as AthleteGoalRow | null
      const workoutDurations = (workoutsData ?? []) as WorkoutDurationRow[]
      const targetHoursRaw = athleteGoal?.weekly_training_hours
      const targetHours = typeof targetHoursRaw === 'number' && Number.isFinite(targetHoursRaw) && targetHoursRaw > 0
        ? roundHours(targetHoursRaw)
        : null

      const completedMinutes = workoutDurations.reduce((sum, workout) => {
        const duration = typeof workout.activity_duration_min === 'number' ? workout.activity_duration_min : 0
        return sum + duration
      }, 0)
      const completedHours = roundHours(completedMinutes / 60)
      const completionPercent = targetHours
        ? Math.max(0, Math.min(100, Math.round((completedHours / targetHours) * 100)))
        : 0
      const remainingHours = targetHours ? roundHours(Math.max(targetHours - completedHours, 0)) : null

      setWeeklyGoal({
        targetHours,
        completedHours,
        completionPercent,
        remainingHours,
      })
      setWeeklyGoalLoading(false)
    }

    loadWeeklyGoal()

    return () => {
      cancelled = true
    }
  }, [userId])

  const weeklyRingLabel = !weeklyGoal.targetHours
    ? 'Цель не задана'
    : weeklyGoal.completionPercent >= 100
      ? 'План закрыт'
      : weeklyGoal.completionPercent >= 65
        ? 'В процессе'
        : weeklyGoal.completedHours > 0
          ? 'Есть прогресс'
          : 'Старт недели'

  const weeklyGoalTitle = weeklyGoalLoading
    ? 'Считаем прогресс недели...'
    : weeklyGoal.targetHours
      ? `${formatHours(weeklyGoal.completedHours)} / ${formatHours(weeklyGoal.targetHours)} ч`
      : 'Укажите цель в часах'

  const weeklyGoalHint = weeklyGoalLoading
    ? 'Собираем выполненные часы по тренировкам текущей недели.'
    : weeklyGoal.targetHours
      ? weeklyGoal.remainingHours && weeklyGoal.remainingHours > 0
        ? `Осталось ${formatHours(weeklyGoal.remainingHours)} ч до недельной цели.`
        : 'Недельный план уже выполнен или перевыполнен.'
      : 'Задайте часов тренировок в неделю в разделе настроек спорта.'

  const lineOpts = {
    chart: { type: 'line' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: [2, 2], dashArray: [0, 5] },
    colors: ['#F97316', '#60A5FA'],
    xaxis: {
      categories: weekLabels.slice(0, strain7d.length),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: [
      { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
      { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    ],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontSize: '12px', fontFamily: 'DM Sans' },
    tooltip: { theme: 'light' },
    dataLabels: { enabled: false },
  }

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
            Представление атлета
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            WHOOP Live
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Обновлено 6 минут назад
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пульс дня</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
              Доброе утро, {firstName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Восстановление на уровне 42%. Сегодня лучше держать контроль над интенсивностью, не выходить за легкий аэробный потолок и вовремя остановиться, если нагрузка начнет расти.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <RecoveryRing score={weeklyGoal.completionPercent} size={96} label={weeklyRingLabel} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">План недели</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{weeklyGoalTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{weeklyGoalHint}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SmallSignal label="Сон" value="7.8 ч" hint="Этого достаточно для стабильного тренировочного дня." icon="ki-moon" tone="bg-violet-50 text-violet-600" />
          <SmallSignal label="Потолок нагрузки" value="Умеренно" hint="Сохраните день, удерживая объем под контролем." icon="ki-abstract-31" tone="bg-orange-50 text-orange-600" />
          <SmallSignal label="Тренд ВСР" value="47 мс" hint="Пока держится выше среднего уровня за неделю." icon="ki-abstract-26" tone="bg-blue-50 text-blue-600" />
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 pf-stagger">
        <StatCard
          label="Средний ВСР"
          value={47.2} unit="ms"
          icon="ki-abstract-26" iconBg="bg-blue-50 text-blue-600"
          sub="Метрика WHOOP"
          sparkData={hrv7d} sparkColor="#2563EB"
        />
        <StatCard
          label="Пульс покоя"
          value={45.8} unit="уд/мин"
          icon="ki-heart" iconBg="bg-red-50 text-red-500"
          delta={-3}
          sparkData={[48, 47, 46, 47, 45, 46, 46]} sparkColor="#EF4444"
        />
        <StatCard
          label="Средний сон"
          value={7.8} unit="ч"
          icon="ki-moon" iconBg="bg-violet-50 text-violet-600"
          sparkData={[7.2, 8.1, 7.5, 8.3, 7.8, 8.0, 7.8]} sparkColor="#7C3AED"
        />
        <StatCard
          label="Ккал / день"
          value="3,415" unit="kcal"
          icon="ki-abstract-31" iconBg="bg-orange-50 text-orange-500"
          delta={5}
          sparkData={[3100, 3400, 3200, 3500, 3350, 3600, 3415]} sparkColor="#F97316"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Тренировочный сигнал"
            title="Недельная нагрузка и ВСР"
            subtitle="Один график, две метрики и тот контекст, который обычно нужен первым."
            action={(
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Эта неделя
              </span>
            )}
          />
          <div className="mt-4">
            <ApexChart
              type="line"
              series={[
                { name: 'Нагрузка', data: strain7d },
                { name: 'ВСР (мс)', data: hrv7d },
              ]}
              options={lineOpts}
              height={220}
            />
          </div>
        </Surface>

        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Инсайт"
            title="Фокус дня"
            subtitle="Держите нагрузку под контролем и дайте восстановлению вести день."
          />
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Главное действие: остаться в аэробике</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Восстановление среднее, ВСР стабилен, а нагрузка колебалась достаточно, чтобы выбрать более спокойную сессию.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                Умеренно
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {athleteSignals.map(signal => (
              <SmallSignal key={signal.label} {...signal} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Долг по сну', value: 'Низкий', color: 'text-emerald-600' },
              { label: 'Предел сессии', value: '45-60 мин', color: 'text-foreground' },
              { label: 'Риск', value: 'Управляемый', color: 'text-orange-600' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border bg-background/70 p-3 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                <div className={`pf-num mt-2 text-lg font-semibold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Surface className="p-0">
          <div className="border-b border-border px-5 py-4 md:px-6">
            <SectionHeader
              eyebrow="Профиль"
              title="Карточка атлета"
              subtitle="Расширенный профиль остается на виду, но не перегружает hero-зону."
            />
          </div>
          <div className="p-3 md:p-4">
            <AthleteProfileCard />
          </div>
        </Surface>

        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Активность"
            title="Последние сессии"
            subtitle="Плотный ритм, читаемые детали и нагрузка на первом плане."
            action={(
              <a href="/diary" className="text-2xs font-semibold text-orange-500 transition-colors hover:text-orange-600">
                Открыть все →
              </a>
            )}
          />
          <div className="mt-4 space-y-3">
            {DEMO_SESSIONS.slice(0, 5).map((s, i) => (
              <ActivityRow
                key={i}
                title={s.type}
                meta={`${s.dur} min · ${s.date}`}
                strain={s.strain}
                zones={s.z}
                iconBg="bg-orange-50"
                icon="ki-abstract-26"
                accent="text-orange-500"
              />
            ))}
          </div>
        </Surface>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
function CoachDash({ name }: { name: string }) {
  const firstName = name.split(' ')[0]
  const athletes = [
    { name: 'Sara Kowalski', sport: 'Бег', recovery: 42, hrv: 47.2, status: 'warning' },
    { name: 'Marcus Weiden', sport: 'Велоспорт', recovery: 82, hrv: 62.2, status: 'good' },
    { name: 'James Thornton', sport: 'Плавание', recovery: 63, hrv: 32.0, status: 'ok' },
    { name: 'Linh Nguyen', sport: 'Силовая подготовка', recovery: 80, hrv: 106.5, status: 'good' },
  ]
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

  const watchlist = athletes.filter(a => a.recovery < 70)
  const coachSignals = [
    { label: 'Сегодня', value: '3 активные сессии', hint: 'Объема достаточно для состава без давления на восстановление.', icon: 'ki-calendar', tone: 'bg-blue-50 text-blue-600' },
    { label: 'Нагрузка под контролем', value: '1 атлет', hint: 'Одному атлету нужен более жесткий потолок перед следующим блоком.', icon: 'ki-warning-2', tone: 'bg-orange-50 text-orange-600' },
    { label: 'Средняя готовность', value: '67%', hint: 'Группа работоспособна, но еще не готова к агрессивной нагрузке.', icon: 'ki-abstract-26', tone: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700">
            Представление тренера
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Пульс команды
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            4 атлета в ротации
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пульт тренера</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
              С возвращением, {firstName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Команда в целом держится стабильно, но одному атлету все еще нужен более жесткий контроль нагрузки. Сегодня лучше управлять объемом, а не догонять его.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <RecoveryRing score={67} size={96} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Готовность команды</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">67%</p>
              <p className="mt-1 text-xs text-muted-foreground">Используйте это как базовый ориентир для сегодняшних сессий.</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {coachSignals.map(signal => (
            <SmallSignal key={signal.label} {...signal} />
          ))}
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 pf-stagger">
        {[
          { label: 'Активные атлеты', value: '4', icon: 'ki-people', bg: 'bg-blue-50 text-blue-600' },
          { label: 'Средняя готовность команды', value: '67%', icon: 'ki-abstract-26', bg: 'bg-green-50 text-green-600' },
          { label: 'Сессии сегодня', value: '3', icon: 'ki-calendar', bg: 'bg-orange-50 text-orange-500' },
          { label: 'Сигналы', value: '1', icon: 'ki-notification', bg: 'bg-red-50 text-red-500' },
        ].map(c => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            iconBg={c.bg}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Состав"
            title="Статус атлетов"
            subtitle="Так список команды читается с первого взгляда: сначала готовность, потом ВСР, затем статус."
            action={(
              <a href="/athletes" className="text-2xs font-semibold text-orange-500 transition-colors hover:text-orange-600">
                Управлять →
              </a>
            )}
          />
          <div className="mt-4 space-y-3">
            {athletes.map(a => {
              const rc = recoveryColor(a.recovery)
              const statusIcon = a.status === 'good' ? 'ki-check-circle' : a.status === 'warning' ? 'ki-warning-2' : 'ki-information-2'
              const statusColor = a.status === 'good' ? 'text-green-500' : a.status === 'warning' ? 'text-orange-500' : 'text-blue-500'
              return (
                <div key={a.name} className="rounded-2xl border border-border bg-background/70 p-4 transition-colors hover:bg-accent/40">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold pf-num" style={{ background: rc + '20', color: rc }}>
                      {a.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">{a.name}</div>
                        <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {a.sport}
                        </span>
                      </div>
                      <div className="mt-1 text-2xs text-muted-foreground">ВСР {a.hrv} ms · готовность ведет решение</div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="pf-num text-xl leading-none" style={{ color: rc }}>{a.recovery}%</div>
                      <i className={`ki-filled ${statusIcon} text-base ${statusColor}`} />
                    </div>
                    <div className="text-right">
                      <div className="pf-num text-lg leading-none" style={{ color: rc }}>
                        {a.recovery != null ? `${a.recovery}%` : '—'}
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
                </div>
              )
            })}
          </div>
        </Surface>

        <div className="grid gap-4">
          <Surface className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Карта команды"
              title="Распределение готовности"
              subtitle="Компактный столбчатый вид для быстрого сравнения по составу."
            />
            <div className="mt-4">
              <ApexChart
                type="bar"
                series={[{ name: 'Готовность %', data: [42, 82, 63, 80] }]}
                options={barOpts}
                height={220}
              />
            </div>
          </Surface>

          <Surface className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Лист контроля"
              title="Атлеты для корректировки"
              subtitle={`${watchlist.length} атл. находятся ниже предпочтительного коридора готовности.`}
            />
            <div className="mt-4 space-y-3">
              {watchlist.map(a => {
                const rc = recoveryColor(a.recovery)
                return (
                  <div key={a.name} className="rounded-xl border border-border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{a.name}</div>
                        <div className="mt-1 text-2xs text-muted-foreground">{a.sport} · HRV {a.hrv} ms</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="pf-num text-lg leading-none" style={{ color: rc }}>{a.recovery}%</div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">готовность</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  )
}

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDash({ name }: { name: string }) {
  const firstName = name.split(' ')[0]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            Представление администратора
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Обзор системы
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пульт контроля</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
              С возвращением, {firstName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Система здорова, число пользователей стабильно, а данные платформы выглядят актуальными. Держите в фокусе доступность сервисов и новые регистрации.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Текущее состояние</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">Работает штатно</p>
            <p className="mt-1 text-xs text-muted-foreground">Во всем demo-контуре не видно сбоев.</p>
          </div>
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 pf-stagger">
        {[
          { label: 'Всего пользователей', value: '3', icon: 'ki-people', bg: 'bg-blue-50 text-blue-600' },
          { label: 'Атлеты', value: '1', icon: 'ki-abstract-26', bg: 'bg-orange-50 text-orange-500' },
          { label: 'Тренеры', value: '1', icon: 'ki-notepad-edit', bg: 'bg-green-50 text-green-600' },
          { label: 'Записи WHOOP', value: '100K', icon: 'ki-chart-line-up', bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            iconBg={c.bg}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Статус"
            title="Здоровье системы"
            subtitle="Короткий и понятный статус-блок для самых важных сервисов платформы."
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Supabase DB', status: 'Онлайн', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Синхронизация WHOOP', status: 'Активно', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Сервис авторизации', status: 'Стабильно', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.color}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{s.label}</div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold ${s.badge}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Операции"
            title="Недавние действия администратора"
            subtitle="Операционный след должен оставаться компактным и легко читаемым."
          />
          <div className="mt-4 space-y-3">
            {[
              { label: 'Синхронизация новых пользователей', value: '3 аккаунта подтверждены', meta: 'Последнее окно onboarding прошло чисто.', tone: 'bg-blue-50 text-blue-600', icon: 'ki-people' },
              { label: 'Поток данных', value: 'Импорт WHOOP стабилен', meta: 'В текущем demo-наборе нет пропущенных сессий.', tone: 'bg-green-50 text-green-600', icon: 'ki-chart-line-up' },
              { label: 'Аудит', value: 'Связки ролей целы', meta: 'Роли атлета и тренера остаются неизменными.', tone: 'bg-violet-50 text-violet-600', icon: 'ki-lock' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-border bg-background/70 p-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <i className={`ki-filled ${item.icon} text-sm`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs font-medium text-foreground">{item.value}</div>
                    <div className="mt-1 text-2xs text-muted-foreground">{item.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <a href="/admin" className="kt-btn kt-btn-primary w-full justify-center gap-2">
              <i className="ki-filled ki-setting-2 text-sm" />
              Открыть панель администратора
            </a>
          </div>
        </Surface>
      </div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
          <span className="text-2sm text-muted-foreground">Загружаем ваши данные…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Surface className="w-full max-w-md p-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Сессия</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Не удалось загрузить профиль</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Попробуйте войти снова. Если проблема повторится, мы уже сузили ее до auth-профиля и сможем добить отдельно.
          </p>
          <div className="mt-5">
            <a href="/auth/login" className="kt-btn kt-btn-primary gap-2">
              <i className="ki-filled ki-enter text-sm" />
              Перейти ко входу
            </a>
          </div>
        </Surface>
      </div>
    )
  }

  if (user.role === 'coach' || user.role === 'organization') return <CoachDash name={user.name} />
  if (user.role === 'admin') return <AdminDash name={user.name} />
  return <AthleteDash name={user.name} userId={user.id} />
}
