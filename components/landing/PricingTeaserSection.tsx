/**
 * <PricingTeaserSection /> — convert-stage pricing surface.
 *
 * Inline pricing block — closes «сколько стоит?» objection до того, как
 * клиент уйдёт. Чёткий якорь цены (от 3900 ₽/мес) + ценность за деньги:
 * одна система вместо пяти, защита медданных, предиктивная аналитика.
 *
 * Структура компонента, экспорт и CTA-ссылка на /pricing сохранены.
 */
import Link from 'next/link'
import { ArrowRight, Layers, ShieldCheck, Sparkles } from 'lucide-react'

interface PricingPoint {
  icon:        typeof Layers
  title:       string
  description: string
}

const POINTS: PricingPoint[] = [
  {
    icon:        Layers,
    title:       'Одна система вместо пяти',
    description:
      'Excel, мессенджеры, бумажные медкарты и заметки тренера — в одной карточке атлета. ' +
      'Платите за один инструмент, а закрываете расписание, дневник, медкарту и отчётность клуба.',
  },
  {
    icon:        ShieldCheck,
    title:       'Защита и аналитика — в каждом тарифе',
    description:
      'Все 4 роли, защита медданных уровня СУБД (Row-Level Security), шифрование данных ' +
      'и предиктивная аналитика нагрузки уже включены. Без скрытых доплат и сюрпризов за место.',
  },
  {
    icon:        Sparkles,
    title:       'Окупается на первой травме',
    description:
      'Раннее предупреждение о риске травмы экономит недели восстановления одного атлета — ' +
      'это дороже годовой подписки. Сопровождаем запуск и переносим первичные данные клуба.',
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
            className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Вся подготовка клуба — от 3900&nbsp;₽ в месяц
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Меньше стоимости одного абонемента — а вы получаете единую карточку
            атлета, контроль нагрузок и защиту медданных для всего клуба. Цены
            рублёвые, прозрачные, без скрытых доплат.
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
                <h3 className="text-base font-bold text-navy-500">{p.title}</h3>
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
              Сколько это для вашего клуба?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Полная таблица тарифов — для атлета, тренера, специалиста и
              организации. Цены, лимиты, что входит — всё на одной странице.
              Подберите план под размер клуба за минуту.
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
