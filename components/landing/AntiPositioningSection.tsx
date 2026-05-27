/**
 * <AntiPositioningSection /> — W18 Day 89 REBUILD (RU-compliance).
 *
 * «ProForm — это НЕ...» — explicit anti-positioning vs RU-safe alternatives
 * only. Replaced Notion/Coda (US, restricted) and WhatsApp (Meta, banned
 * in RU) with compliant reference points: Bitrix24/AmoCRM, Excel,
 * Telegram-чат, бумажный журнал.
 *
 * 4 cards, 2×2 grid (mobile 1 col). Strike-through icon pattern preserved.
 */
import { BookOpen, Database, FileSpreadsheet, MessageCircle } from 'lucide-react'

interface NotCard {
  icon:        typeof MessageCircle
  alternative: string
  whyNotFit:   string
  proformDoes: string
}

const NOT_CARDS: NotCard[] = [
  {
    icon:        Database,
    alternative: 'CRM (Bitrix24 / AmoCRM)',
    whyNotFit:
      'Построены для sales-воронок: лиды, сделки, KPI менеджера. ' +
      'Тренировочного процесса, ACWR и медицинских ограничений — нет.',
    proformDoes:
      'Athlete passes, планы нагрузки, рекомендации врача и recovery — ' +
      'из коробки, без настройки с нуля.',
  },
  {
    icon:        FileSpreadsheet,
    alternative: 'Excel-таблицы',
    whyNotFit:
      'Нет real-time, конфликты редактирования, нет ролей. ' +
      'Кто-то случайно удалил столбец — пол-команды без данных.',
    proformDoes:
      'Single source of truth + role-based visibility + версионность. ' +
      'Никаких «упс, я перезаписал».',
  },
  {
    icon:        MessageCircle,
    alternative: 'Telegram-чаты',
    whyNotFit:
      'История теряется через 100 сообщений. ' +
      'Медданные в мессенджере — нарушение 152-ФЗ и угроза утечки.',
    proformDoes:
      'Каждый запрос привязан к контексту атлета навсегда, ' +
      'с правами доступа. Медданные изолированы + хостинг EU-Central.',
  },
  {
    icon:        BookOpen,
    alternative: 'Бумажный журнал',
    whyNotFit:
      'Теряется, горит, промокает. Нет поиска, нет истории, ' +
      'нет уведомлений. Тренер, который уволился, уносит знания с собой.',
    proformDoes:
      'Цифровая карточка атлета остаётся в организации навсегда — ' +
      'с полной историей, доступной новому тренеру в первый день.',
  },
]

function NotTile({ card }: { card: NotCard }) {
  const { icon: Icon, alternative, whyNotFit, proformDoes } = card
  return (
    <article className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-white p-6 transition-colors hover:border-orange-200 hover:shadow-sm">
      {/* Strike-through visual */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        >
          <Icon size={22} strokeWidth={2} />
          {/* Diagonal strike-through */}
          <span
            aria-hidden="true"
            className="absolute inset-0 m-auto h-[2px] w-12 rotate-45 rounded-full bg-red-500/70"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold uppercase tracking-wider text-red-600">
            ProForm — это НЕ
          </p>
          <h3 className="text-base font-bold leading-tight text-foreground sm:text-lg">
            {alternative}
          </h3>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">Почему не подходит:</span>{' '}
          {whyNotFit}
        </p>
        <p className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3 text-foreground">
          <span className="font-semibold text-orange-700">ProForm вместо:</span>{' '}
          {proformDoes}
        </p>
      </div>
    </article>
  )
}

export default function AntiPositioningSection() {
  return (
    <section
      className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="anti-positioning-heading"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Чем ProForm отличается
          </p>
          <h2
            id="anti-positioning-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Это не CRM, не таблица, не чат и не журнал
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            ProForm — операционная система спортивной организации.
            Pre-built роли, защита данных на уровне БД, workflow рассчитан
            под спорт — не generic team management.
          </p>
        </div>

        {/* Grid — 1 col mobile → 2 col tablet+ */}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {NOT_CARDS.map((c) => (
            <NotTile key={c.alternative} card={c} />
          ))}
        </div>
      </div>
    </section>
  )
}
