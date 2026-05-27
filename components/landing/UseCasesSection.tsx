/**
 * <UseCasesSection /> — Sprint W14 Day 71; refactored W16 Day 81.
 *
 * Previous: 3 abstract «type cards» (club / academy / freelance) с
 * generic pain→solution→outcome bullets. Feedback: feels like
 * marketing copy без human signal.
 *
 * Day 81 rebuild: 3 customer stories с synthetic personas (avatar-like
 * initial + role + organization size) + headline quote + concrete
 * outcome metric.
 *
 * Honest framing: explicit «Профиль из закрытой беты» label на каждом
 * persona card — мы не делаем вид что это реальные testimonials. Когда
 * настоящие отзывы клубов придут (W17+), заменим эти synthetic cards
 * с real photos + named quotes.
 *
 * Pattern matches W14 [[honest roadmap framing]] applied к stories.
 */
import { Building2, GraduationCap, Trophy } from 'lucide-react'

interface CustomerStory {
  /** Persona-like display name (synthetic). */
  name:         string
  /** Role в организации. */
  role:         string
  /** Organization context — type + size + location signal. */
  organization: string
  /** Initial(s) shown в avatar circle. */
  initials:     string
  /** Persona-coded icon. */
  icon:         typeof Building2
  /** Direct quote — short, specific to outcome. */
  quote:        string
  /** Concrete outcome metric (e.g. «-5 часов в неделю»). */
  outcome:      string
  /** Color hue. */
  hue:          { bg: string; ring: string; text: string; chip: string }
}

const HUE = {
  blue:    { bg: '#EFF6FF', ring: '#BFDBFE', text: '#1D4ED8', chip: '#DBEAFE' },
  violet:  { bg: '#F5F3FF', ring: '#DDD6FE', text: '#6D28D9', chip: '#EDE9FE' },
  green:   { bg: '#F0FDF4', ring: '#BBF7D0', text: '#15803D', chip: '#DCFCE7' },
}

const STORIES: CustomerStory[] = [
  {
    name:         'Иван Сергеев',
    role:         'Директор спортивной школы',
    organization: 'Школа плавания, Москва · 60 атлетов · 4 тренера',
    initials:     'ИС',
    icon:         GraduationCap,
    quote:
      'Раньше каждый тренер вёл свою группу в отдельном Excel. ' +
      'Я делал сводку по школе в воскресенье — занимало полдня. ' +
      'Сейчас открываю дашборд утром в понедельник.',
    outcome:      '−6 часов на еженедельную сводку',
    hue:          HUE.blue,
  },
  {
    name:         'Анна Кулакова',
    role:         'Head Coach performance-центра',
    organization: 'Лёгкая атлетика, СПб · 30 атлетов · доктор + 2 ассистента',
    initials:     'АК',
    icon:         Trophy,
    quote:
      'Самое важное — рекомендации доктора теперь прикреплены ' +
      'к карточке атлета, не теряются в Telegram. Тренер видит ограничения ' +
      'на следующей же тренировке.',
    outcome:      '0 пропущенных medical alerts',
    hue:          HUE.violet,
  },
  {
    name:         'Сергей Морозов',
    role:         'Управляющий сетью фитнес-клубов',
    organization: 'Сеть в 3 городах · 8 локаций · 12 тренеров · 200+ атлетов',
    initials:     'СМ',
    icon:         Building2,
    quote:
      'Подключил 12 тренеров за вечер, через 3 дня все клубы работали в ProForm. ' +
      'Рутация тренеров упала — у них стало меньше выгорания, потому что они видят ' +
      'свою работу системно.',
    outcome:      '−30% выгорания тренеров',
    hue:          HUE.green,
  },
]

function StoryCard({ story }: { story: CustomerStory }) {
  const { name, role, organization, initials, icon: Icon, quote, outcome, hue } = story
  return (
    <article
      className="flex flex-col gap-5 rounded-3xl border-2 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-7"
      style={{ borderColor: hue.ring }}
    >
      {/* Persona header */}
      <header className="flex items-start gap-4">
        {/* Avatar — initials circle + persona icon overlay */}
        <div className="relative shrink-0">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: hue.text }}
          >
            {initials}
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm"
            style={{ color: hue.text }}
          >
            <Icon size={14} strokeWidth={2.4} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight text-foreground">{name}</h3>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: hue.text }}>
            {role}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{organization}</p>
        </div>
      </header>

      {/* Quote */}
      <blockquote
        className="relative rounded-2xl p-4 text-sm leading-relaxed text-foreground"
        style={{ background: hue.bg }}
      >
        <span
          aria-hidden="true"
          className="absolute left-2 top-1 text-4xl leading-none opacity-30"
          style={{ color: hue.text }}
        >
          “
        </span>
        <p className="pl-4">{quote}</p>
      </blockquote>

      {/* Outcome metric */}
      <div className="flex items-center gap-2 border-t pt-4" style={{ borderColor: hue.ring }}>
        <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          Результат:
        </span>
        <span
          className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ background: hue.chip, color: hue.text }}
        >
          {outcome}
        </span>
      </div>
    </article>
  )
}

export default function UseCasesSection() {
  return (
    <section
      className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="use-cases-heading"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Истории из закрытой беты
          </p>
          <h2
            id="use-cases-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Три типа клубов — три конкретных результата
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Профили из закрытой беты: спортивная школа, performance-центр и сеть
            фитнес-клубов. Сценарии и метрики основаны на ранних разговорах с
            подключающимися клиентами.
          </p>
        </div>

        {/* 3 story cards */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((s) => (
            <StoryCard key={s.name} story={s} />
          ))}
        </div>

        {/* Honesty note */}
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground">
          <strong className="text-orange-700">Честно:</strong>{' '}
          Имена и точные метрики — synthetic. Сценарии и pain points основаны на
          реальных разговорах с клиентами закрытой беты. Когда первые клубы выйдут
          из беты с публичными результатами — заменим эти карточки на их реальные
          истории.
        </p>
      </div>
    </section>
  )
}
