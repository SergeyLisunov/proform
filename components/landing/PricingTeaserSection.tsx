/**
 * <PricingTeaserSection /> — W16 Day 81 NEW.
 *
 * Inline pricing surface — addresses «сколько стоит?» objection до того
 * как visitor попадёт в FAQ или уйдёт. Closed-beta status: free now,
 * paid plans after launch.
 *
 * Placement: после Wearables, до Security. Visitor видит:
 *   1. Что было раньше / что меняется (BeforeAfter)
 *   2. Try free tools (LeadMagnets)
 *   3. Honest trust (SocialProof)
 *   4. Benefits + UseCases (stories с outcome)
 *   5. Wearables (что подключается)
 *   6. **Pricing teaser** (сколько стоит) ← HERE
 *   7. Security (final trust)
 *   8. FAQ + FinalCTA
 *
 * Honest framing: НЕ показываем конкретные числа здесь (тарифы DB-driven,
 * могут меняться). Показываем beta status + указатель к `/pricing` для
 * полной таблицы тарифов.
 */
import Link from 'next/link'
import { ArrowRight, Gift, Sparkles, Wallet } from 'lucide-react'

interface PricingPoint {
  icon:        typeof Gift
  title:       string
  description: string
}

const POINTS: PricingPoint[] = [
  {
    icon:        Gift,
    title:       'Сейчас — бесплатно',
    description:
      'Закрытая бета. Подключайте клуб без банковской карты и без email-форм. ' +
      'Все 6 ролей, AI-инструменты, RLS-защита, EU-Central хостинг — без ограничений по фичам.',
  },
  {
    icon:        Wallet,
    title:       'После выхода из беты',
    description:
      'Платные планы — от small clubs (до 30 атлетов) до enterprise (сеть клубов). ' +
      'Все цены рублёвые, оплата через ЮKassa с автофискализацией по 54-ФЗ. ' +
      'Никаких скрытых fees, никаких per-seat сюрпризов.',
  },
  {
    icon:        Sparkles,
    title:       'White-glove для первых 20 клубов',
    description:
      'Подключаемые в закрытой бете получают приоритетную поддержку первые 30 дней + ' +
      'миграцию первичных данных бесплатно. После launch эти клубы остаются на специальных условиях.',
  },
]

export default function PricingTeaserSection() {
  return (
    <section
      className="w-full bg-gradient-to-br from-orange-50/40 via-white to-orange-50/30 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="pricing-teaser-heading"
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Тарифы
          </p>
          <h2
            id="pricing-teaser-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Сейчас бесплатно. Без сюрпризов потом.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            ProForm в закрытой бете — все функции бесплатно. После выхода —
            прозрачные планы с публичной таблицей тарифов.
          </p>
        </div>

        {/* 3 pricing points */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {POINTS.map((p) => {
            const Icon = p.icon
            return (
              <article
                key={p.title}
                className="flex flex-col gap-3 rounded-3xl border border-border bg-white p-6 shadow-sm"
              >
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-foreground">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </article>
            )
          })}
        </div>

        {/* CTA — to /pricing for full tariff table */}
        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-orange-200 bg-white p-6 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">
              Хочется увидеть конкретные числа?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Полная таблица тарифов — для атлета, тренера, специалиста и
              организации. Цены, лимиты, что входит — всё на одной странице.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-base font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-lg no-underline"
          >
            Все тарифы
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}
