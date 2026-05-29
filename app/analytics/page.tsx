'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import ApexChart from '@/components/charts/ApexChart'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { PlanGuard } from '@/components/ui/Paywall'
import { useUser } from '@/lib/hooks/useUser'
import {
  DEMO_ATHLETES,
  DEMO_COMPETITIONS,
  DEMO_DAILY,
  DEMO_GROUP,
  DEMO_HRZ,
  DEMO_WEEKLY,
  recoveryColor,
} from '@/lib/utils/data'

const PERIOD_OPTS = [
  { label: '7д', value: '7d' },
  { label: '30д', value: '30d' },
  { label: '90д', value: '90d' },
  { label: 'Сезон', value: 'season' },
]

const ZC = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444']

function Surface({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function PeriodSwitch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border bg-background/80 p-1 shadow-sm">
      {PERIOD_OPTS.map((period) => (
        <button
          key={period.value}
          type="button"
          onClick={() => onChange(period.value)}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
            value === period.value
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string
  value: string | number
  icon: string
  tone: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/75 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 pf-num text-[clamp(1.65rem,2.8vw,2.2rem)] leading-none text-foreground">{value}</p>
          {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
    </div>
  )
}

function InsightCard({
  label,
  title,
  description,
  accent,
  icon,
}: {
  label: string
  title: string
  description: string
  accent: string
  icon: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/75 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

function CoachAnalytics() {
  const [period, setPeriod] = useState('30d')
  const averageRecovery = Math.round(
    DEMO_ATHLETES.reduce((sum, athlete) => sum + athlete.recovery, 0) / DEMO_ATHLETES.length
  )
  const averageHrv = Math.round(DEMO_ATHLETES.reduce((sum, athlete) => sum + athlete.hrv, 0) / DEMO_ATHLETES.length)
  const riskCount = DEMO_ATHLETES.filter((athlete) => athlete.risk !== 'low').length
  const sessionCount = DEMO_ATHLETES.reduce((sum, athlete) => sum + athlete.sessions, 0)

  const loadCompare = {
    chart: { type: 'radar' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ['#2563EB', '#F97316', '#16A34A', '#7C3AED'],
    xaxis: { categories: ['Нагрузка', 'ВСР', 'Восстановление', 'Тренировки', 'Сон', 'Серия'] },
    yaxis: { show: false },
    grid: { padding: { top: 10, bottom: 10 } },
    legend: { position: 'bottom' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const groupBar = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 5 } },
    colors: ['#2563EB', '#F97316', '#16A34A', '#7C3AED'],
    xaxis: {
      categories: DEMO_WEEKLY.map((w) => w.w),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const topAthletes = [...DEMO_ATHLETES].sort((a, b) => a.recovery - b.recovery).slice(0, 3)
  const teamBalance = DEMO_ATHLETES.filter((athlete) => athlete.risk === 'low').length

  return (
    <PlanGuard
      requiredPlan="team"
      feature="analytics"
      title="Аналитика команды"
      description="Сравнение атлетов, командные метрики и радарные графики доступны на плане Team"
    >
      <div className="flex flex-col gap-6 pf-enter">
        <Surface className="relative bg-gradient-to-br from-orange-50 via-card to-background p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.08),transparent_36%)]" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Рабочее пространство тренера
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Командный обзор
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Обновлено недавно
                </span>
              </div>
              <h2 className="mt-4 text-[clamp(2.1rem,4vw,3.4rem)] font-semibold tracking-tight text-foreground">
                Аналитика тренера в одном рабочем поле
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Быстрый обзор восстановления, нагрузки и распределения риска по группе. Сверху видно общее
                состояние, ниже - детали по атлетам и сигналы, которые требуют внимания.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InsightCard
                  label="Баланс команды"
                  title={`${teamBalance} атлета в зелёной зоне`}
                  description="Большая часть состава сейчас держит стабильное восстановление."
                  accent="bg-emerald-50 text-emerald-600"
                  icon="ki-check-circle"
                />
                <InsightCard
                  label="Риск"
                  title={`${riskCount} атлета с повышенным вниманием`}
                  description="Их лучше держать в коротком цикле контроля и не перегружать."
                  accent="bg-orange-50 text-orange-600"
                  icon="ki-warning-2"
                />
                <InsightCard
                  label="Объем"
                  title={`${sessionCount} тренировок за период`}
                  description="Плотность работы высокая, но пока без явного перекоса в одну сторону."
                  accent="bg-blue-50 text-blue-600"
                  icon="ki-calendar"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <PeriodSwitch value={period} onChange={setPeriod} />
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Командный фокус
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">Нагрузка сдвигается в сторону верхней группы</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Период: {PERIOD_OPTS.find((option) => option.value === period)?.label ?? '30д'}
                </p>
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Ср. восстановление"
            value={`${averageRecovery}%`}
            icon="ki-abstract-26"
            tone="bg-emerald-50 text-emerald-600"
            hint="По всей группе за выбранный период"
          />
          <MetricCard
            label="Ср. ВСР"
            value={`${averageHrv} ms`}
            icon="ki-heart-circle"
            tone="bg-blue-50 text-blue-600"
            hint="Стабильный командный фон"
          />
          <MetricCard
            label="В зоне риска"
            value={riskCount}
            icon="ki-warning-2"
            tone="bg-orange-50 text-orange-600"
            hint="Требует короткого цикла контроля"
          />
          <MetricCard
            label="Всего тренировок"
            value={sessionCount}
            icon="ki-calendar"
            tone="bg-violet-50 text-violet-600"
            hint="Суммарно по списку атлетов"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Surface className="xl:col-span-7 p-5">
            <SectionTitle
              eyebrow="Главный график"
              title="Недельная нагрузка по атлетам"
              subtitle="Сравнение за 8 недель с акцентом на разброс внутри команды"
            />
            <div className="mt-4">
              <ApexChart
                type="bar"
                series={[
                  { name: 'Sara K.', data: DEMO_GROUP.map((group) => group.SK) },
                  { name: 'Marcus W.', data: DEMO_GROUP.map((group) => group.MW) },
                  { name: 'James T.', data: DEMO_GROUP.map((group) => group.JT) },
                  { name: 'Linh N.', data: DEMO_GROUP.map((group) => group.LN) },
                ]}
                options={groupBar}
                height={260}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {topAthletes.map((athlete) => {
                const recoveryTone = recoveryColor(athlete.recovery)
                return (
                  <div key={athlete.id} className="rounded-2xl border border-border bg-background/75 p-3">
                    <div className="flex items-center gap-3">
                      <RecoveryRing score={athlete.recovery} size={56} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{athlete.name}</p>
                        <p className="text-2xs text-muted-foreground">{athlete.sport}</p>
                        <div
                          className="mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor: `${recoveryTone}33`,
                            backgroundColor: `${recoveryTone}10`,
                            color: recoveryTone,
                          }}
                        >
                          {athlete.recovery}% готовности
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Surface>

          <div className="xl:col-span-5 grid gap-4">
            <Surface className="p-5">
              <SectionTitle
                eyebrow="Командный радар"
                title="Сравнение нагрузок"
                subtitle="Нормализованные метрики помогают быстро увидеть перекосы"
              />
              <div className="mt-4">
                <ApexChart
                  type="radar"
                  series={[
                    { name: 'Sara K.', data: [65, 47, 42, 72, 78, 50] },
                    { name: 'Marcus W.', data: [82, 62, 82, 88, 84, 100] },
                    { name: 'James T.', data: [72, 32, 63, 73, 76, 73] },
                    { name: 'Linh N.', data: [78, 100, 80, 81, 87, 91] },
                  ]}
                  options={loadCompare}
                  height={250}
                />
              </div>
            </Surface>

            <Surface className="p-5">
              <SectionTitle
                eyebrow="Что смотреть"
                title="Подсказки для следующего решения"
                subtitle="Скорее рабочие ориентиры, чем сухие цифры"
              />
              <div className="mt-4 grid gap-3">
                <InsightCard
                  label="Приоритет"
                  title="Начать с низкой группы восстановления"
                  description="Эти атлеты первыми попадут под корректировку объёма и интенсивности."
                  accent="bg-orange-50 text-orange-600"
                  icon="ki-filter"
                />
                <InsightCard
                  label="Стабильность"
                  title="Высокая группа держит темп без перегрева"
                  description="Можно оставить текущий ритм, не поднимая планку раньше времени."
                  accent="bg-emerald-50 text-emerald-600"
                  icon="ki-abstract-26"
                />
                <InsightCard
                  label="Сигнал"
                  title="Радар показывает разную форму между задачами"
                  description="Удобная точка для обсуждения следующего микроплана."
                  accent="bg-blue-50 text-blue-600"
                  icon="ki-chart-line-up"
                />
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </PlanGuard>
  )
}

// ── ATHLETE ANALYTICS ─────────────────────────────────────────────────────────
type AthleteStats = {
  id: string; name: string; sport_type: string | null
  recovery: number | null; hrv: number | null; sessions: number; totalStrain: number
}

function AthleteAnalytics() {
  const [period, setPeriod] = useState('30d')
  const areaOpts = {
    chart: { type: 'area' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    colors: ['#F97316', '#16A34A'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.12, opacityTo: 0.0 } },
    xaxis: {
      categories: DEMO_DAILY.map((day) => day.day),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
      { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    ],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const sleepBar = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false }, stacked: true },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
    colors: ['#7C3AED', '#C4B5FD', '#EDE9FE'],
    xaxis: {
      categories: DEMO_DAILY.map((day) => day.day),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const donutOpts = {
    chart: { type: 'donut' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ZC,
    labels: ['Z1 Восстановление', 'Z2 Аэробная', 'Z3 Темп', 'Z4 Порог', 'Z5 VO₂max'],
    legend: { position: 'bottom' as const, fontSize: '12px', fontFamily: 'DM Sans' },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Итого',
              fontSize: '13px',
              fontFamily: 'DM Sans',
              color: '#A1A1AA',
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  return (
    <PlanGuard
      requiredPlan="pro"
      feature="analytics"
      title="Полная аналитика"
      description="Детальные графики восстановления, нагрузки, сна и зон пульса доступны на плане Pro"
    >
      <div className="flex flex-col gap-6 pf-enter">
        <Surface className="relative bg-gradient-to-br from-orange-50 via-card to-background p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.08),transparent_36%)]" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Рабочее пространство атлета
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sara Kowalski · ПРОФИЛЬ_00011
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  WHOOP в реальном времени
                </span>
              </div>
              <h2 className="mt-4 text-[clamp(2.1rem,4vw,3.4rem)] font-semibold tracking-tight text-foreground">
                Аналитика без перегруза интерфейса
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Сверху собраны ключевые сигналы дня, ниже - восстановление, сон, зоны пульса и результаты
                соревнований. Всё в одной рабочей зоне, без лишнего шума.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InsightCard
                  label="Фокус дня"
                  title="Сохранять умеренную нагрузку"
                  description="Судя по фону восстановления, сегодня лучше не толкать объём слишком высоко."
                  accent="bg-orange-50 text-orange-600"
                  icon="ki-abstract-31"
                />
                <InsightCard
                  label="Сон"
                  title="7.8 ч за ночь"
                  description="Нормальный коридор для стабилизации формы и спокойного следующего старта."
                  accent="bg-violet-50 text-violet-600"
                  icon="ki-moon"
                />
                <InsightCard
                  label="HRV"
                  title="47 ms, тренд ровный"
                  description="Показатель держится без резких просадок и поддерживает текущий план."
                  accent="bg-blue-50 text-blue-600"
                  icon="ki-heart-circle"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <PeriodSwitch value={period} onChange={setPeriod} />
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm">
                <RecoveryRing score={62} size={88} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Готовность
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">62 / 100</p>
                  <p className="mt-1 text-xs text-muted-foreground">Лучше держать день в управляемом режиме.</p>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Ср. восстановление"
            value="62%"
            icon="ki-abstract-26"
            tone="bg-emerald-50 text-emerald-600"
            hint="На уровне устойчивого рабочего дня"
          />
          <MetricCard
            label="Ср. ВСР"
            value="47 ms"
            icon="ki-heart-circle"
            tone="bg-blue-50 text-blue-600"
            hint="Без резких колебаний"
          />
          <MetricCard
            label="Ср. нагрузка"
            value="10.4"
            icon="ki-chart-line-up"
            tone="bg-orange-50 text-orange-600"
            hint="Целевой диапазон для текущей недели"
          />
          <MetricCard
            label="Ср. сон"
            value="7.8 ч"
            icon="ki-moon"
            tone="bg-violet-50 text-violet-600"
            hint="Достаточно для поддержки восстановления"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Surface className="xl:col-span-7 p-5">
            <SectionTitle
              eyebrow="Дневной контур"
              title="Восстановление и нагрузка"
              subtitle="Дневной тренд за неделю"
            />
            <div className="mt-4">
              <ApexChart
                type="area"
                series={[
                  { name: 'Восстановление %', data: DEMO_DAILY.map((day) => day.recovery) },
                  { name: 'Нагрузка', data: DEMO_DAILY.map((day) => day.strain) },
                ]}
                options={areaOpts}
                height={250}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InsightCard
                label="Тренд"
                title="Восстановление выше вчера"
                description="Кривая выглядит ровнее, чем в начале недели."
                accent="bg-emerald-50 text-emerald-600"
                icon="ki-abstract-26"
              />
              <InsightCard
                label="Сигнал"
                title="Нагрузка без резкого всплеска"
                description="Это хороший момент, чтобы не ускоряться раньше времени."
                accent="bg-orange-50 text-orange-600"
                icon="ki-chart-line-up"
              />
              <InsightCard
                label="Контроль"
                title="День лучше держать предсказуемым"
                description="Небольшие сессии сейчас выигрывают у длинных и тяжёлых."
                accent="bg-blue-50 text-blue-600"
                icon="ki-clock"
              />
            </div>
          </Surface>

          <div className="xl:col-span-5 grid gap-4">
            <Surface className="p-5">
              <SectionTitle
                eyebrow="Сон"
                title="Структура ночи"
                subtitle="Глубокий / REM / Лёгкий"
              />
              <div className="mt-4">
                <ApexChart
                  type="bar"
                  series={[
                    { name: 'Глубокий', data: [1.2, 1.5, 0.9, 1.8, 1.3, 2.0, 1.5] },
                    { name: 'REM', data: [1.8, 2.1, 1.5, 2.2, 1.9, 2.3, 2.0] },
                    { name: 'Лёгкий', data: [4.0, 4.1, 3.4, 3.7, 3.8, 4.3, 4.8] },
                  ]}
                  options={sleepBar}
                  height={220}
                />
              </div>
            </Surface>

            <Surface className="p-5">
              <SectionTitle
                eyebrow="Инсайты"
                title="Короткие подсказки на сегодня"
                subtitle="Собраны из текущего профиля и дневных метрик"
              />
              <div className="mt-4 grid gap-3">
                <InsightCard
                  label="Следующая сессия"
                  title="Лёгкая аэробика или техника"
                  description="Хорошо подходит как поддержка формы без лишнего стресса."
                  accent="bg-blue-50 text-blue-600"
                  icon="ki-abstract-14"
                />
                <InsightCard
                  label="Риск"
                  title="Не разгонять объём в первой половине дня"
                  description="Если добавить интенсивность, восстановление может уйти в минус."
                  accent="bg-orange-50 text-orange-600"
                  icon="ki-warning-2"
                />
                <InsightCard
                  label="Фон"
                  title="Пульс и сон смотрятся согласованно"
                  description="Это хороший знак для спокойного тренировочного дня."
                  accent="bg-emerald-50 text-emerald-600"
                  icon="ki-heart-circle"
                />
              </div>
            </Surface>
          </div>

          <Surface className="xl:col-span-6 p-5">
            <SectionTitle
              eyebrow="Зоны"
              title="Распределение по зонам пульса"
              subtitle="Время в каждой зоне за неделю"
            />
            <div className="mt-4">
              <ZoneBar zones={DEMO_HRZ} height={28} showLabels />
            </div>
            <div className="mt-4">
              <ApexChart type="donut" series={DEMO_HRZ} options={donutOpts} height={210} />
            </div>
          </Surface>

          <Surface className="xl:col-span-6 overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <SectionTitle
                eyebrow="Соревнования"
                title="Результаты соревнований"
                subtitle="Последние старты и текущий статус"
              />
            </div>
            <div className="divide-y divide-border">
              {DEMO_COMPETITIONS.map((competition, index) => {
                const statusLabel =
                  competition.status === 'completed'
                    ? 'завершено'
                    : competition.status === 'planned'
                      ? 'запланировано'
                      : 'активно'
                const statusBg =
                  competition.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : competition.status === 'planned'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-orange-50 text-orange-700 border-orange-200'

                return (
                  <div key={index} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-base">{competition.status === 'completed' ? '🏁' : '🎯'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{competition.name}</div>
                      <div className="text-2xs text-muted-foreground">
                        {competition.date} · {competition.location} · {competition.distance}
                      </div>
                    </div>
                    {competition.result && (
                      <div className="shrink-0 text-right">
                        <div className="pf-num text-base text-foreground">{competition.result}</div>
                        {competition.position && <div className="text-2xs text-muted-foreground">#{competition.position}</div>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`rounded-full border px-1.5 py-0.5 text-2xs font-semibold capitalize ${statusBg}`}>
                        {statusLabel}
                      </span>
                      {competition.pb && (
                        <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-2xs font-bold text-white">
                          PB
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Surface>
        </div>
      </div>
    </PlanGuard>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
// W21 audit fix (task 1): the CoachAnalytics / AthleteAnalytics views below
// render entirely from hardcoded DEMO_* fixtures (Sara K., Marcus W., …). That
// is a showcase, not real data — shipping it to production showed fake athletes
// to real users. Gated behind NEXT_PUBLIC_DEMO_MODE (same env-flag pattern as
// the demo-login gate). Production (unset) → honest "coming soon" state. Real
// analytics aggregation is a separate feature (tracked, not a critical fix).
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function AnalyticsComingSoon() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 border border-orange-100">
        <i className="ki-filled ki-chart-line-up text-3xl text-orange-400" />
      </div>
      <div>
        <h1 className="pf-num text-2xl text-foreground">Аналитика готовится</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Графики восстановления, нагрузки и пульсовых зон появятся здесь по мере
          накопления данных тренировок и самочувствия. Начните вести дневник —
          и метрики соберутся автоматически.
        </p>
      </div>
      <a
        href="/diary"
        className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 no-underline"
      >
        Перейти в дневник
        <i className="ki-filled ki-arrow-right text-sm" />
      </a>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useUser()

  if (!DEMO_MODE) return <AnalyticsComingSoon />

  return user?.role === 'coach' ? <CoachAnalytics /> : <AthleteAnalytics />
}
