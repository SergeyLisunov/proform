'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { Card, ChartCard } from '@/components/ui/metronic'
import { RISK_COLORS, COACH_MARKS, recoveryColor } from '@/lib/utils/data'
import dynamic from 'next/dynamic'
import { createBrowserClient } from '@supabase/ssr'
import type { Workout } from '@/services/workouts.service'
import { createDiaryEntry } from '@/services/coach-diary.service'

const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })

// QA C4: the athlete-detail trend chart had hardcoded demo series shown under a
// "Реальные данные" badge. Gated behind NEXT_PUBLIC_DEMO_MODE (same flag as
// analytics/calendar); prod shows an honest placeholder until real per-athlete
// trend aggregation is wired. Badges removed (overclaimed "real data").
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AthleteUser = {
  id: string; name: string; sport_type: string | null; age: number | null; gender: string | null
}

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

type AthleteWithStats = AthleteUser & {
  recovery: number; hrv: number | null; rhr: number | null
  sessions: number; recentWorkouts: Workout[]
  risk: RiskLevel; streak: number
}

type Athlete = AthleteWithStats

type TabType = 'overview' | 'sessions' | 'diary' | 'marks'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function computeRisk(recovery: number): RiskLevel {
  if (recovery < 30) return 'critical'
  if (recovery < 45) return 'high'
  if (recovery < 70) return 'moderate'
  return 'low'
}

function computeStreak(workouts: Workout[]): number {
  if (!workouts.length) return 0
  const dates = new Set(workouts.map(w => w.event_date).filter(Boolean))
  let streak = 0
  let cur = new Date(todayStr())
  while (true) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
    if (dates.has(iso)) { streak++; cur.setDate(cur.getDate() - 1) }
    else break
  }
  return streak
}

const RISK_LABELS = {
  low: 'низкий',
  moderate: 'умеренный',
  high: 'высокий',
  critical: 'критический',
} as const

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-1.5 text-base font-semibold text-navy-500">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  icon: string
  tone: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/75 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <div className="mt-2 flex items-end gap-1.5">
            <span className="pf-num text-[clamp(1.7rem,3vw,2.5rem)] leading-none text-foreground">{value}</span>
          </div>
          {hint && <p className="mt-1.5 text-2xs leading-5 text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
    </div>
  )
}

function AthleteCard({
  athlete,
  onSelect,
  selected,
}: {
  athlete: Athlete
  onSelect: () => void
  selected: boolean
}) {
  const rc = recoveryColor(athlete.recovery)
  const rr = RISK_COLORS[athlete.risk]
  const loadLabel = athlete.recovery >= 70 ? 'Готов' : athlete.recovery >= 50 ? 'Баланс' : 'Защита'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'group w-full rounded-[24px] border p-4 text-left transition-all',
        selected
          ? 'border-orange-300 bg-orange-50/50 shadow-sm shadow-orange-100'
          : 'border-border bg-card hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold pf-num"
          style={{ background: `${rc}18`, color: rc }}
        >
          {getInitials(athlete.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{athlete.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {athlete.sport_type ?? 'Спорт'} · {athlete.age ? `${athlete.age} лет` : ''}
              </div>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: rr.bg, color: rr.text, borderColor: rr.border }}
            >
              <i className={`ki-filled ${rr.icon} text-[9px]`} />
              {RISK_LABELS[athlete.risk]}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
            <RecoveryRing score={athlete.recovery} size={58} />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <div className="mb-1 flex justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">ВСР {athlete.hrv} мс</span>
                  <span className="font-semibold text-foreground">{loadLabel}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, athlete.hrv ?? 0)}%`, background: rc }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">ЧСС покоя {athlete.rhr} уд/мин</span>
                  <span className="text-foreground">{athlete.sessions} сессий</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(0, 100 - ((athlete.rhr ?? 60) - 40) * 3)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border bg-background/70 py-2">
              <div className="pf-num text-lg text-foreground">{athlete.sessions}</div>
              <div className="text-[10px] text-muted-foreground">сессий</div>
            </div>
            <div className="rounded-xl border border-border bg-background/70 py-2">
              <div className="pf-num text-lg text-foreground">{athlete.streak}d</div>
              <div className="text-[10px] text-muted-foreground">дней подряд</div>
            </div>
            <div className="rounded-xl border border-border bg-background/70 py-2">
              <div className="pf-num text-lg" style={{ color: rc }}>
                {athlete.recovery}%
              </div>
              <div className="text-[10px] text-muted-foreground">готовность</div>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

function AthleteDetail({ athlete }: { athlete: Athlete }) {
  const { user } = useUser()
  // W11 Day 53: inline comment drawer (replaces disabled button from PR #63 audit)
  const [commentOpen,  setCommentOpen]  = useState(false)
  const [cTitle,       setCTitle]       = useState('')
  const [cNote,        setCNote]        = useState('')
  const [cSaving,      setCSaving]      = useState(false)
  const [cError,       setCError]       = useState<string | null>(null)
  const [cToast,       setCToast]       = useState<string | null>(null)

  useEffect(() => {
    if (!cToast) return
    const t = setTimeout(() => setCToast(null), 3000)
    return () => clearTimeout(t)
  }, [cToast])

  const onSubmitComment = async () => {
    if (cSaving) return
    if (!user?.id) { setCError('Не авторизован'); return }
    if (!cNote.trim()) { setCError('Заметка не может быть пустой'); return }
    setCSaving(true)
    setCError(null)
    const res = await createDiaryEntry({
      coach_id:   user.id,
      athlete_id: athlete.id,
      date:       new Date().toISOString().slice(0, 10),
      entry_type: 'observation',
      title:      cTitle.trim() || null,
      note:       cNote.trim(),
      is_shared_with_athlete: false,
    })
    setCSaving(false)
    if (!res) { setCError('Не удалось сохранить — попробуйте ещё раз'); return }
    setCommentOpen(false)
    setCTitle('')
    setCNote('')
    setCToast(`Комментарий сохранён в дневнике для ${athlete.name}`)
  }

  const [tab, setTab] = useState<TabType>('overview')
  const rc = recoveryColor(athlete.recovery)
  const rr = RISK_COLORS[athlete.risk]
  const readinessTone =
    athlete.recovery >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    athlete.recovery >= 50 ? 'text-orange-700 bg-orange-50 border-orange-200' :
    'text-red-700 bg-red-50 border-red-200'

  const readinessTitle =
    athlete.recovery >= 70 ? 'Можно наращивать' :
    athlete.recovery >= 50 ? 'Держать ритм' :
    'Поберечь день'

  const coachCue =
    athlete.recovery >= 70
      ? 'Есть зеленый свет на контролируемый прогресс. Следующий блок лучше держать точным и дозированным.'
      : athlete.recovery >= 50
        ? 'Следующую сессию лучше использовать для подтверждения готовности, а не для форсирования адаптации.'
        : 'Держите интенсивность низкой, следите за восстановлением и ждите более чистого дня завтра.'

  const lineOpts = {
    chart: { type: 'line' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: [2, 2], dashArray: [0, 4] },
    colors: ['#F35703', '#2563EB'],
    xaxis: {
      categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Обзор', icon: 'ki-element-11' },
    { id: 'sessions', label: 'Сессии', icon: 'ki-abstract-26' },
    { id: 'diary', label: 'Дневник', icon: 'ki-notepad-edit' },
    { id: 'marks', label: 'Метки', icon: 'ki-tag' },
  ]

  return (
    <Surface className="flex flex-col">
      <div className="border-b border-border bg-background/60 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                Выбранный атлет
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-lg font-bold pf-num"
                style={{ background: `${rc}18`, color: rc }}
              >
                {getInitials(athlete.name)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-navy-500">
                  {athlete.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {athlete.sport_type ?? 'Спорт'}{athlete.age ? ` · ${athlete.age} лет` : ''}{athlete.gender ? ` · ${athlete.gender === 'F' ? 'Женщина' : 'Мужчина'}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-w-[240px] items-center gap-4 rounded-3xl border border-border bg-card px-4 py-3 shadow-sm">
            <RecoveryRing score={athlete.recovery} size={88} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сигнал тренера</p>
              <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessTone}`}>
                {readinessTitle}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{athlete.recovery}% готовности</p>
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">{coachCue}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Следующая тренировка</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {athlete.recovery >= 70 ? 'Контролируемый прогресс' : athlete.recovery >= 50 ? 'Спокойная аэробная работа' : 'Восстановление без стресса'}
            </p>
            <p className="mt-1.5 text-2xs leading-5 text-muted-foreground">
              Следующий блок лучше держать в ритме восстановления, а не пытаться добрать лишнюю нагрузку.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Зона риска</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ background: rr.bg, color: rr.text, borderColor: rr.border }}
              >
                <i className={`ki-filled ${rr.icon} text-[10px]`} />
                {athlete.risk}
              </span>
            </div>
            <p className="mt-2 text-2xs leading-5 text-muted-foreground">
              Следите за сигналами перегрузки перед увеличением объёма или интенсивности.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Работа тренера</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Комментируйте, просматривайте и ставьте метку из одной панели.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCommentOpen(true)}
                className="kt-btn kt-btn-sm kt-btn-outline gap-1.5"
              >
                <i className="ki-filled ki-message-text text-xs" />
                Комментарий
              </button>
              <Link
                href="/coach/passes"
                className="kt-btn kt-btn-sm kt-btn-primary gap-1.5 no-underline"
                title="Списать сессию с активного абонемента"
              >
                <i className="ki-filled ki-tag text-xs" />
                Отметить сессию
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-background/40 px-4 py-3 md:px-6">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-2sm font-semibold transition-all',
                tab === item.id
                  ? 'bg-orange-50 text-orange-600 shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              ].join(' ')}
            >
              <i className={`ki-filled ${item.icon} text-xs`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-6">
        {tab === 'overview' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: 'Готовность', value: `${athlete.recovery}%`, icon: 'ki-abstract-26', tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'ВСР', value: `${athlete.hrv} мс`, icon: 'ki-heart', tone: 'bg-blue-50 text-blue-600' },
                { label: 'ЧСС покоя', value: `${athlete.rhr} уд/мин`, icon: 'ki-heart', tone: 'bg-red-50 text-red-500' },
                { label: 'Серия', value: `${athlete.streak}д`, icon: 'ki-calendar', tone: 'bg-violet-50 text-violet-600' },
              ].map((item) => (
                <StatTile key={item.label} {...item} />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-border bg-background/75 p-4 shadow-sm">
                <SectionHeader
                  eyebrow="Заметки тренера"
                  title="Что делать дальше"
                  subtitle="Короткая выжимка для следующего тренерского решения."
                />
                <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Рекомендуемый шаг</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{coachCue}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Интенсивность', value: athlete.recovery >= 70 ? 'Умеренная' : 'Низкая' },
                      { label: 'Контроль', value: athlete.risk === 'low' ? 'Дрейф нагрузки' : 'Дрейф восстановления' },
                      { label: 'Цель', value: athlete.recovery >= 70 ? 'Рост' : 'Стабилизация' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-orange-100 bg-white/80 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-border bg-background/75 p-4 shadow-sm">
                <SectionHeader
                  eyebrow="Карта риска"
                  title="Сигналы для наблюдения"
                  subtitle="Считывайте атлета от самых прикладных рисков к более мягкому контексту."
                />
                <div className="mt-4 grid gap-2">
                  {[
                    { label: 'Риск перегруза', status: athlete.recovery < 45 ? 'high' : athlete.recovery < 70 ? 'moderate' : 'low', icon: 'ki-warning-2' },
                    { label: 'Разрыв восстановления', status: athlete.recovery < 50 ? 'moderate' : 'low', icon: 'ki-abstract-26' },
                    { label: 'Стабильность нагрузки', status: athlete.streak > 10 ? 'moderate' : 'low', icon: 'ki-chart-line-up' },
                    { label: 'Целостность тренда', status: athlete.risk === 'low' ? 'low' : 'moderate', icon: 'ki-abstract-31' },
                  ].map((item) => {
                    const meta = RISK_COLORS[item.status as keyof typeof RISK_COLORS]

                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
                        style={{ background: meta.bg, borderColor: meta.border }}
                      >
                        <i className={`ki-filled ${item.icon} text-sm`} style={{ color: meta.text }} />
                        <div className="min-w-0">
                          <div className="text-2xs font-semibold" style={{ color: meta.text }}>
                            {item.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize">{RISK_LABELS[item.status as keyof typeof RISK_LABELS]}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <ChartCard
              title="Недельная нагрузка и ВСР"
              subtitle="Линейный график остается, но живет в более собранной рабочей зоне."
            >
              {DEMO_MODE ? (
                <ApexChart
                  type="line"
                  series={[
                    { name: 'Нагрузка', data: [8.2, 11.5, 7.1, 14.2, 10.8, 6.3, 12.1] },
                    { name: 'ВСР (мс)', data: [44, 47, 45, 41, 48, 50, 47] },
                  ]}
                  options={lineOpts}
                  height={180}
                />
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
                  <p className="text-xs text-muted-foreground">График появится при накоплении данных тренировок</p>
                </div>
              )}
            </ChartCard>
          </div>
        )}

        {tab === 'sessions' && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Недавние тренировки"
              title="История сессий"
              subtitle="Последние тренировки показаны так, чтобы нагрузка и готовность читались рядом."
            />
            {athlete.recentWorkouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-border bg-background/75 py-10 text-center">
                <i className="ki-filled ki-calendar text-2xl text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Тренировок пока нет</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-border bg-background/75 shadow-sm">
                {athlete.recentWorkouts.slice(0, 8).map((w, index) => {
                  const strain = w.activity_strain ?? 0
                  const rc = w.recovery_score != null ? recoveryColor(Math.round(w.recovery_score)) : '#94A3B8'
                  return (
                    <div
                      key={`${w.id}-${index}`}
                      className="grid gap-4 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-accent/40 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{w.name ?? w.activity_type ?? 'Тренировка'}</div>
                          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {w.event_date ?? '—'}
                          </span>
                        </div>
                        <p className="mt-1 text-2xs text-muted-foreground">
                          {w.activity_duration_min ? `${w.activity_duration_min} мин` : ''}{w.avg_heart_rate ? ` · ЧСС ${Math.round(w.avg_heart_rate)} уд/мин` : ''}{strain ? ` · Нагрузка ${Number(strain).toFixed(1)}` : ''}
                        </p>
                        {strain > 0 && (
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border sm:max-w-xs">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (strain / 20) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                      {w.recovery_score != null && (
                        <div className="rounded-2xl border border-border bg-card px-3 py-2 text-center">
                          <div className="pf-num text-xl leading-none" style={{ color: rc }}>
                            {Math.round(w.recovery_score)}%
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">готовность</div>
                        </div>
                      )}
                      {strain > 0 && (
                        <div className="hidden items-center justify-end sm:flex">
                          <div className="text-right">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Нагрузка</div>
                            <div className="mt-1 text-sm font-semibold text-foreground">{Number(strain).toFixed(1)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'diary' && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Дневник атлета"
              title="Записи тренировок"
              subtitle="Описания и заметки из тренировочного журнала атлета."
            />
            {athlete.recentWorkouts.filter(w => w.description).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-border bg-background/75 py-10 text-center">
                <i className="ki-filled ki-notepad-edit text-2xl text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Заметок пока нет</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {athlete.recentWorkouts.filter(w => w.description).slice(0, 6).map((w, index) => {
                  const risk = computeRisk(w.recovery_score != null ? Math.round(w.recovery_score) : 50)
                  const meta = RISK_COLORS[risk]
                  return (
                    <div
                      key={`${w.id}-${index}`}
                      className="rounded-[24px] border p-4 transition-colors hover:border-orange-200"
                      style={{ background: `${meta.bg}66`, borderColor: meta.border }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{w.name ?? w.activity_type ?? 'Тренировка'}</div>
                          <p className="mt-2 text-2xs leading-6 text-foreground/75">{w.description}</p>
                        </div>
                        {w.recovery_score != null && (
                          <span
                            className="inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                            style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                          >
                            {RISK_LABELS[risk]}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-[10px] text-muted-foreground">{w.event_date ?? ''}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'marks' && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Работа тренера"
              title="Метки для сессий"
              subtitle="Ставьте тренерские ярлыки быстро, не выходя из карточки атлета."
            />
            <div className="grid gap-3">
              {Object.entries(COACH_MARKS).map(([key, mark]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-[24px] border px-4 py-3 shadow-sm"
                  style={{ background: mark.bg, borderColor: `${mark.text}30` }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: mark.text }}>
                      {mark.label}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {key.replace('_', ' ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Скоро — применение меток в разработке"
                    className="rounded-xl border px-3 py-1.5 text-2xs font-semibold opacity-50 cursor-not-allowed"
                    style={{ background: mark.bg, color: mark.text, borderColor: `${mark.text}40` }}
                  >
                    Скоро
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* W11 Day 53: inline comment drawer — closes the disabled-button audit from PR #63 */}
      {commentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.18em] text-orange-700">Комментарий</p>
                <h3 className="mt-1 text-lg font-bold text-navy-500">Заметка по атлету «{athlete.name}»</h3>
              </div>
              <button
                onClick={() => { setCommentOpen(false); setCError(null) }}
                className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"
                aria-label="Закрыть"
              >
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Заголовок (опционально)</label>
                <input
                  value={cTitle}
                  onChange={e => setCTitle(e.target.value.slice(0, 120))}
                  placeholder="Короткий заголовок…"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Заметка</label>
                <textarea
                  value={cNote}
                  onChange={e => setCNote(e.target.value.slice(0, 2000))}
                  rows={5}
                  placeholder="Что вы заметили? Что важно зафиксировать…"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-vertical"
                  style={{ minHeight: 100 }}
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{cNote.length}/2000</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Заметка сохраняется в журнале наблюдений ({' '}
                <Link href="/diary" className="text-orange-600 hover:underline">/diary</Link>
                {' '}) и не видна атлету по умолчанию.
              </p>
              {cError && (
                <p className="text-xs text-red-600">{cError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onSubmitComment}
                  disabled={cSaving}
                  className="kt-btn kt-btn-primary flex-1 disabled:opacity-60"
                >
                  {cSaving ? 'Сохраняю…' : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setCommentOpen(false); setCError(null) }}
                  className="kt-btn kt-btn-outline"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast after save */}
      {cToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-md bg-emerald-600 text-white">
          <i className="ki-filled ki-check-circle text-sm" />
          {cToast}
        </div>
      )}
    </Surface>
  )
}

export default function AthletesPage() {
  const { user } = useUser()
  const [athletes, setAthletes] = useState<AthleteWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    if (user.role !== 'coach' && user.role !== 'admin') return

    async function load() {
      // Find athletes via active coach_athlete connections
      const { data: conns } = await sb()
        .from('connections')
        .select('initiator_id, recipient_id')
        .eq('connection_type', 'coach_athlete')
        .eq('status', 'active')
        .or(`initiator_id.eq.${user!.id},recipient_id.eq.${user!.id}`)

      let athleteIds: string[] = []
      if (conns?.length) {
        athleteIds = conns.map(c => c.initiator_id === user!.id ? c.recipient_id : c.initiator_id)
      }

      // Admin fallback: show all athletes
      let usersQuery = sb().from('users').select('id, name, sport_type, age, gender').eq('role', 'athlete').limit(30)
      if (user!.role === 'coach' && athleteIds.length > 0) {
        usersQuery = sb().from('users').select('id, name, sport_type, age, gender').in('id', athleteIds)
      } else if (user!.role === 'coach' && athleteIds.length === 0) {
        setAthletes([]); setLoading(false); return
      }

      const { data: users_ } = await usersQuery
      if (!users_) { setLoading(false); return }

      const rows: AthleteWithStats[] = await Promise.all(
        users_.map(async u => {
          const { data: ws } = await sb()
            .from('workouts')
            .select('*')
            .eq('athlete_id', u.id)
            .order('event_date', { ascending: false })
            .limit(20)
          const workouts = (ws ?? []) as Workout[]
          const withRecovery = workouts.filter(w => w.recovery_score != null)
          const withHRV      = workouts.filter(w => w.hrv != null)
          const withRHR      = workouts.filter(w => w.avg_heart_rate != null)
          const recovery = withRecovery.length ? Math.round(withRecovery[0].recovery_score!) : 50
          return {
            ...u,
            recovery,
            hrv:      withHRV.length ? parseFloat(withHRV[0].hrv!.toFixed(1)) : null,
            rhr:      withRHR.length ? Math.round(withRHR[0].avg_heart_rate!) : null,
            sessions: workouts.length,
            recentWorkouts: workouts,
            risk:   computeRisk(recovery),
            streak: computeStreak(workouts),
          }
        })
      )
      setAthletes(rows)
      setLoading(false)
    }
    load()
  }, [user?.id, user?.role])

  if (user?.role !== 'coach' && user?.role !== 'admin') {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <i className="ki-filled ki-lock-2 text-2xl text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Доступ ограничен</p>
          <p className="mt-1 text-2sm text-muted-foreground">Этот раздел доступен только тренерам.</p>
        </div>
      </Card>
    )
  }

  // W11 Day 53: URL-driven filter — closes the disabled «Фильтр» button from PR #63 audit
  const searchParams = useSearchParams()
  const router = useRouter()
  const riskParam = searchParams.get('risk') ?? 'all'
  const sportParam = searchParams.get('sport') ?? ''

  const sportOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of athletes) if (a.sport_type) set.add(a.sport_type)
    return Array.from(set).sort()
  }, [athletes])

  const filteredAthletes = useMemo(() => {
    let arr = athletes
    if (riskParam !== 'all' && (riskParam === 'low' || riskParam === 'moderate' || riskParam === 'high' || riskParam === 'critical')) {
      arr = arr.filter(a => a.risk === riskParam)
    }
    if (sportParam) {
      const needle = sportParam.toLowerCase()
      arr = arr.filter(a => (a.sport_type ?? '').toLowerCase() === needle)
    }
    return arr
  }, [athletes, riskParam, sportParam])

  // Keep selected index valid when filter narrows the list
  useEffect(() => {
    if (filteredAthletes.length === 0) return
    if (selected >= filteredAthletes.length) setSelected(0)
  }, [filteredAthletes.length, selected])

  const setFilter = (key: 'risk' | 'sport', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    router.push(`/athletes?${params.toString()}`)
  }

  const activeFiltersCount = (riskParam !== 'all' ? 1 : 0) + (sportParam ? 1 : 0)

  const selectedAthlete = filteredAthletes[selected] ?? null
  const averageRecovery = athletes.length ? Math.round(athletes.reduce((t, a) => t + a.recovery, 0) / athletes.length) : 0
  const riskCount = athletes.filter(a => a.risk !== 'low').length
  const readyCount = athletes.filter(a => a.recovery >= 70).length
  const totalSessions = athletes.reduce((t, a) => t + a.sessions, 0)
  const selectedTone = selectedAthlete ? recoveryColor(selectedAthlete.recovery) : '#64748B'

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      <Surface className="relative">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top left, rgba(249,115,22,0.14), transparent 30%), radial-gradient(circle at right center, rgba(59,130,246,0.08), transparent 28%), linear-gradient(180deg, rgba(255,248,241,0.86), rgba(255,255,255,0.96))',
          }}
        />
        <div className="relative p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              Контур тренера
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Состав атлетов</p>
              <h2 className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-tight text-navy-500">
                Мои атлеты
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Сравнивайте готовность, отмечайте риск и держите тренерский workflow рядом с составом, не теряя общий продуктовый язык приложения.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => router.push('/athletes')}
                  className="kt-btn kt-btn-outline gap-2"
                  title="Сбросить все фильтры"
                >
                  <i className="ki-filled ki-cross-circle text-xs" />
                  Сбросить ({activeFiltersCount})
                </button>
              )}
              <Link
                href="/network?tab=find&type=people"
                className="kt-btn kt-btn-primary gap-2 no-underline"
              >
                <i className="ki-filled ki-plus text-sm" />
                Добавить атлета
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'Атлеты', value: athletes.length, icon: 'ki-people', tone: 'bg-blue-50 text-blue-600' },
              { label: 'Средняя готовность', value: `${averageRecovery}%`, icon: 'ki-abstract-26', tone: 'bg-emerald-50 text-emerald-600' },
              { label: 'В зоне риска', value: riskCount, icon: 'ki-warning-2', tone: 'bg-orange-50 text-orange-600' },
              { label: 'Готовы сейчас', value: readyCount, icon: 'ki-check-circle', tone: 'bg-violet-50 text-violet-600' },
              { label: 'Сессии', value: totalSessions, icon: 'ki-calendar', tone: 'bg-slate-50 text-slate-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-background/75 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="pf-num text-2xl leading-none text-foreground">{item.value}</div>
                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                    <i className={`ki-filled ${item.icon} text-base`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Surface>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Готовность фокуса',
            value: selectedAthlete ? `${selectedAthlete.recovery}%` : '—',
            hint: selectedAthlete ? `${selectedAthlete.name} сейчас в фокусе тренера` : 'Выберите атлета',
            icon: 'ki-abstract-26',
            tone: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Риск по составу',
            value: `${riskCount}`,
            hint: 'Атлетам нужен дополнительный контроль',
            icon: 'ki-warning-2',
            tone: 'bg-orange-50 text-orange-600',
          },
          {
            label: 'Сессии в журнале',
            value: `${totalSessions}`,
            hint: 'Общее число тренировок в базе',
            icon: 'ki-calendar',
            tone: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Средняя готовность',
            value: athletes.length ? `${averageRecovery}%` : '—',
            hint: 'Рассчитано по последним тренировкам',
            icon: 'ki-heart',
            tone: 'bg-violet-50 text-violet-600',
          },
        ].map((item) => (
          <StatTile key={item.label} {...item} />
        ))}
      </div>

      {/* W11 Day 53: filter chip row — risk + sport, URL-driven */}
      {athletes.length > 0 && (
        <Surface className="px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Риск</span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'low', 'moderate', 'high', 'critical'] as const).map(level => {
                const active = riskParam === level
                const count = level === 'all'
                  ? athletes.length
                  : athletes.filter(a => a.risk === level).length
                return (
                  <button
                    key={level}
                    onClick={() => setFilter('risk', level)}
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                      active
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-card border-border text-muted-foreground hover:border-orange-200',
                    ].join(' ')}
                  >
                    {level === 'all' ? 'Все' : level}
                    <span className="opacity-60 font-normal pf-num">{count}</span>
                  </button>
                )
              })}
            </div>
            {sportOptions.length > 0 && (
              <>
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Спорт</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilter('sport', '')}
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                      !sportParam
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-card border-border text-muted-foreground hover:border-blue-200',
                    ].join(' ')}
                  >
                    Все
                  </button>
                  {sportOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => setFilter('sport', s)}
                      className={[
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all capitalize',
                        sportParam.toLowerCase() === s.toLowerCase()
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-card border-border text-muted-foreground hover:border-blue-200',
                      ].join(' ')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="ml-auto text-[11px] text-muted-foreground">
              Показано: <span className="pf-num font-semibold text-foreground">{filteredAthletes.length}</span> / {athletes.length}
            </div>
          </div>
        </Surface>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Surface className="h-fit">
          <div className="border-b border-border px-5 py-4">
            <SectionHeader
              eyebrow="Состав"
              title="Атлеты"
              subtitle="Выберите карточку, чтобы обновить detail-панель и тренерские действия."
            />
          </div>
          <div className="space-y-3 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent mr-2" />
                Загрузка…
              </div>
            ) : athletes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <i className="ki-filled ki-people text-2xl text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Атлетов пока нет</p>
                <p className="text-2xs text-muted-foreground/60">Пригласите атлета через раздел Связи</p>
              </div>
            ) : filteredAthletes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <i className="ki-filled ki-filter text-2xl text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">По выбранным фильтрам никого нет</p>
                <button
                  onClick={() => router.push('/athletes')}
                  className="mt-1 text-2xs text-orange-600 hover:underline font-semibold"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              filteredAthletes.map((athlete, index) => (
                <AthleteCard
                  key={athlete.id}
                  athlete={athlete}
                  onSelect={() => setSelected(index)}
                  selected={selected === index}
                />
              ))
            )}
          </div>
        </Surface>

        {selectedAthlete && <AthleteDetail athlete={selectedAthlete} />}
      </div>

      {selectedAthlete && (
        <div className="rounded-[24px] border border-border bg-card px-5 py-4 text-2sm text-muted-foreground shadow-sm">
          Выберите атлета из списка, оцените готовность, а затем поставьте метку или оставьте заметку из detail-панели.
          <span className="ml-1 font-semibold text-foreground">Текущий фокус:</span>
          <span className="ml-1" style={{ color: selectedTone }}>
            {selectedAthlete.name}
          </span>
        </div>
      )}
    </div>
  )
}
