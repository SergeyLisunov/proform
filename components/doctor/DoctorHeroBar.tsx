'use client'

interface DoctorHeroStats {
  patientsCount: number
  todayCheckups: number
  activeInjuries: number
  unreadNotif: number
}

function pickGreeting(hour: number): string {
  if (hour < 6)  return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

/**
 * Hero-бар врача: приветствие + 4 ключевых KPI (пациенты, осмотры
 * сегодня, активные травмы, непрочитанные уведомления).
 */
export default function DoctorHeroBar({ firstName, stats }: { firstName: string; stats: DoctorHeroStats }) {
  const greeting = pickGreeting(new Date().getHours())
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const summary = stats.todayCheckups > 0
    ? `${stats.todayCheckups} осмотров сегодня`
    : stats.activeInjuries > 0
    ? `${stats.activeInjuries} активных травм у пациентов`
    : `Под наблюдением — ${stats.patientsCount} пациентов`

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#FECACA] bg-gradient-to-br from-[#FEF2F2] via-white to-[#FEF0E7] p-5 md:p-7">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-red-200/40 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-600 mb-1">
            🩺 {today}
          </p>
          <h1 className="pf-num text-3xl md:text-4xl text-navy-500 leading-tight">
            {greeting}, <span className="text-red-600">{firstName}</span>!
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{summary}</p>
        </div>

        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Пациенты"          value={String(stats.patientsCount)}  color="#DC2626" />
          <Stat label="Осмотры сегодня"    value={String(stats.todayCheckups)}  color="#D44A02" highlight={stats.todayCheckups > 0} />
          <Stat label="Активные травмы"    value={String(stats.activeInjuries)} color="#B91C1C" highlight={stats.activeInjuries > 0} />
          <Stat label="Уведомления"        value={String(stats.unreadNotif)}    color="#2563EB" highlight={stats.unreadNotif > 0} />
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white px-3 py-2.5 ${highlight ? 'border-red-300' : 'border-border'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="pf-num text-xl font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  )
}
