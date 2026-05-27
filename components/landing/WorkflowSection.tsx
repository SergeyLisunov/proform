/**
 * <WorkflowSection /> — Sprint W14 Day 70; refactored W16 Day 81.
 *
 * Previous: 6 flat cards в 3-col grid — каждая роль = отдельный шаг.
 * Feedback: «cramped, нет "aha"», читается как fragmented list.
 *
 * Day 81 rebuild: 3-step numbered timeline с narrative arc:
 *   1. Подключение — клуб строит структуру (онбоардинг)
 *   2. Работа — все роли действуют в своих контурах (operational)
 *   3. Контроль — руководитель видит общую картину (oversight)
 *
 * Visual: vertical timeline mobile с connector lines, horizontal flow
 * на lg+ с numbered cards + ArrowRight между ними. Each step richer
 * чем micro-card — includes 2-3 role-tagged bullets «что происходит
 * на этом шаге».
 *
 * Anchor #how-it-works — Day 79 PainSection bridges hint к этой секции.
 */
import { ArrowRight, Building2, ChartLine, Workflow } from 'lucide-react'

interface Step {
  num:   number
  icon:  typeof Building2
  title: string
  body:  string
  /** What happens at this step — short role-tagged bullets. */
  bullets: Array<{ role: string; action: string }>
  hue:   { bg: string; ring: string; text: string }
}

const STEPS: Step[] = [
  {
    num:   1,
    icon:  Building2,
    title: 'Подключение',
    body:  'Руководитель создаёт организацию, приглашает тренеров и врачей одним инвайтом. Pre-built роли — никакого DIY access control.',
    bullets: [
      { role: 'Руководитель',    action: 'Создаёт клуб, добавляет команды' },
      { role: 'Тренер',          action: 'Принимает инвайт, видит свою группу' },
      { role: 'Врач',            action: 'Принимает инвайт в медицинский слой' },
    ],
    hue: { bg: '#EFF6FF', ring: '#BFDBFE', text: '#1D4ED8' },
  },
  {
    num:   2,
    icon:  Workflow,
    title: 'Работа в своих контурах',
    body:  'Каждая роль действует в своём интерфейсе. Данные сходятся в общую картину автоматически — без копи-пасты между tool’ами.',
    bullets: [
      { role: 'Тренер',          action: 'Ведёт планы, отзывы, контроль готовности' },
      { role: 'Атлет',           action: 'Видит план, рекомендации, прогресс' },
      { role: 'Врач',            action: 'Пишет рекомендации привязанные к атлету' },
      { role: 'Родитель',        action: 'Видит прогресс ребёнка без чатов' },
    ],
    hue: { bg: '#FFF7ED', ring: '#FED7AA', text: '#C2410C' },
  },
  {
    num:   3,
    icon:  ChartLine,
    title: 'Контроль и видимость',
    body:  'Руководитель открывает один дашборд — видит загрузку всех команд, риски по атлетам, activity feed по событиям. Без 30-минутных еженедельных сводок из 5 файлов.',
    bullets: [
      { role: 'Руководитель',    action: 'Health-score клуба + риск-картина' },
      { role: 'Admin',           action: 'Audit trail всех решений и событий' },
      { role: 'Все',             action: 'Activity feed по атлету — навсегда' },
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
        <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
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
            Как работает
          </p>
          <h2
            id="workflow-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Подключение → работа → контроль
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Три фазы внедрения ProForm в клуб. От первого инвайта до
            ежедневного контроля состояния организации — за 10 минут.
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
          Каждая роль работает в своём интерфейсе, а данные сходятся в одну картину.{' '}
          <a href="#tools" className="font-semibold text-orange-600 hover:underline">
            Попробовать AI-инструменты ProForm →
          </a>
        </p>
      </div>
    </section>
  )
}
