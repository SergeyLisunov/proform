'use client'

import { Card } from '@/components/ui/metronic'

interface OrgHeroStats {
  membersCount: number
  coachesCount: number
  athletesCount: number
  pendingRequests: number
}

interface OrgHeroBarProps {
  orgName: string
  meta: { type?: string | null; sport?: string | null; city?: string | null }
  stats: OrgHeroStats
}

function pickGreeting(hour: number): string {
  if (hour < 6)  return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export default function OrgHeroBar({ orgName, meta, stats }: OrgHeroBarProps) {
  const greeting = pickGreeting(new Date().getHours())
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const description = [meta.type, meta.sport, meta.city].filter(Boolean).join(' · ') || 'Команда на базе Sporteo'

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] via-white to-[#FAF5FF] p-5 md:p-7">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700 mb-1">
            🏢 {today}
          </p>
          <h1 className="pf-num text-3xl md:text-4xl text-navy-500 leading-tight">
            {greeting}, <span className="text-blue-700">{orgName}</span>!
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{description}</p>
        </div>

        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Состав"      value={String(stats.membersCount)}    color="#2563EB" />
          <Stat label="Тренеров"    value={String(stats.coachesCount)}    color="#16A34A" />
          <Stat label="Атлетов"     value={String(stats.athletesCount)}   color="#F35703" />
          <Stat label="Заявки"      value={String(stats.pendingRequests)} color="#9333EA"
            highlight={stats.pendingRequests > 0} />
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <Card className={`px-3 py-2.5 ${highlight ? '!border-purple-300' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="pf-num text-xl font-bold mt-0.5" style={{ color }}>{value}</div>
    </Card>
  )
}
