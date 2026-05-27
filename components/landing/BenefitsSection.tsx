/**
 * <BenefitsSection /> — Sprint W14 Day 70; trimmed W17 Day 87.
 *
 * Was: 9 benefits в 3×3 grid (W16 mobile QA flagged as wall-of-text).
 * Now: 6 high-impact benefits в 2×3 grid с larger icons + tighter copy.
 *
 * Trim rationale — kept 6 most B2B-impactful, dropped 3 generic:
 *   ✅ Единая карточка спортсмена (replaces 5 tools — primary value prop)
 *   ✅ Координация ролей (multi-role differentiator vs CRM/Notion)
 *   ✅ Медицинские ограничения (safety + 152-ФЗ trust)
 *   ✅ Дневник и отзывы тренера (history preserved — addresses pain)
 *   ✅ Отчёты и экспорт (decision-maker value — Health Snapshot PDF)
 *   ✅ Безопасность по роли (RLS + 152-ФЗ — compliance trust)
 *
 *   ❌ Быстрый ввод тренировок (operational, weak B2B signal)
 *   ❌ Прогресс и аналитика (vague — overlap с UseCases concrete metrics)
 *   ❌ Группы и команды (overlap с RoleSection)
 *
 * Visual: card icons bumped к 12×12 (was 10×10), tighter card padding,
 * still mobile-stack à 1-col, sm:2-col, lg:3-col.
 */
import {
  ClipboardList,
  FileSpreadsheet,
  IdCard,
  MessageSquare,
  Network,
  ShieldCheck,
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
    body:  'Все данные в одном месте — тренировки, медицина, прогресс. Заменяет Excel, Telegram-чаты и бумажные карточки.',
  },
  {
    icon:  Network,
    title: 'Координация ключевых ролей',
    body:  'Тренер, врач, организация, спортсмен — каждый видит своё, без хаоса параллельных чатов. Родители получают PDF-снимки и email-рассылки.',
  },
  {
    icon:  ClipboardList,
    title: 'Дневник + отзывы тренера',
    body:  'Двусторонняя обратная связь с историей. Спортсмен видит, тренер фиксирует — ничего не теряется через 100 сообщений.',
  },
  {
    icon:  MessageSquare,
    title: 'Медицинские ограничения',
    body:  'Травмы, противопоказания, период восстановления — изолированный медицинский контур с правильным доступом.',
  },
  {
    icon:  FileSpreadsheet,
    title: 'Отчёты и Health Snapshot',
    body:  'PDF для руководства, спонсоров, родителей — в один клик из любой роли. Forward-friendly, no login needed.',
  },
  {
    icon:  ShieldCheck,
    title: 'RLS на уровне БД',
    body:  '152-ФЗ + EU-Central хостинг. Доступ проверяется в PostgreSQL — даже compromised app сервер не даст чужие данные.',
  },
]

export default function BenefitsSection() {
  return (
    <section className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
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

        {/* 2×3 grid — 6 highest-impact benefits */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-slate-50/60 p-5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-sm sm:p-6"
            >
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm transition-colors group-hover:bg-orange-500 group-hover:text-white"
              >
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
