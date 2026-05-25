/**
 * <BenefitsSection /> — Sprint W14 Day 70.
 *
 * 9 product benefits в 3×3 grid. Каждая benefit-card — title + body
 * + Lucide icon. Soft framing — фокус на «что pain закрывает», не
 * хайповые «AI/ML/революция» buzzwords.
 *
 * Visual: white background, compact cards с icon-left layout, subtle
 * hover. Less prominent than RoleSection (что строит позиционирование),
 * больше scanner-friendly checklist.
 */
import {
  Activity,
  ClipboardList,
  Database,
  FileSpreadsheet,
  IdCard,
  MessageSquare,
  Network,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

interface Benefit {
  icon:  typeof IdCard
  title: string
  body:  string
}

const BENEFITS: Benefit[] = [
  {
    icon:  IdCard,
    title: 'Единая карточка спортсмена',
    body:  'Все данные в одном месте — от плана тренировок до медицинских заметок. Без поиска по чатам и таблицам.',
  },
  {
    icon:  ClipboardList,
    title: 'Быстрый ввод тренировок',
    body:  'Тренер заносит сессию за 30 секунд — без переключений между приложениями.',
  },
  {
    icon:  Activity,
    title: 'Прогресс и аналитика',
    body:  'Готовность, нагрузка, восстановление — измеряются автоматически по подключённым данным.',
  },
  {
    icon:  MessageSquare,
    title: 'Дневник и отзывы тренера',
    body:  'Двусторонняя обратная связь с историей — спортсмен видит, тренер фиксирует, ничего не теряется.',
  },
  {
    icon:  Network,
    title: 'Координация ролей',
    body:  'Тренер, врач, родитель — каждый видит своё, без хаоса каналов и параллельных переписок.',
  },
  {
    icon:  Stethoscope,
    title: 'Медицинские ограничения',
    body:  'Травмы, противопоказания, период восстановления — отдельный контур данных с правильным доступом.',
  },
  {
    icon:  Database,
    title: 'Группы и команды',
    body:  'Спортсмены объединяются в группы; тренер видит командные метрики без сборки руками.',
  },
  {
    icon:  FileSpreadsheet,
    title: 'Отчёты и экспорт',
    body:  'Health Snapshot, PDF-отчёты для руководства и спонсоров — в один клик из любой роли.',
  },
  {
    icon:  ShieldCheck,
    title: 'Безопасность по роли',
    body:  'Доступ — только тому, кому он нужен, на уровне базы данных. Никаких «забыли отозвать» инцидентов.',
  },
]

export default function BenefitsSection() {
  return (
    <section className="w-full bg-white py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Возможности платформы
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Всё нужное для управления спортивной подготовкой
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            От карточки спортсмена до командной аналитики — без переключений между Excel,
            чатами и заметками.
          </p>
        </div>

        {/* 3×3 grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-slate-50/60 p-5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm transition-colors group-hover:bg-orange-500 group-hover:text-white">
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
