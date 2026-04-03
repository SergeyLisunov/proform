'use client'

import { useState, type ReactNode } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { DEMO_ATHLETES, DEMO_DIARY, DEMO_SESSIONS, RISK_COLORS, COACH_MARKS, recoveryColor } from '@/lib/utils/data'
import ApexChart from '@/components/charts/ApexChart'

type TabType = 'overview' | 'sessions' | 'diary' | 'marks'
type Athlete = typeof DEMO_ATHLETES[number]

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
        <h3 className="mt-1.5 text-base font-semibold text-foreground">{title}</h3>
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
                {athlete.sport} · {athlete.id}
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
                  <span className="text-muted-foreground">HRV {athlete.hrv} ms</span>
                  <span className="font-semibold text-foreground">{loadLabel}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, athlete.hrv)}%`, background: rc }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">RHR {athlete.rhr} bpm</span>
                  <span className="text-foreground">{athlete.sessions} sessions</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(0, 100 - (athlete.rhr - 40) * 3)}%` }} />
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
    colors: ['#F97316', '#2563EB'],
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
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Demo-данные
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
                <h3 className="truncate text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-foreground">
                  {athlete.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {athlete.sport} · {athlete.age} лет · {athlete.gender === 'F' ? 'Женщина' : 'Мужчина'} · {athlete.id}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next session</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {athlete.recovery >= 70 ? 'Контролируемый прогресс' : athlete.recovery >= 50 ? 'Спокойная аэробная работа' : 'Восстановление без стресса'}
            </p>
            <p className="mt-1.5 text-2xs leading-5 text-muted-foreground">
              Следующий блок лучше держать в ритме восстановления, а не пытаться добрать лишнюю нагрузку.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Risk focus</p>
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
              Watch for overload signals before adding volume or intensity.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Работа тренера</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Комментируйте, просматривайте и ставьте метку из одной панели.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
                <i className="ki-filled ki-message-text text-xs" />
                Комментарий
              </button>
              <button className="kt-btn kt-btn-sm kt-btn-primary gap-1.5">
                <i className="ki-filled ki-tag text-xs" />
                Отметить сессию
              </button>
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
                { label: 'HRV', value: `${athlete.hrv} ms`, icon: 'ki-heart', tone: 'bg-blue-50 text-blue-600' },
                { label: 'RHR', value: `${athlete.rhr} bpm`, icon: 'ki-heart', tone: 'bg-red-50 text-red-500' },
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

            <div className="rounded-[24px] border border-border bg-background/75 p-4 shadow-sm">
              <SectionHeader
                eyebrow="Тренд"
                title="Недельная нагрузка и ВСР"
                subtitle="Линейный график остается, но живет в более собранной рабочей зоне."
              />
              <div className="mt-4">
                <ApexChart
                  type="line"
                  series={[
                    { name: 'Нагрузка', data: [8.2, 11.5, 7.1, 14.2, 10.8, 6.3, 12.1] },
                    { name: 'HRV (ms)', data: [44, 47, 45, 41, 48, 50, 47] },
                  ]}
                  options={lineOpts}
                  height={180}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'sessions' && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Недавние тренировки"
              title="История сессий"
              subtitle="Последние тренировки показаны так, чтобы нагрузка и готовность читались рядом."
            />
            <div className="overflow-hidden rounded-[24px] border border-border bg-background/75 shadow-sm">
              {DEMO_SESSIONS.slice(0, 5).map((session, index) => {
                const sessionRecovery = recoveryColor(session.recovery)

                return (
                  <div
                    key={`${session.date}-${index}`}
                    className="grid gap-4 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-accent/40 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">{session.type}</div>
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {session.date}
                        </span>
                      </div>
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {session.dur} min · Avg HR {session.avg_hr} bpm · Session strain {session.strain}
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border sm:max-w-xs">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(session.strain / 20) * 100}%` }} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-center">
                      <div className="pf-num text-xl leading-none" style={{ color: sessionRecovery }}>
                        {session.recovery}%
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">готовность</div>
                    </div>

                    <div className="hidden items-center justify-end sm:flex">
                      <div className="text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Load block</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{session.strain.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'diary' && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Дневник тренера"
              title="Наблюдения и контекст"
              subtitle="Фиксируйте мягкие сигналы, которые стоят за цифрами и метриками."
            />
            <div className="grid gap-3">
              {DEMO_DIARY.map((entry, index) => {
                const meta = RISK_COLORS[entry.risk as keyof typeof RISK_COLORS]

                return (
                  <div
                    key={`${entry.date}-${index}`}
                    className="rounded-[24px] border p-4 transition-colors hover:border-orange-200"
                    style={{ background: `${meta.bg}66`, borderColor: meta.border }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{entry.title}</div>
                        <p className="mt-2 text-2xs leading-6 text-foreground/75">{entry.note}</p>
                      </div>
                      <span
                        className="inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                      >
                        {RISK_LABELS[entry.risk]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-[10px] text-muted-foreground">{entry.date}</div>
                  </div>
                )
              })}
            </div>
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
                    className="rounded-xl border px-3 py-1.5 text-2xs font-semibold transition-all hover:opacity-80"
                    style={{ background: mark.bg, color: mark.text, borderColor: `${mark.text}40` }}
                  >
                    Применить
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Surface>
  )
}

export default function AthletesPage() {
  const { user } = useUser()
  const [selected, setSelected] = useState(0)

  if (user?.role !== 'coach' && user?.role !== 'admin') {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-card px-6 py-10 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <i className="ki-filled ki-lock-2 text-2xl text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Доступ ограничен</p>
          <p className="mt-1 text-2sm text-muted-foreground">Этот раздел доступен только тренерам.</p>
        </div>
      </div>
    )
  }

  const selectedAthlete = DEMO_ATHLETES[selected]
  const averageRecovery = Math.round(DEMO_ATHLETES.reduce((total, athlete) => total + athlete.recovery, 0) / DEMO_ATHLETES.length)
  const riskCount = DEMO_ATHLETES.filter((athlete) => athlete.risk !== 'low').length
  const readyCount = DEMO_ATHLETES.filter((athlete) => athlete.recovery >= 70).length
  const totalSessions = DEMO_ATHLETES.reduce((total, athlete) => total + athlete.sessions, 0)
  const selectedTone = recoveryColor(selectedAthlete.recovery)

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
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Обновленный shell
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Demo-данные
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Состав атлетов</p>
              <h2 className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-tight text-foreground">
                Мои атлеты
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Сравнивайте готовность, отмечайте риск и держите тренерский workflow рядом с составом, не теряя общий продуктовый язык приложения.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="kt-btn kt-btn-outline gap-2">
                <i className="ki-filled ki-filter text-xs" />
                Фильтр
              </button>
              <button className="kt-btn kt-btn-primary gap-2">
                <i className="ki-filled ki-plus text-sm" />
                Добавить атлета
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'Атлеты', value: DEMO_ATHLETES.length, icon: 'ki-people', tone: 'bg-blue-50 text-blue-600' },
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
            value: `${selectedAthlete.recovery}%`,
            hint: `${selectedAthlete.name} сейчас в фокусе тренера`,
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
            hint: 'Общее число demo-тренировок',
            icon: 'ki-calendar',
            tone: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Средняя готовность',
            value: `${averageRecovery}%`,
            hint: 'Рассчитано по текущему demo-составу',
            icon: 'ki-heart',
            tone: 'bg-violet-50 text-violet-600',
          },
        ].map((item) => (
          <StatTile key={item.label} {...item} />
        ))}
      </div>

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
            {DEMO_ATHLETES.map((athlete, index) => (
              <AthleteCard
                key={athlete.id}
                athlete={athlete}
                onSelect={() => setSelected(index)}
                selected={selected === index}
              />
            ))}
          </div>
        </Surface>

        <AthleteDetail athlete={selectedAthlete} />
      </div>

      <div className="rounded-[24px] border border-border bg-card px-5 py-4 text-2sm text-muted-foreground shadow-sm">
        Здесь тренерский workflow пока остается demo-driven: выберите атлета, оцените готовность, а затем поставьте метку или оставьте заметку из detail-панели.
        <span className="ml-1 font-semibold text-foreground">Текущий фокус:</span>
        <span className="ml-1" style={{ color: selectedTone }}>
          {selectedAthlete.name}
        </span>
      </div>
    </div>
  )
}
