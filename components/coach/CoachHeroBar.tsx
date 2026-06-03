'use client'

import { Card } from '@/components/ui/metronic'

interface HeroStats {
  athletesCount: number
  avgRecovery: number
  pendingRequests: number
  weekDiaryEntries: number
}

function pickGreeting(hour: number): string {
  if (hour < 6)  return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function recoveryColor(v: number): string {
  if (v >= 67) return '#15803D'
  if (v >= 34) return '#C2410C'
  return '#B91C1C'
}

/**
 * Главный hero-бар тренера: приветствие, дата и 4 ключевых KPI на
 * быстрый взгляд (атлеты, среднее восстановление команды, заявки,
 * записи в дневнике за неделю).
 */
export default function CoachHeroBar({ firstName, stats }: { firstName: string; stats: HeroStats }) {
  const greeting = pickGreeting(new Date().getHours())
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const recColor = recoveryColor(stats.avgRecovery)

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-white to-[#EFF6FF] p-5 md:p-7">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-orange-200/40 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-600 mb-1">
            {today}
          </p>
          <h1 className="pf-num text-3xl md:text-4xl text-navy-500 leading-tight">
            {greeting}, <span className="text-orange-600">{firstName}</span>!
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            {stats.pendingRequests > 0
              ? `${stats.pendingRequests} новых заявок ждут вашего ответа`
              : `Под наблюдением — ${stats.athletesCount} атлетов`}
          </p>
        </div>

        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Атлеты"     value={String(stats.athletesCount)}  color="#2563EB" />
          <Stat label="Ср. recovery" value={`${stats.avgRecovery}%`}     color={recColor} />
          <Stat label="Записей за нед." value={String(stats.weekDiaryEntries)} color="#7C3AED" />
          <Stat label="Заявки"     value={String(stats.pendingRequests)} color="#F35703"
            highlight={stats.pendingRequests > 0} />
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <Card className={`px-3 py-2.5 ${highlight ? 'animate-pulse border-orange-300' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="pf-num text-xl font-bold mt-0.5" style={{ color }}>{value}</div>
    </Card>
  )
}
