/**
 * <LeadMagnetSection /> — W16 Day 78 NEW.
 *
 * Lead-magnet surfacing на landing. 6 free AI-инструменты which ранее
 * жили только на `/tools/*` URLs без promotion. Каждый — entry point
 * в acquisition funnel (anonymous use → email capture при export).
 *
 * Section anchor: `#tools` — Hero secondary CTA («Попробовать
 * AI-инструменты») jumps сюда. Smooth scroll behaviour inherited от
 * браузера.
 *
 * Layout: 1 col mobile → 2 col tablet → 3 col desktop. Each card:
 * persona-coded gradient + icon + title + 1-line value + persona chip +
 * «Попробовать» CTA → /tools/{slug}.
 *
 * Tracking: clicks emit `landing.tool_card_click` (W16 Day 78 — added
 * to event taxonomy). Допустимо потеря attribution здесь так как пользователь
 * leaves landing surface к tool surface immediately.
 */
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  Building2,
  HeartPulse,
  LineChart,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'

interface LeadMagnet {
  /** Title для card heading. */
  title:       string
  /** Persona chip label — кто primary audience. */
  persona:     string
  /** 1-2 sentence value description. */
  description: string
  /** Tool route (`/tools/{slug}`). */
  href:        string
  /** Persona-coded color hue для chip + icon background. */
  hue:         { bg: string; chip: string; ring: string; text: string }
  /** Lucide icon component. */
  icon:        typeof Activity
  /** Time-to-value claim — surfaced on card. */
  ttv:         string
}

// Persona color tokens (mirror RoleSection convention).
const HUE = {
  coach:    { bg: '#FFF7ED', chip: '#FED7AA', ring: '#FED7AA', text: '#C2410C' },
  athlete:  { bg: '#F0FDF4', chip: '#BBF7D0', ring: '#BBF7D0', text: '#15803D' },
  org:      { bg: '#EFF6FF', chip: '#BFDBFE', ring: '#BFDBFE', text: '#1D4ED8' },
  doctor:   { bg: '#FEF2F2', chip: '#FECACA', ring: '#FECACA', text: '#B91C1C' },
  universal:{ bg: '#FAF5FF', chip: '#DDD6FE', ring: '#DDD6FE', text: '#6D28D9' },
}

const MAGNETS: LeadMagnet[] = [
  {
    title:       'Team Risk Snapshot',
    persona:     'Тренер · Клуб',
    description: 'Введите данные команды (3-12 атлетов) — получите светофор риска, причины и план действий на 7-14 дней.',
    href:        '/tools/team-risk',
    hue:         HUE.coach,
    icon:        ShieldAlert,
    ttv:         '60 сек',
  },
  {
    title:       'Adaptive Plan',
    persona:     'Атлет',
    description: 'AI-план тренировок на 7 дней по вашей цели + последним 4 неделям нагрузки. Учитывает recovery.',
    href:        '/tools/adaptive-plan',
    hue:         HUE.athlete,
    icon:        TrendingUp,
    ttv:         '60 сек',
  },
  {
    title:       'Club Audit',
    persona:     'Организация',
    description: 'Health-score клуба + top-3 области риска + конкретный план на 30 дней. Для руководителя.',
    href:        '/tools/club-audit',
    hue:         HUE.org,
    icon:        Building2,
    ttv:         '60 сек',
  },
  {
    title:       'Medical Summary',
    persona:     'Спортивный врач',
    description: 'Структурированный AI-assessment template (triage, red flags, differential, next steps) для clinical review.',
    href:        '/tools/medical-summary',
    hue:         HUE.doctor,
    icon:        Stethoscope,
    ttv:         '5 мин',
  },
  {
    title:       'ACWR Калькулятор',
    persona:     'Тренер · Атлет',
    description: 'Введите недельную нагрузку за 4 недели — получите ACWR и цветовую зону риска травмы.',
    href:        '/tools/acwr',
    hue:         HUE.universal,
    icon:        LineChart,
    ttv:         '30 сек',
  },
  {
    title:       'Тест на перетренированность',
    persona:     'Атлет',
    description: '10 вопросов — оценка признаков overtraining syndrome с рекомендациями. Научный чек-лист.',
    href:        '/tools/overtraining',
    hue:         HUE.athlete,
    icon:        HeartPulse,
    ttv:         '2 мин',
  },
]

function MagnetCard({ magnet }: { magnet: LeadMagnet }) {
  const { title, persona, description, href, hue, icon: Icon, ttv } = magnet
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-3xl border-2 bg-white p-6 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: hue.ring }}
    >
      {/* Top row: icon + ttv badge */}
      <div className="flex items-start justify-between gap-3">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: hue.bg, color: hue.text }}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: hue.bg, color: hue.text }}
        >
          {ttv}
        </span>
      </div>

      {/* Title + persona chip */}
      <div>
        <h3 className="text-lg font-bold leading-snug text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-2xs font-semibold uppercase tracking-wider" style={{ color: hue.text }}>
          {persona}
        </p>
      </div>

      {/* Value description */}
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {/* CTA row */}
      <div className="mt-2 flex items-center gap-1.5 text-sm font-bold transition-colors" style={{ color: hue.text }}>
        Попробовать
        <ArrowUpRight
          size={16}
          className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
    </Link>
  )
}

export default function LeadMagnetSection() {
  return (
    <section
      id="tools"
      className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="lead-magnets-heading"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Бесплатные AI-инструменты
          </p>
          <h2
            id="lead-magnets-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Попробуйте платформу без регистрации
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            6 рабочих AI-инструментов для тренеров, атлетов, врачей и
            организаций. Без email-форм, без waitlist'ов — используйте прямо
            сейчас и решите, нужна ли вам полная платформа.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAGNETS.map((m) => (
            <MagnetCard key={m.href} magnet={m} />
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Все инструменты работают на тех же AI-моделях, что и платная платформа.
          Понравится — перенесите данные в свой клуб за 10 минут.
        </p>
      </div>
    </section>
  )
}
