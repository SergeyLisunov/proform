/**
 * <PainSection /> — W16 Day 79 NEW.
 *
 * «Знакомая картина?» — отзеркаливает боль до того, как мы предложим
 * решение. 3 illustrative pain cards (5 чатов, Excel хаос, бумажные
 * карточки). Каждая carta = real-life scenario, который visitor
 * мгновенно узнаёт.
 *
 * Placement: сразу после Hero, до AntiPositioning. Cause activation
 * перед differentiation.
 *
 * Visual: light bg-slate-50, persona-coded pain icons, no emojis (avoid
 * playful tone). Footer hint pre-bridges к solution.
 */
import { FileSpreadsheet, FileText, MessagesSquare } from 'lucide-react'

interface PainCard {
  /** Lucide icon component. */
  icon:        typeof MessagesSquare
  /** Title — quoted user voice (in quotes). */
  title:       string
  /** 2-3 sentence description of the chaos. */
  description: string
  /** Persona-coded hue для icon background. */
  hue:         { bg: string; text: string }
}

const PAINS: PainCard[] = [
  {
    icon:        MessagesSquare,
    title:       '«3 чата в Telegram + 2 в WhatsApp»',
    description:
      'Тренеры пишут одно, родители — другое, врач — в третьем. ' +
      'Кто кому ответил и где — теряется на следующий день.',
    hue:         { bg: '#FFF7ED', text: '#C2410C' },
  },
  {
    icon:        FileSpreadsheet,
    title:       '«Excel с цветными ячейками»',
    description:
      'Расписание в одной таблице, нагрузка — в другой, ' +
      'посещаемость — в третьей. Кто-то случайно удалил столбец, ' +
      'а кто-то перезаписал чужие данные.',
    hue:         { bg: '#EFF6FF', text: '#1D4ED8' },
  },
  {
    icon:        FileText,
    title:       '«Медицинские карточки в бумаге»',
    description:
      'Доктор пишет рекомендации тренеру на бумажке. ' +
      'Тренер забыл — атлет на тренировке с не до конца зажившей травмой.',
    hue:         { bg: '#FEF2F2', text: '#B91C1C' },
  },
]

function PainTile({ pain }: { pain: PainCard }) {
  const { icon: Icon, title, description, hue } = pain
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-6 shadow-sm">
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: hue.bg, color: hue.text }}
      >
        <Icon size={26} strokeWidth={2} />
      </div>
      <h3 className="text-lg font-bold leading-snug text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </article>
  )
}

export default function PainSection() {
  return (
    <section
      className="w-full bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="pain-heading"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Знакомая картина?
          </p>
          <h2
            id="pain-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Спортивный клуб не должен работать как 5 разных программ
          </h2>
        </div>

        {/* Grid — 1 col mobile → 3 col desktop */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PAINS.map((p) => (
            <PainTile key={p.title} pain={p} />
          ))}
        </div>

        {/* Bridge to solution */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          ProForm заменяет все три картинки одной системой —{' '}
          <a href="#how-it-works" className="font-semibold text-orange-600 hover:underline">
            смотреть как →
          </a>
        </p>
      </div>
    </section>
  )
}
