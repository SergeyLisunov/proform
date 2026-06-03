/**
 * <BenefitsSection /> — solution-stage value block for Sporteo.
 *
 * 6 benefits в 2×3 grid. Лид-четвёрка = ядро УТП:
 *   ✅ Предиктивная аналитика (ACWR + ML-риск травм — главная ценность)
 *   ✅ Мультиролевая координация (тренер/атлет/врач/руководитель)
 *   ✅ Единая карточка спортсмена (вся история в одном месте)
 *   ✅ Защита данных уровня СУБД (Row-Level Security, шифрование)
 * + поддержка: дневник с обратной связью тренера и отчёты/Health Snapshot.
 *
 * Visual: 12×12 icons, mobile-stack 1-col, sm:2-col, lg:3-col.
 */
import {
  ClipboardList,
  FileSpreadsheet,
  IdCard,
  Network,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'

interface Benefit {
  icon:  typeof IdCard
  title: string
  body:  string
}

const BENEFITS: Benefit[] = [
  {
    icon:  TrendingUp,
    title: 'Предиктивная аналитика нагрузки',
    body:  'Автоматический расчёт нагрузки (ACWR) и ML-модель риска травм предупреждают о перетренированности заранее — до того, как спортсмен «сломается».',
  },
  {
    icon:  Network,
    title: 'Мультиролевая координация',
    body:  'Тренер, спортсмен, врач и руководитель работают в одной системе — каждый видит ровно то, что нужно ему. Конец хаосу из чатов, Excel и бумажных карточек.',
  },
  {
    icon:  IdCard,
    title: 'Единая карточка спортсмена',
    body:  'Вся история, медкарта, нагрузки и план тренировок — в одном месте. Картина спортсмена не теряется на следующий день и копится годами.',
  },
  {
    icon:  ShieldCheck,
    title: 'Защита данных уровня СУБД',
    body:  'Доступ к медицинским данным проверяется на уровне базы (Row-Level Security) и шифруются при хранении и передаче. Каждый получает только свой срез информации.',
  },
  {
    icon:  ClipboardList,
    title: 'Дневник и обратная связь',
    body:  'Дневник тренировок и самочувствия плюс отзывы тренера — двусторонняя связь с полной историей. Ничего не теряется среди сотни сообщений.',
  },
  {
    icon:  FileSpreadsheet,
    title: 'Отчёты и Health Snapshot',
    body:  'Готовые отчёты и PDF-снимки для руководства, спонсоров и родителей — в один клик из любой роли, без отдельного входа в систему.',
  },
]

export default function BenefitsSection() {
  return (
    <section className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Что даёт Sporteo
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            Управляйте подготовкой осознанно — и берегите спортсменов
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Предиктивная аналитика нагрузки, единая карточка спортсмена и защита медданных —
            всё в одной системе, без Excel, бумажных медкарт и десятка чатов.
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
                <h3 className="text-base font-bold tracking-tight text-navy-500">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
