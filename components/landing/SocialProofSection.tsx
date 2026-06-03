/**
 * <SocialProofSection /> — W16 Day 80 NEW.
 *
 * Trust + social proof. Закрытая бета status — нет реальных testimonials
 * пока. Honest framing: closed-beta chip + 3 credibility blocks
 * (data sovereignty / security / white-glove onboarding) + honesty note
 * о том что real testimonials появятся когда бета масштабируется.
 *
 * Complements <SecuritySection /> (W14 — compliance-tech focus) с
 * decision-maker-oriented framing (white-glove service, beta status,
 * data residency).
 *
 * Avoids: fake testimonials, fabricated client logos, made-up «X клубов»
 * count. Follows W14 «honest roadmap framing» convention extended к trust
 * surface.
 */
import { Globe2, Handshake, ShieldCheck, Sparkles } from 'lucide-react'

interface TrustBlock {
  icon:        typeof ShieldCheck
  title:       string
  description: string
}

const BLOCKS: TrustBlock[] = [
  {
    icon:        Handshake,
    title:       'White-glove onboarding',
    description:
      'Каждый подключаемый клуб получает персональный звонок с командой Sporteo + миграцию первичных данных + приоритетную поддержку первые 30 дней.',
  },
  {
    icon:        Globe2,
    title:       'Данные в EU-Central',
    description:
      'Хостинг базы данных в Supabase EU-Central-1 (Франкфурт). Соответствие 152-ФЗ через ЦОД на территории EU. Реквизиты обработки доступны по запросу.',
  },
  {
    icon:        ShieldCheck,
    title:       'RLS на каждой таблице',
    description:
      'Защита данных не только в приложении, но и на уровне базы. Каждый запрос проходит проверку прав доступа в PostgreSQL — даже compromised app сервер не даст доступ к чужим данным.',
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
        {/* Header с beta status chip */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-orange-700">
            <Sparkles aria-hidden="true" size={13} />
            Закрытая бета · По приглашению
          </span>
          <h2
            id="social-proof-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            На что опираться, когда отзывов ещё нет
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Sporteo в закрытой бете — реальные отзывы клубов появятся,
            когда первая когорта расскажет о результатах публично.
            До того — оцените инфраструктуру, процесс и обещания.
          </p>
        </div>

        {/* 3 trust blocks */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {BLOCKS.map((b) => (
            <TrustTile key={b.title} block={b} />
          ))}
        </div>

        {/* Honest framing note */}
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/40 p-6 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-orange-700">Честно:</strong>{' '}
            Мы не публикуем «у нас 100+ клубов» баннеры, пока это не правда.
            Когда первые 10 клубов выйдут из закрытой беты с конкретными
            результатами — добавим сюда их истории с реальными именами
            и метриками. До того — попробуйте платформу через{' '}
            <a href="#tools" className="font-semibold text-orange-600 hover:underline">
              бесплатные AI-инструменты
            </a>{' '}
            или{' '}
            <a href="/contacts" className="font-semibold text-orange-600 hover:underline">
              напишите нам напрямую
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
