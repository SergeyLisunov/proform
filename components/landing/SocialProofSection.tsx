/**
 * <SocialProofSection /> — proof-пойнты для клиента (спортшкола / клуб / академия).
 *
 * Назначение: убедить лицо, принимающее решение, что Sporteo — рабочая,
 * проверенная платформа, а не идея на бумаге. Опора на фактические
 * proof-пойнты: работающий MVP, ML-модель риска травм (AUC ≈ 0,75),
 * отзывы спортивных федераций, протестированная интеграция с носимыми
 * устройствами, патентный поиск без аналогов и руководство —
 * олимпийский призёр и кандидат экономических наук.
 *
 * Structure: header chip + 4 proof-блока + closing note с CTA.
 */
import { Activity, Award, BadgeCheck, MessageSquareQuote, Search, Sparkles } from 'lucide-react'

interface TrustBlock {
  icon:        typeof BadgeCheck
  title:       string
  description: string
}

const BLOCKS: TrustBlock[] = [
  {
    icon:        BadgeCheck,
    title:       'Платформа уже работает',
    description:
      'Это не презентация и не обещание. Рабочая платформа создана и доступна: единая карточка спортсмена, дневник тренировок и кабинеты для клуба, тренера и врача — можно пользоваться сегодня.',
  },
  {
    icon:        Activity,
    title:       'Прогноз травм с точностью AUC ≈ 0,75',
    description:
      'ML-модель риска травм проверена на валидации и показывает AUC ≈ 0,75. Система предупреждает о риске заранее — у тренера есть время снизить нагрузку, а не констатировать травму постфактум.',
  },
  {
    icon:        MessageSquareQuote,
    title:       'Одобрение спортивных федераций',
    description:
      'Подход Sporteo уже получил отзывы от спортивных федераций. А интеграция с «умными» часами и трекерами протестирована — данные спортсмена попадают в систему автоматически.',
  },
  {
    icon:        Award,
    title:       'Команда, которой доверяют',
    description:
      'Во главе проекта — призёр Олимпийских игр и кандидат экономических наук со 100+ научными публикациями. Спорт высоких достижений и научный подход к данным — в одной команде.',
  },
]

function TrustTile({ block }: { block: TrustBlock }) {
  const { icon: Icon, title, description } = block
  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-border bg-white p-6">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"
      >
        <Icon size={22} strokeWidth={2} />
      </div>
      <h3 className="text-base font-bold text-navy-500">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  )
}

export default function SocialProofSection() {
  return (
    <section
      className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="social-proof-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header с proof status chip */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-orange-700">
            <Sparkles aria-hidden="true" size={13} />
            Проверено на практике
          </span>
          <h2
            id="social-proof-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Почему Sporteo можно доверять
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Рабочая платформа, проверенная ML-модель, одобрение федераций
            и команда уровня спорта высоких достижений. Не слова — факты,
            на которые можно опереться при выборе.
          </p>
        </div>

        {/* 4 proof blocks */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {BLOCKS.map((b) => (
            <TrustTile key={b.title} block={b} />
          ))}
        </div>

        {/* Proof closer note */}
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/40 p-6 text-center">
          <p className="flex flex-col items-center gap-3 text-sm leading-relaxed text-muted-foreground sm:flex-row sm:items-start sm:text-left">
            <Search
              aria-hidden="true"
              size={20}
              className="shrink-0 text-orange-600 sm:mt-0.5"
            />
            <span>
              <strong className="text-orange-700">Решение уникально:</strong>{' '}
              патентный поиск не выявил прямых аналогов на рынке —
              вы получаете то, чего нет у конкурентов. Лучший способ убедиться —
              попробовать самим: оцените{' '}
              <a href="#tools" className="font-semibold text-orange-600 hover:underline">
                бесплатные AI-инструменты
              </a>{' '}
              или{' '}
              <a href="/contacts" className="font-semibold text-orange-600 hover:underline">
                запросите демонстрацию для клуба
              </a>
              .
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
