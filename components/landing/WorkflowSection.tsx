/**
 * <WorkflowSection /> — Sprint W14 Day 70.
 *
 * Visual flow «как работает ProForm» — 6 шагов от создания организации
 * до командного flow. Цель: prospect видит за 5 секунд весь lifecycle
 * onboarding и понимает «вот так это укладывается в наш день».
 *
 * Visual: light-grey background (bg-slate-50) для contrast с белыми
 * соседними секциями. Numbered steps в vertical timeline на mobile,
 * 2×3 grid на md+, single 6-column horizontal scroll на xl+.
 */
import { ArrowRight, Building2, Heart, Stethoscope, Target, User, Workflow } from 'lucide-react'

interface Step {
  num:   number
  icon:  typeof User
  title: string
  body:  string
  color: string
  bg:    string
}

const STEPS: Step[] = [
  {
    num:   1,
    icon:  Building2,
    title: 'Организация создаёт структуру',
    body:  'Клуб подключается, создаёт группы и команды, добавляет тренеров и врачей с правильными ролями.',
    color: '#2563EB',
    bg:    '#EFF6FF',
  },
  {
    num:   2,
    icon:  Target,
    title: 'Тренер ведёт спортсменов',
    body:  'Карточки атлетов, журнал тренировок, отзывы, контроль готовности — в одном экране.',
    color: '#16A34A',
    bg:    '#F0FDF4',
  },
  {
    num:   3,
    icon:  User,
    title: 'Спортсмен видит прогресс',
    body:  'План на сегодня, самочувствие, история тренировок, отзывы тренера и видимые рекомендации врача.',
    color: '#F97316',
    bg:    '#FFF7ED',
  },
  {
    num:   4,
    icon:  Stethoscope,
    title: 'Врач контролирует ограничения',
    body:  'Медицинские заметки, противопоказания, восстановление — в изолированном медконтуре.',
    color: '#DC2626',
    bg:    '#FEF2F2',
  },
  {
    num:   5,
    icon:  Heart,
    title: 'Родитель получает прозрачность',
    body:  'Прогресс ребёнка, расписание, медицинские ограничения — без участия в каждом чате тренера.',
    color: '#7C3AED',
    bg:    '#F5F3FF',
  },
  {
    num:   6,
    icon:  Workflow,
    title: 'Данные собраны в одной системе',
    body:  'Все события и решения вокруг карточки спортсмена. Без переключений между Excel, мессенджерами и заметками.',
    color: '#0D9488',
    bg:    '#F0FDFA',
  },
]

export default function WorkflowSection() {
  return (
    <section className="w-full bg-slate-50 py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Как работает
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            От первой регистрации до командного flow
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            6 шагов от создания организации до полной операционной среды.
            Каждый шаг — это роль и её зона ответственности.
          </p>
        </div>

        {/* Steps grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isLast = idx === STEPS.length - 1
            return (
              <div
                key={step.num}
                className="group relative rounded-3xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Step number badge */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: step.bg, color: step.color }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <span
                    className="pf-num text-3xl font-bold opacity-30"
                    style={{ color: step.color }}
                  >
                    0{step.num}
                  </span>
                </div>

                {/* Title + body */}
                <h3 className="mt-5 text-base font-bold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>

                {/* Subtle arrow to next (hidden on last + on small viewports) */}
                {!isLast && (
                  <ArrowRight
                    size={14}
                    className="absolute -right-1 top-1/2 hidden -translate-y-1/2 text-muted-foreground/30 lg:block xl:hidden"
                    aria-hidden
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer line */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Один раз настроил структуру — дальше каждая роль работает в своём инструменте,
          а данные сходятся в одну картину.
        </p>
      </div>
    </section>
  )
}
