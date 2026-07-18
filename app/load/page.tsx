'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/lib/hooks/useToast'
import { ReadinessCard } from '@/components/analytics/ReadinessCard'
import { loadForWorkout } from '@/lib/analytics'

type Workout = {
  event_date: string
  activity_duration_min: number | null
  activity_strain: number | string | null
}

type DailyLoad = { date: string; load: number }

const ACUTE_DAYS = 7
const CHRONIC_DAYS = 28
const CHART_DAYS = 56

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : null
}

/**
 * Нагрузка одной тренировки — каноническая формула движка (@/lib/analytics):
 *   activity_strain>0 ? strain : (activity_duration_min>0 ? duration*0.1 : null).
 * loadForWorkout возвращает number|null; пустую тренировку трактуем как 0.
 */
function loadFor(w: Workout): number {
  return loadForWorkout({
    event_date: w.event_date,
    activity_strain: num(w.activity_strain),
    activity_duration_min: w.activity_duration_min,
  }) ?? 0
}

function buildDailySeries(workouts: Workout[], days: number): DailyLoad[] {
  const map = new Map<string, number>()
  for (const w of workouts) {
    map.set(w.event_date, (map.get(w.event_date) ?? 0) + loadFor(w))
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const out: DailyLoad[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const key = iso(d)
    out.push({ date: key, load: map.get(key) ?? 0 })
  }
  return out
}

function rollingAvg(series: DailyLoad[], window: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < series.length; i++) {
    if (i < window - 1) { out.push(null); continue }
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += series[j].load
    out.push(sum / window)
  }
  return out
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

type Zone = { label: string; tone: string; bar: string; text: string; advice: string }

function acwrZone(acwr: number | null): Zone {
  if (acwr === null) return {
    label: '—', tone: 'bg-slate-100 text-slate-600 border-slate-200',
    bar: 'bg-slate-300', text: 'text-slate-600',
    advice: 'Недостаточно данных для расчёта. Нужно минимум 28 дней тренировок.',
  }
  if (acwr < 0.8) return {
    label: 'Недогрузка', tone: 'bg-sky-50 text-sky-700 border-sky-200',
    bar: 'bg-sky-400', text: 'text-sky-700',
    advice: 'Нагрузка ниже обычной — есть запас. Хороший момент добавить объём или интенсивность.',
  }
  if (acwr <= 1.3) return {
    label: 'Зелёная зона', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500', text: 'text-emerald-700',
    advice: 'Текущая нагрузка сбалансирована с хронической. Продолжайте в том же духе.',
  }
  if (acwr <= 1.5) return {
    label: 'Перегрузка', tone: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500', text: 'text-amber-700',
    advice: 'Острая нагрузка выше нормы на 30–50%. Повышенный риск травм и переутомления. Разгрузите ближайшие дни.',
  }
  return {
    label: 'Красная зона', tone: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500', text: 'text-rose-700',
    advice: 'Скачок нагрузки более 50%. Высокий риск травм. Снизьте интенсивность, добавьте восстановительные дни.',
  }
}

function monotonyZone(m: number | null): Zone {
  if (m === null || !Number.isFinite(m)) return {
    label: '—', tone: 'bg-slate-100 text-slate-600 border-slate-200',
    bar: 'bg-slate-300', text: 'text-slate-600', advice: 'Недостаточно данных.',
  }
  if (m < 1.5) return {
    label: 'Разнообразно', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500', text: 'text-emerald-700',
    advice: 'Хорошее варьирование нагрузки между днями.',
  }
  if (m < 2) return {
    label: 'Средне', tone: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500', text: 'text-amber-700',
    advice: 'Нагрузка однообразна. Добавьте лёгкие или силовые разнообразные сессии.',
  }
  return {
    label: 'Монотонно', tone: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500', text: 'text-rose-700',
    advice: 'Высокая монотонность (>2) — классический предиктор переутомления. Добавьте разгрузочные дни.',
  }
}

export default function LoadPage() {
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
      const from = new Date(); from.setDate(from.getDate() - CHART_DAYS - 10); from.setHours(0, 0, 0, 0)
      const { data, error: err } = await (supabase as any)
        .from('workouts')
        .select('event_date, activity_duration_min, activity_strain')
        .eq('athlete_id', me.id)
        .gte('event_date', iso(from))
        .order('event_date', { ascending: true })
      if (err) { error(err.message); setWorkouts([]); return }
      setWorkouts((data ?? []) as Workout[])
    })()
  }, [supabase, error])

  const stats = useMemo(() => {
    if (!workouts) return null
    const series = buildDailySeries(workouts, CHART_DAYS)
    const acute   = rollingAvg(series, ACUTE_DAYS)
    const chronic = rollingAvg(series, CHRONIC_DAYS)

    const last = series.length - 1
    const curAcute   = acute[last]
    const curChronic = chronic[last]
    const acwr = curAcute !== null && curChronic !== null && curChronic > 0
      ? curAcute / curChronic
      : null

    // last 7 days loads for monotony
    const last7 = series.slice(-ACUTE_DAYS).map(s => s.load)
    const mean7 = last7.reduce((a, b) => a + b, 0) / last7.length
    const std7 = stdev(last7)
    const monotony = std7 > 0 ? mean7 / std7 : null
    const strain7 = last7.reduce((a, b) => a + b, 0) * (monotony ?? 1)

    // weekly totals (last 8 weeks)
    const weekly: { start: string; total: number }[] = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const daySeries56 = buildDailySeries(workouts, 56)
    for (let w = 0; w < 8; w++) {
      const end = new Date(today); end.setDate(today.getDate() - w * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const endISO = iso(end), startISO = iso(start)
      const total = daySeries56
        .filter(s => s.date >= startISO && s.date <= endISO)
        .reduce((a, b) => a + b.load, 0)
      weekly.push({ start: startISO, total })
    }
    weekly.reverse()

    return { series, acute, chronic, acwr, monotony, strain7, mean7, weekly, curAcute, curChronic }
  }, [workouts])

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Нагрузка · ACWR
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-navy-500">
            Светофор тренировочной нагрузки
          </h1>
          <p className="max-w-[680px] text-sm text-muted-foreground">
            ACWR = соотношение нагрузки за 7 дней к средней за 28 дней.
            Оптимальный диапазон 0.8–1.3: ниже — риск детренированности, выше — риск травм.
          </p>
        </div>
      </section>

      {/* Форма, готовность и цели (движок lib/analytics) */}
      <ReadinessCard />

      {workouts === null ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Загрузка…
        </div>
      ) : !stats || workouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Нет данных о тренировках за последние 56 дней.
        </div>
      ) : (
        <>
          {/* Traffic light */}
          <TrafficLight acwr={stats.acwr} acute={stats.curAcute} chronic={stats.curChronic} />

          {/* Chart */}
          <ChartCard series={stats.series} acute={stats.acute} chronic={stats.chronic} />

          {/* Secondary stats */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MetricCard
              title="Монотонность (7 дней)"
              value={stats.monotony !== null ? stats.monotony.toFixed(2) : '—'}
              zone={monotonyZone(stats.monotony)}
            />
            <MetricCard
              title="Strain score (7 дней)"
              value={stats.strain7 > 0 ? Math.round(stats.strain7).toString() : '—'}
              subtitle={`ср. нагрузка: ${Math.round(stats.mean7)} у.е./день`}
            />
          </div>

          {/* Weekly bars */}
          <WeeklyBars weekly={stats.weekly} />

          {/* Info block */}
          <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Как читать
            </div>
            <ul className="space-y-2 text-sm text-foreground/90">
              <li><b>Острая нагрузка (7 дней)</b> — что тело переживает прямо сейчас.</li>
              <li><b>Хроническая (28 дней)</b> — к чему тело адаптировано.</li>
              <li><b>ACWR = острая / хроническая.</b> Зелёная зона 0.8–1.3 даёт прирост формы без лишнего риска.</li>
              <li><b>Монотонность</b> — одинаковость ежедневной нагрузки. {'>'}2 — повышенный риск переутомления.</li>
              <li>Нагрузка = strain × 10 если есть данные Whoop/Apple, иначе минуты активности.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function TrafficLight({
  acwr, acute, chronic,
}: { acwr: number | null; acute: number | null; chronic: number | null }) {
  const zone = acwrZone(acwr)
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold text-white ${zone.bar}`}>
            {acwr !== null ? acwr.toFixed(2) : '—'}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Текущий ACWR</div>
            <div className={`text-xl font-bold ${zone.text}`}>{zone.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Острая {acute !== null ? Math.round(acute) : '—'} · Хроническая {chronic !== null ? Math.round(chronic) : '—'}
            </div>
          </div>
        </div>

        {/* Range bar */}
        <div className="flex-1">
          <div className="relative h-4 overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 left-[0%]   w-[40%] bg-sky-200" />
            <div className="absolute inset-y-0 left-[40%]  w-[25%] bg-emerald-300" />
            <div className="absolute inset-y-0 left-[65%]  w-[10%] bg-amber-300" />
            <div className="absolute inset-y-0 left-[75%]  w-[25%] bg-rose-400" />
            {acwr !== null && (
              <div
                className="absolute top-[-4px] h-6 w-1 rounded bg-foreground"
                style={{ left: `${Math.min(100, Math.max(0, (acwr / 2) * 100))}%` }}
                title={`ACWR ${acwr.toFixed(2)}`}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
            <span>0</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2+</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-foreground/90">{zone.advice}</p>
    </section>
  )
}

function ChartCard({
  series, acute, chronic,
}: { series: DailyLoad[]; acute: (number | null)[]; chronic: (number | null)[] }) {
  // Compute SVG paths
  const W = 960, H = 220, PADL = 32, PADR = 12, PADT = 12, PADB = 24
  const innerW = W - PADL - PADR, innerH = H - PADT - PADB
  const n = series.length
  const loads = series.map(s => s.load)
  const maxVal = Math.max(
    10,
    ...loads,
    ...acute.filter((x): x is number => x !== null),
    ...chronic.filter((x): x is number => x !== null),
  )
  const x = (i: number) => PADL + (innerW * i) / Math.max(1, n - 1)
  const y = (v: number) => PADT + innerH - (innerH * v) / maxVal

  const pathFrom = (values: (number | null)[]) => {
    let d = ''
    let started = false
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (v === null) { started = false; continue }
      d += (started ? 'L' : 'M') + x(i) + ' ' + y(v)
      started = true
    }
    return d
  }
  const barW = Math.max(2, innerW / n - 1)

  return (
    <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Нагрузка · последние {series.length} дней
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-slate-300" /> день</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-rose-500" /> острая 7д</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-sky-500" /> хрон. 28д</span>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full min-w-[720px]">
          {/* gridlines */}
          {[0.25, 0.5, 0.75].map(p => (
            <line key={p}
              x1={PADL} x2={W - PADR}
              y1={PADT + innerH * p} y2={PADT + innerH * p}
              stroke="currentColor" className="text-muted-foreground/20" />
          ))}
          {/* bars */}
          {series.map((s, i) => (
            s.load > 0 && (
              <rect key={s.date}
                x={x(i) - barW / 2} y={y(s.load)}
                width={barW} height={Math.max(1, innerH - (y(s.load) - PADT))}
                rx={1} className="fill-slate-300" />
            )
          ))}
          {/* chronic line */}
          <path d={pathFrom(chronic)} fill="none" stroke="#0EA5E9" strokeWidth={2} />
          {/* acute line */}
          <path d={pathFrom(acute)} fill="none" stroke="#EF4444" strokeWidth={2} />
        </svg>
      </div>
    </section>
  )
}

function MetricCard({
  title, value, subtitle, zone,
}: { title: string; value: string; subtitle?: string; zone?: Zone }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className={`pf-num text-2xl font-bold ${zone ? zone.text : 'text-foreground'}`}>{value}</div>
        {zone && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${zone.tone}`}>{zone.label}</span>
        )}
      </div>
      {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
      {zone?.advice && <p className="mt-2 text-xs text-foreground/80">{zone.advice}</p>}
    </section>
  )
}

function WeeklyBars({ weekly }: { weekly: { start: string; total: number }[] }) {
  const max = Math.max(1, ...weekly.map(w => w.total))
  return (
    <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Недельные объёмы
      </div>
      <div className="flex h-36 items-end gap-2">
        {weekly.map((w, i) => {
          const h = Math.round((w.total / max) * 100)
          const isLast = i === weekly.length - 1
          return (
            <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-lg ${isLast ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                style={{ height: `${Math.max(2, h)}%` }}
                title={`Неделя от ${w.start}: ${Math.round(w.total)}`}
              />
              <div className="text-[10px] text-muted-foreground">{w.start.slice(5).replace('-', '.')}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
