'use client'

interface AdminHeroStats {
  totalUsers: number
  athletes: number
  coaches: number
  workouts: number
  newUsersWeek: number
  newWorkoutsWeek: number
}

export default function AdminHeroBar({ stats }: { stats: AdminHeroStats }) {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const newUsersDelta = stats.newUsersWeek > 0
    ? `+${stats.newUsersWeek} за неделю`
    : 'нет новых'
  const newWorkoutsDelta = stats.newWorkoutsWeek > 0
    ? `+${stats.newWorkoutsWeek} за неделю`
    : '—'

  return (
    <section className="relative overflow-hidden rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-blue-50 p-5 md:p-7">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-purple-200/40 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-700 mb-1">
            🛠 Администрирование · {today}
          </p>
          <h1 className="pf-num text-3xl md:text-4xl text-navy-500 leading-tight">
            Обзор платформы
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Supabase atlet-pro · eu-central-1 · {stats.totalUsers} пользователей
          </p>
        </div>

        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Всего"     value={String(stats.totalUsers)} sub={newUsersDelta} color="#7C3AED" highlight={stats.newUsersWeek > 0} />
          <Stat label="Атлетов"   value={String(stats.athletes)}   sub="ядро базы"    color="#F35703" />
          <Stat label="Тренеров"  value={String(stats.coaches)}    sub="специалистов" color="#16A34A" />
          <Stat label="Тренировок" value={String(stats.workouts)} sub={newWorkoutsDelta} color="#2563EB" />
        </div>
      </div>
    </section>
  )
}

function Stat({
  label, value, sub, color, highlight,
}: { label: string; value: string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white px-3 py-2.5 ${highlight ? 'border-purple-300' : 'border-border'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="pf-num text-xl font-bold mt-0.5" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</div>
    </div>
  )
}
