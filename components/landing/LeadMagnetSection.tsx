/**
 * <LeadMagnetSection /> — W16 Day 78; trim W16 Day 80.
 *
 * Day 78 original shipped 6 cards в 3-col grid (paradox of choice).
 * Day 80 trims к **3 hero tools** + featured Club Audit prominently
 * displayed на top + ссылка «+3 ещё инструмента» для остальных 3.
 *
 * Featured tool = Club Audit (★ для Org owners — primary B2B magnet).
 * Renders как large card spanning 2 columns at lg+, отдельно над grid.
 *
 * Other public tools (ACWR, Overtraining, Medical Summary) — surfaced
 * через secondary link к combined /tools/ listing (TBD page) OR direct
 * к each tool через text links.
 */
import Link from 'next/link'
import {
  ArrowUpRight,
  Building2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

interface LeadMagnet {
  title:       string
  persona:     string
  description: string
  href:        string
  hue:         { bg: string; ring: string; text: string }
  icon:        typeof Building2
  ttv:         string
}

const HUE = {
  org:     { bg: '#EFF6FF', ring: '#BFDBFE', text: '#1D4ED8' },
  coach:   { bg: '#FFF7ED', ring: '#FED7AA', text: '#C2410C' },
  athlete: { bg: '#F0FDF4', ring: '#BBF7D0', text: '#15803D' },
}

const FEATURED: LeadMagnet = {
  title:       'Бесплатный аудит клуба',
  persona:     'Руководитель / собственник',
  description:
    'Health-score клуба, топ-3 зоны риска и план действий на 30 дней. ' +
    'AI анализирует структуру вашей организации и показывает, ' +
    'где вы теряете управляемость и деньги прямо сейчас — до покупки платформы.',
  href:        '/tools/club-audit',
  hue:         HUE.org,
  icon:        Building2,
  ttv:         '60 секунд',
}

const SECONDARY: LeadMagnet[] = [
  {
    title:       'Снимок риска команды',
    persona:     'Тренер · Клуб',
    description: 'Светофор риска травм по команде + причины + план на 7-14 дней.',
    href:        '/tools/team-risk',
    hue:         HUE.coach,
    icon:        ShieldAlert,
    ttv:         '60 сек',
  },
  {
    title:       'Адаптивный план',
    persona:     'Атлет',
    description: 'AI-план тренировок на 7 дней под вашу цель и 4 недели нагрузки.',
    href:        '/tools/adaptive-plan',
    hue:         HUE.athlete,
    icon:        TrendingUp,
    ttv:         '60 сек',
  },
]

const MORE_TOOLS: Array<{ label: string; href: string }> = [
  { label: 'Medical Summary',           href: '/tools/medical-summary' },
  { label: 'ACWR Калькулятор',          href: '/tools/acwr' },
  { label: 'Тест на перетренированность', href: '/tools/overtraining' },
]

function FeaturedCard() {
  const { title, persona, description, href, hue, icon: Icon, ttv } = FEATURED
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-3xl border-2 bg-white p-7 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-8 lg:flex-row lg:items-start lg:gap-7"
      style={{ borderColor: hue.ring }}
    >
      {/* Left: icon + featured badge */}
      <div className="flex shrink-0 items-start gap-4 lg:flex-col lg:items-stretch lg:gap-3">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: hue.bg, color: hue.text }}
        >
          <Icon size={30} strokeWidth={2} />
        </div>
        <div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-white"
            style={{ background: hue.text }}
          >
            <Sparkles size={11} /> Рекомендуем
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wider"
            style={{ background: hue.bg, color: hue.text }}
          >
            {ttv}
          </span>
        </div>
      </div>

      {/* Right: content */}
      <div className="flex-1">
        <h3 className="text-xl font-bold text-navy-500 sm:text-2xl">{title}</h3>
        <p className="mt-1 text-2xs font-semibold uppercase tracking-wider" style={{ color: hue.text }}>
          {persona}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-base font-bold" style={{ color: hue.text }}>
          Получить аудит бесплатно
          <ArrowUpRight
            size={18}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </div>
      </div>
    </Link>
  )
}

function SecondaryCard({ magnet }: { magnet: LeadMagnet }) {
  const { title, persona, description, href, hue, icon: Icon, ttv } = magnet
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-3xl border-2 bg-white p-6 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: hue.ring }}
    >
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
      <div>
        <h3 className="text-lg font-bold leading-snug text-navy-500">{title}</h3>
        <p className="mt-1 text-2xs font-semibold uppercase tracking-wider" style={{ color: hue.text }}>
          {persona}
        </p>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: hue.text }}>
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
            className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Убедитесь в пользе за 60 секунд — до покупки
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Без регистрации, без email-форм, без листов ожидания. Прогоните свой
            клуб через AI прямо сейчас, увидьте результат — и решайте по фактам,
            а не по обещаниям.
          </p>
        </div>

        {/* Featured card — Club Audit */}
        <div className="mt-12">
          <FeaturedCard />
        </div>

        {/* Secondary 2 cards */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {SECONDARY.map((m) => (
            <SecondaryCard key={m.href} magnet={m} />
          ))}
        </div>

        {/* More tools — text links для остальных 3 */}
        <div className="mt-8 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-5 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
            + 3 ещё инструмента
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {MORE_TOOLS.map((t, idx) => (
              <span key={t.href} className="inline-flex items-center gap-2">
                {idx > 0 && <span aria-hidden="true" className="text-orange-300">·</span>}
                <Link
                  href={t.href}
                  className="font-semibold text-orange-700 no-underline hover:underline"
                >
                  {t.label}
                </Link>
              </span>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Это та же предиктивная аналитика, что работает в полной платформе.
          Понравится результат — подключите клуб за 10 минут, от 3900&nbsp;₽ в месяц.
        </p>
      </div>
    </section>
  )
}
