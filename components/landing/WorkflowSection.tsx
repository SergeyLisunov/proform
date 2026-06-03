/**
 * <WorkflowSection /> — solution-stage «как это работает» for Sporteo.
 *
 * 3-step numbered timeline по дата-продукт arc:
 *   1. Сбор — дневник тренировок + импорт с носимых устройств
 *   2. Анализ — авторасчёт нагрузки (ACWR), циклы, ML-прогноз риска травм
 *   3. Действие — рекомендации, адаптивный план, отчёты по ролям
 *
 * Visual: vertical timeline mobile, horizontal flow на lg+ с numbered
 * cards + ArrowRight между ними. Each step — 2-3 role-tagged bullets.
 *
 * Anchor #how-it-works — PainSection bridges hint к этой секции.
 */
import { Activity, ArrowRight, ClipboardList, Sparkles } from 'lucide-react'

interface Step {
  num:   number
  icon:  typeof ClipboardList
  title: string
  body:  string
  /** What happens at this step — short role-tagged bullets. */
  bullets: Array<{ role: string; action: string }>
  hue:   { bg: string; ring: string; text: string }
}

const STEPS: Step[] = [
  {
    num:   1,
    icon:  ClipboardList,
    title: 'Сбор данных',
    body:  'Спортсмен и тренер ведут дневник тренировок и самочувствия, а данные с умных часов и трекеров подтягиваются автоматически. Ничего не вносится дважды.',
    bullets: [
      { role: 'Спортсмен',       action: 'Дневник тренировок и самочувствия' },
      { role: 'Носимые',         action: 'Импорт с умных часов и трекеров' },
      { role: 'Тренер',          action: 'Фиксирует планы и обратную связь' },
    ],
    hue: { bg: '#EFF6FF', ring: '#BFDBFE', text: '#1D4ED8' },
  },
  {
    num:   2,
    icon:  Activity,
    title: 'Анализ нагрузки и риска',
    body:  'Платформа сама считает нагрузку (ACWR) и циклы тренировок, а ML-модель прогнозирует риск травм — и предупреждает раньше, чем спортсмен «сломается».',
    bullets: [
      { role: 'Аналитика',       action: 'Авторасчёт нагрузки (ACWR) и циклов' },
      { role: 'ML-модель',       action: 'Прогноз риска травм, раннее предупреждение' },
      { role: 'Тренер',          action: 'Видит готовность и зоны риска по группе' },
    ],
    hue: { bg: '#FEF0E7', ring: '#FBC1A0', text: '#B03D04' },
  },
  {
    num:   3,
    icon:  Sparkles,
    title: 'Рекомендации и отчёты',
    body:  'На основе аналитики Sporteo формирует рекомендации и адаптирует план тренировок, а руководитель и врач получают готовые отчёты по своим ролям.',
    bullets: [
      { role: 'Спортсмен',       action: 'Адаптивный план и рекомендации' },
      { role: 'Врач',            action: 'Корректирует ограничения и нагрузку' },
      { role: 'Руководитель',    action: 'Отчёты и риск-картина по всему клубу' },
    ],
    hue: { bg: '#F0FDF4', ring: '#BBF7D0', text: '#15803D' },
  },
]

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const { num, icon: Icon, title, body, bullets, hue } = step
  return (
    <article className="relative flex flex-col gap-5 rounded-3xl border-2 bg-white p-6 shadow-sm sm:p-7" style={{ borderColor: hue.ring }}>
      {/* Number + icon row */}
      <div className="flex items-start justify-between gap-3">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: hue.bg, color: hue.text }}
        >
          <Icon size={26} strokeWidth={2} />
        </div>
        <span
          aria-hidden="true"
          className="pf-num text-5xl font-bold opacity-25 sm:text-6xl"
          style={{ color: hue.text }}
        >
          {String(num).padStart(2, '0')}
        </span>
      </div>

      {/* Title + body */}
      <div>
        <p className="text-2xs font-bold uppercase tracking-wider" style={{ color: hue.text }}>
          Шаг {num}
        </p>
        <h3 className="mt-1 text-xl font-bold tracking-tight text-navy-500 sm:text-2xl">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {body}
        </p>
      </div>

      {/* Role-tagged bullets */}
      <ul className="space-y-2 border-t pt-4" style={{ borderColor: hue.ring }}>
        {bullets.map((b) => (
          <li key={`${num}-${b.role}-${b.action}`} className="flex items-start gap-2.5 text-sm">
            <span
              className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: hue.bg, color: hue.text }}
            >
              {b.role}
            </span>
            <span className="leading-snug text-muted-foreground">{b.action}</span>
          </li>
        ))}
      </ul>

      {/* Arrow connector — desktop only, hidden on last step */}
      {!isLast && (
        <ArrowRight
          aria-hidden="true"
          size={28}
          strokeWidth={2}
          className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-muted-foreground/40 lg:block"
          style={{ color: `${hue.text}66` }}
        />
      )}
    </article>
  )
}

export default function WorkflowSection() {
  return (
    <section
      id="how-it-works"
      className="w-full bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="workflow-heading"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Как это работает
          </p>
          <h2
            id="workflow-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Сбор данных → анализ → рекомендации
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Дневник и носимые устройства, авторасчёт нагрузки и ML-прогноз риска травм,
            адаптивный план и отчёты — три шага от сырых данных к решениям, которые берегут спортсменов.
          </p>
        </div>

        {/* 3-step timeline */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step, idx) => (
            <StepCard key={step.num} step={step} isLast={idx === STEPS.length - 1} />
          ))}
        </div>

        {/* Bridge */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Сырые данные превращаются в прогноз и готовый план автоматически.{' '}
          <a href="#tools" className="font-semibold text-orange-600 hover:underline">
            Попробовать AI-инструменты Sporteo →
          </a>
        </p>
      </div>
    </section>
  )
}
