/**
 * <UseCasesSection /> — Sprint W14 Day 71.
 *
 * 3 sales-ready use cases. Каждая card показывает конкретный сегмент
 * (club / academy / freelance coach) с pain → solution framing.
 *
 * Mobile: horizontal scroll snap для всех 3 cards.
 * Desktop: 3-column grid.
 */
import { Building2, GraduationCap, Target } from 'lucide-react'

interface UseCase {
  icon:     typeof Building2
  segment:  string
  title:    string
  pain:     string
  solution: string
  outcome:  string
  accent:   string
  bg:       string
}

const USE_CASES: UseCase[] = [
  {
    icon:     Building2,
    segment:  'Спортивный клуб',
    title:    'Контроль над всеми составами в одном экране',
    pain:     'Раньше: 12 тренеров → 12 чатов → таблица в Excel с отставанием на неделю',
    solution: 'Группы и команды на платформе, доступы по ролям, аналитика по всему клубу в realtime',
    outcome:  'GM видит риск-картину каждое утро, а не раз в месяц',
    accent:   '#2563EB',
    bg:       '#EFF6FF',
  },
  {
    icon:     GraduationCap,
    segment:  'Спортивная академия',
    title:    'Прозрачность для родителей без участия в каждом чате',
    pain:     'Раньше: родители звонят тренеру по каждой тренировке, тренер тратит часы на ответы',
    solution: 'У родителя свой view с прогрессом ребёнка, расписанием и медограничениями',
    outcome:  'Тренер фокусируется на тренировках, родитель видит то, что нужно',
    accent:   '#7C3AED',
    bg:       '#F5F3FF',
  },
  {
    icon:     Target,
    segment:  'Тренер-фрилансер',
    title:    'Профессиональный workflow без enterprise-цены',
    pain:     'Раньше: Notion + Excel + WhatsApp — атлеты теряются, а ты — выглядишь несерьёзно',
    solution: 'Карточки атлетов, дневник, отзывы и отчёты в одном инструменте',
    outcome:  'Презентация спонсорам — Health Snapshot PDF в один клик',
    accent:   '#16A34A',
    bg:       '#F0FDF4',
  },
]

export default function UseCasesSection() {
  return (
    <section className="w-full bg-white py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Для кого
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            3 типа клиентов, для которых это работает прямо сейчас
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            ProForm одинаково хорошо подходит и большому клубу с 200 атлетами,
            и тренеру-фрилансеру с 8 учениками. Объём масштабируется — подход не меняется.
          </p>
        </div>

        {/* 3-column grid */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase) => {
            const Icon = useCase.icon
            return (
              <article
                key={useCase.segment}
                className="flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: useCase.accent + '30' }}
              >
                {/* Segment badge */}
                <div
                  className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-wider"
                  style={{ background: useCase.bg, color: useCase.accent }}
                >
                  <Icon size={12} strokeWidth={2.5} />
                  {useCase.segment}
                </div>

                {/* Title */}
                <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground">
                  {useCase.title}
                </h3>

                {/* Pain → Solution → Outcome */}
                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Боль
                    </dt>
                    <dd className="mt-1 leading-relaxed text-muted-foreground">{useCase.pain}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Решение
                    </dt>
                    <dd className="mt-1 leading-relaxed text-muted-foreground">{useCase.solution}</dd>
                  </div>
                  <div className="border-t pt-3" style={{ borderColor: useCase.accent + '30' }}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: useCase.accent }}>
                      Результат
                    </dt>
                    <dd className="mt-1 font-semibold leading-relaxed text-foreground">{useCase.outcome}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
