/**
 * <WearablesSection /> — Sprint W14 Day 70.
 *
 * Generic device-support блок. КЛЮЧЕВОЕ ТРЕБОВАНИЕ: НЕ упоминать
 * WHOOP / Garmin / Apple Watch как «supported now». Все формулировки
 * безопасные («может учитывать», «поддерживаемых вашей конфигурацией»).
 *
 * Roadmap items показывают что в работе ≠ что уже работает.
 *
 * Visual: light grey background (bg-slate-50) для consistency с
 * WorkflowSection. Compact, не центральная секция.
 */
import { Activity, CheckCircle2, Clock, Smartphone, Watch } from 'lucide-react'

interface RoadmapItem {
  status: 'now' | 'soon' | 'roadmap'
  label:  string
  detail: string
}

const ROADMAP: RoadmapItem[] = [
  {
    status: 'now',
    label:  'Ручной импорт CSV',
    detail: 'Загрузка данных тренировок из любого источника через CSV-файл.',
  },
  {
    status: 'soon',
    label:  'OAuth интеграции',
    detail: 'Прямое подключение поддерживаемых трекеров через OAuth — готовится.',
  },
  {
    status: 'roadmap',
    label:  'Расширенные синхронизации',
    detail: 'Расширение списка устройств зависит от спроса клубов и доступности vendor API.',
  },
]

const STATUS_META: Record<RoadmapItem['status'], { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  now:     { label: 'Доступно',  color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle2 },
  soon:    { label: 'Готовится', color: '#D44A02', bg: '#FFF7ED', icon: Clock },
  roadmap: { label: 'В roadmap', color: '#64748B', bg: '#F1F5F9', icon: Clock },
}

export default function WearablesSection() {
  return (
    <section className="w-full bg-slate-50 py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            Интеграции
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            Работает с данными носимых устройств
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Sporteo может учитывать данные подключённых трекеров, браслетов и устройств
            мониторинга активности, поддерживаемых вашей конфигурацией.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Конкретный список устройств и формат данных зависит от тарифа клуба
            и подключённых интеграций.
          </p>
        </div>

        {/* Device pictograms — generic, no brand names */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          {[
            { icon: Watch,      label: 'Умные часы' },
            { icon: Activity,   label: 'Пульсометры и трекеры' },
            { icon: Smartphone, label: 'Мобильные приложения' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Icon size={18} strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Roadmap */}
        <div className="mt-12">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Что в работе
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ROADMAP.map((item) => {
              const meta = STATUS_META[item.status]
              const StatusIcon = meta.icon
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-white p-5"
                >
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wider"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    <StatusIcon size={11} />
                    {meta.label}
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-foreground">{item.label}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Honesty footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Мы не обещаем поддержку конкретных моделей. Спросите про подключение
          вашего устройства при обсуждении тарифа клуба.
        </p>
      </div>
    </section>
  )
}
