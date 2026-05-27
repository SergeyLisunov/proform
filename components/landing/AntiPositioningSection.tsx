/**
 * <AntiPositioningSection /> — W16 Day 79 NEW.
 *
 * «ProForm — это НЕ...» — explicit anti-positioning vs Notion, CRM,
 * Telegram, Excel. Visitor мгновенно понимает чем мы НЕ являемся —
 * убирает категориальную путаницу до того, как мы объясняем чем являемся.
 *
 * Placement: сразу после PainSection, до Workflow. Pain → «не путать с
 * X/Y/Z» → solution.
 *
 * Visual: white bg, 4 cards в 2×2 grid (mobile 1 col), each с
 * strike-through icon + название alternative + почему не работает + что
 * делает ProForm иначе.
 */
import { Database, FileSpreadsheet, MessageCircle, Network } from 'lucide-react'

interface NotCard {
  /** Lucide icon — alternative platform icon. */
  icon:         typeof MessageCircle
  /** Alternative name (CRM, Notion, etc). */
  alternative:  string
  /** Why this alternative doesn't fit для спортивной организации. */
  whyNotFit:    string
  /** How ProForm differs. */
  proformDoes:  string
}

const NOT_CARDS: NotCard[] = [
  {
    icon:         Database,
    alternative:  'CRM',
    whyNotFit:
      'Bitrix24 / AmoCRM построены для sales-воронок: лиды, сделки, ' +
      'отделы продаж.',
    proformDoes:
      'ProForm построен для тренировочного процесса: ACWR, recovery, ' +
      'athlete passes, рекомендации врача — из коробки.',
  },
  {
    icon:         Network,
    alternative:  'Notion / Coda',
    whyNotFit:
      'В Notion нужно проектировать роли, права, формулы — недели работы. ' +
      'Медданные открыты всем, кому дашь доступ.',
    proformDoes:
      'Роли pre-built. Защита на уровне базы данных (RLS). ' +
      'Медицинский слой изолирован — даже Owner не видит без права.',
  },
  {
    icon:         MessageCircle,
    alternative:  'Telegram / WhatsApp',
    whyNotFit:
      'В чате история теряется через 100 сообщений. ' +
      'Медданные в незашифрованном messenger — нарушение 152-ФЗ.',
    proformDoes:
      'Каждый запрос привязан к контексту атлета — навсегда, ' +
      'с правами доступа. Медданные шифруются + хостинг EU-Central.',
  },
  {
    icon:         FileSpreadsheet,
    alternative:  'Excel / Google Sheets',
    whyNotFit:
      'Нет real-time, конфликты редактирования, нет ролей. ' +
      'Кто-то случайно удалил столбец — пол-команды без данных.',
    proformDoes:
      'Single source of truth + role-based visibility + версионность. ' +
      'Никаких «упс, я перезаписал».',
  },
]

function NotTile({ card }: { card: NotCard }) {
  const { icon: Icon, alternative, whyNotFit, proformDoes } = card
  return (
    <article className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-white p-6 transition-colors hover:border-orange-200">
      {/* Strike-through visual */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        >
          <Icon size={22} strokeWidth={2} />
          {/* Diagonal line strike-through */}
          <span
            aria-hidden="true"
            className="absolute inset-0 m-auto h-[2px] w-12 rotate-45 rounded-full bg-red-500/70"
          />
        </div>
        <div className="flex-1">
          <p className="text-2xs font-bold uppercase tracking-wider text-red-600">
            ProForm — это НЕ
          </p>
          <h3 className="text-lg font-bold text-foreground">{alternative}</h3>
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
            Это не CRM, не Notion, не мессенджер и не таблица
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
