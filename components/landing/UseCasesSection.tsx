/**
 * <UseCasesSection /> — клиентские сценарии «ДЛЯ КОГО».
 *
 * 3 карточки целевых клиентов Sporteo: спортшкола / СШОР / академия,
 * performance-центр (команда с врачом), сеть клубов. Каждая карточка —
 * конкретная боль сегмента → выгода от платформы → измеримый результат.
 *
 * Продающий tone: говорим про реальную ценность для клиента (единая
 * карточка спортсмена, мультиролевая координация, предиктивная
 * аналитика нагрузки и риска травм), не перечисляя фичи списком.
 */
import { Building2, GraduationCap, Trophy } from 'lucide-react'

interface CustomerStory {
  /** Кому адресован сценарий. */
  name:         string
  /** Сегмент клиента / роль решателя. */
  role:         string
  /** Контекст организации — тип + масштаб. */
  organization: string
  /** Инициалы в кружке-аватаре. */
  initials:     string
  /** Иконка сегмента. */
  icon:         typeof Building2
  /** Короткий сценарий выгоды — конкретно, под результат. */
  quote:        string
  /** Измеримый результат (напр. «−6 часов в неделю»). */
  outcome:      string
  /** Цветовая гамма. */
  hue:          { bg: string; ring: string; text: string; chip: string }
}

const HUE = {
  blue:    { bg: '#EFF6FF', ring: '#BFDBFE', text: '#1D4ED8', chip: '#DBEAFE' },
  violet:  { bg: '#F5F3FF', ring: '#DDD6FE', text: '#6D28D9', chip: '#EDE9FE' },
  green:   { bg: '#F0FDF4', ring: '#BBF7D0', text: '#15803D', chip: '#DCFCE7' },
}

const STORIES: CustomerStory[] = [
  {
    name:         'Спортшкола, СШОР, академия',
    role:         'Директору и завучу по спорту',
    organization: 'Десятки групп · сотни воспитанников · единый стандарт подготовки',
    initials:     'СШ',
    icon:         GraduationCap,
    quote:
      'Каждый тренер ведёт группу в платформе, а не в своём Excel. ' +
      'Вся история воспитанника, медкарта и нагрузки — в единой карточке спортсмена ' +
      'и не теряются при смене тренера. Сводка по школе — в один клик, а не за полдня.',
    outcome:      'Единая картина по всей школе',
    hue:          HUE.blue,
  },
  {
    name:         'Команда и клуб с врачом',
    role:         'Главному тренеру и спортивному врачу',
    organization: 'Сборная команда · тренеры + врач + руководитель в одном контуре',
    initials:     'КК',
    icon:         Trophy,
    quote:
      'Тренер, врач и руководитель видят каждый своё — по ролям и без утечек. ' +
      'Предиктивная аналитика считает нагрузку (ACWR) и предупреждает о риске травмы ' +
      'заранее, а назначения врача тренер видит на следующей же тренировке.',
    outcome:      'Меньше травм и перетренированности',
    hue:          HUE.violet,
  },
  {
    name:         'Сеть клубов и локаций',
    role:         'Руководителю и управляющему сети',
    organization: 'Несколько городов · десятки тренеров · сотни спортсменов',
    initials:     'СК',
    icon:         Building2,
    quote:
      'Подключение новых тренеров и локаций — за вечер, без долгого внедрения. ' +
      'Экспертиза сильного тренера масштабируется на всю сеть через единые планы ' +
      'и отчёты, а руководитель видит работу всех клубов системно — в одном кабинете.',
    outcome:      'Масштаб без потери контроля',
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
          <h3 className="text-base font-bold leading-tight text-navy-500">{name}</h3>
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
            Для кого Sporteo
          </p>
          <h2
            id="use-cases-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl"
          >
            Один инструмент — выгода каждому в клубе
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Спортшколы и академии, команды с врачом, сети клубов — у каждого свой
            результат. Объединяем тренера, спортсмена, врача и руководителя вокруг
            единой карточки спортсмена.
          </p>
        </div>

        {/* 3 story cards */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((s) => (
            <StoryCard key={s.name} story={s} />
          ))}
        </div>

        {/* Proof note */}
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
          <strong className="text-orange-700">Платформа уже работает.</strong>{' '}
          ML-модель прогноза риска травм с точностью AUC ≈ 0,75 на валидации,
          защита медданных на уровне СУБД (Row-Level Security), интеграция с
          умными устройствами протестирована. Аналогов на рынке патентный поиск
          не нашёл. Подписка — от 3900 ₽ в месяц.
        </p>
      </div>
    </section>
  )
}
