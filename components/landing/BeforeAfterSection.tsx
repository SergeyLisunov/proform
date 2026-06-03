/**
 * <BeforeAfterSection /> — W16 Day 80 NEW.
 *
 * Visual transformation: 2-column «До / После» table с 6 rows, each
 * сравнивает chaos state (с 5 разными tools) vs Sporteo state.
 *
 * Placement: после Workflow + Roles, до LeadMagnets — visitor видит
 * concrete transformation prior to trying tools.
 *
 * Why table not chart: concrete claims, not abstract metrics. Each row
 * = одна боль из W16 Day 79 PainSection mirrored to its outcome.
 *
 * Design: 2-column на desktop (visual «vs»), 1-column stacked на mobile
 * (Before block first, After block second, dotted divider with «→»).
 */
import { Check, X } from 'lucide-react'

interface ComparisonRow {
  /** Topic label — e.g. «Инструменты», «Время на сводку». */
  topic:  string
  /** Before state — chaos, painful, slow. */
  before: string
  /** After state — clean, contained, fast. */
  after:  string
}

const ROWS: ComparisonRow[] = [
  {
    topic:  'Где живут данные',
    before: 'Excel, чаты в мессенджерах, бумажные медкарты — в пяти разных местах',
    after:  'Единая карточка спортсмена: история, медкарта, нагрузки и план — в одном окне',
  },
  {
    topic:  'История спортсмена',
    before: 'Теряется на следующий день — никто не видит полной картины',
    after:  'Вся история под рукой годами: ничего не пропадает при смене тренера',
  },
  {
    topic:  'Контроль нагрузки',
    before: 'На глаз. Перетренированность замечают, когда уже поздно',
    after:  'Авторасчёт нагрузки (ACWR) и циклов — система сама подсвечивает перебор',
  },
  {
    topic:  'Травмы',
    before: 'Случаются внезапно — выбивают спортсмена и срывают сезон',
    after:  'ML-модель заранее предупреждает о риске — успеваете снизить нагрузку',
  },
  {
    topic:  'Медицинские данные',
    before: 'В чате или бумажной папке — кто угодно может увидеть',
    after:  'Защита уровня СУБД: Row-Level Security и шифрование данных',
  },
  {
    topic:  'Еженедельная сводка',
    before: '30+ минут вручную собирать данные из пяти источников',
    after:  '30 секунд: готовые отчёты и кабинеты для клуба, тренера и врача',
  },
]

function BeforeCell({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <X
        aria-hidden="true"
        size={18}
        strokeWidth={2.5}
        className="mt-0.5 shrink-0 text-slate-400"
      />
      <p className="text-sm leading-snug text-slate-600">{text}</p>
    </div>
  )
}

function AfterCell({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <Check
        aria-hidden="true"
        size={18}
        strokeWidth={2.5}
        className="mt-0.5 shrink-0 text-emerald-700"
      />
      <p className="text-sm font-medium leading-snug text-foreground">{text}</p>
    </div>
  )
}

export default function BeforeAfterSection() {
  return (
    <section
      className="w-full bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="before-after-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Трансформация
          </p>
          <h2
            id="before-after-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Было хаотично — стало под контролем
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Мессенджеры, Excel и бумага против единой карточки спортсмена.
            Шесть переходов, которые руководитель клуба чувствует уже в первый месяц.
          </p>
        </div>

        {/* Comparison header (desktop) */}
        <div className="mt-12 hidden grid-cols-[2fr_1fr_1fr] gap-4 px-2 text-2xs font-bold uppercase tracking-wider lg:grid">
          <div className="text-muted-foreground">Что меняется</div>
          <div className="text-slate-500">До Sporteo</div>
          <div className="text-emerald-700">После Sporteo</div>
        </div>

        {/* Rows */}
        <div className="mt-4 space-y-4 lg:space-y-3">
          {ROWS.map((row) => (
            <article
              key={row.topic}
              className="grid gap-3 rounded-3xl border border-border bg-white p-5 shadow-sm lg:grid-cols-[2fr_1fr_1fr] lg:items-stretch lg:gap-4 lg:p-5"
            >
              {/* Topic */}
              <div className="flex items-center">
                <h3 className="text-base font-bold text-navy-500 lg:text-sm">
                  {row.topic}
                </h3>
              </div>

              {/* Before — mobile shows «До:» label inline */}
              <div>
                <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-slate-500 lg:hidden">
                  До
                </p>
                <BeforeCell text={row.before} />
              </div>

              {/* After — mobile shows «После:» label inline */}
              <div>
                <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-emerald-700 lg:hidden">
                  После
                </p>
                <AfterCell text={row.after} />
              </div>
            </article>
          ))}
        </div>

        {/* Bridge */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Перенести клуб в Sporteo — дело нескольких минут.{' '}
          <a
            href="/auth/register"
            className="font-semibold text-orange-600 hover:underline"
          >
            Подключить клуб →
          </a>
        </p>
      </div>
    </section>
  )
}
