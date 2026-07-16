'use client'

/**
 * PlanStreakCard — недельный стрик выполнения плана тренера с МЕД-ЗАМОРОЗКОЙ
 * (P1 соц-ядро, уникальная механика Sporteo).
 *
 * Duolingo-механика без anxiety-retention: неделя с ограничивающим допуском
 * (banned/light_only) замораживается — стрик не ломается и не подталкивает
 * тренироваться больным. Считается на лету (services/plan-streak) из данных,
 * доступных атлету по RLS. Скрывается, если prescribed-плана нет вообще.
 */
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/metronic'
import { getPlanStreak, type PlanStreak } from '@/services/plan-streak.service'

function cellClass(c: PlanStreak['cells'][number], isCurrent: boolean): string {
  if (c.frozen) return 'bg-info/20 border-info/40'
  if (c.counted) return 'bg-success border-success'
  if (c.assigned === 0) return 'bg-muted border-border'
  if (isCurrent) return 'bg-warning/30 border-warning/50'
  return 'bg-danger/20 border-danger/40'
}

function cellTitle(c: PlanStreak['cells'][number]): string {
  const d = new Date(c.from + 'T00:00:00')
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  if (c.frozen) return `Неделя с ${d}: заморожена по мед-допуску`
  if (c.assigned === 0) return `Неделя с ${d}: тренировки не назначались`
  return `Неделя с ${d}: выполнено ${c.completed} из ${c.assigned}`
}

export default function PlanStreakCard({ athleteId }: { athleteId: string }) {
  const [streak, setStreak] = useState<PlanStreak | null>(null)

  useEffect(() => {
    let cancelled = false
    getPlanStreak(athleteId)
      .then(s => { if (!cancelled) setStreak(s) })
      .catch(() => { /* виджет просто не показываем */ })
    return () => { cancelled = true }
  }, [athleteId])

  if (!streak || !streak.hasPlan) return null

  const { weeks, thisWeek, cells } = streak
  const last = cells.length - 1

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <i className="ki-filled ki-flash text-lg" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="pf-num text-2xl text-foreground">{weeks}</span>
              <span className="text-sm font-semibold text-navy-500">
                {weeks % 10 === 1 && weeks % 100 !== 11 ? 'неделя' :
                 [2, 3, 4].includes(weeks % 10) && ![12, 13, 14].includes(weeks % 100) ? 'недели' : 'недель'} по плану
              </span>
            </div>
            <p className="text-2xs text-muted-foreground">
              {thisWeek.frozen
                ? 'Эта неделя заморожена по мед-допуску — серия не сгорит'
                : thisWeek.assigned > 0
                  ? `Эта неделя: выполнено ${thisWeek.completed} из ${thisWeek.assigned}`
                  : 'На эту неделю тренировки пока не назначены'}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-1" aria-label="Последние 8 недель">
          {cells.map((c, i) => (
            <div
              key={c.from}
              title={cellTitle(c)}
              className={`h-6 w-3 rounded-sm border ${cellClass(c, i === last)}`}
            />
          ))}
        </div>
      </div>
      {streak.hadFreeze && (
        <div className="flex items-center gap-2 border-t border-border bg-info/5 px-5 py-2.5 text-2xs text-info">
          <i className="ki-filled ki-shield-tick text-[11px]" />
          Серия сохранена: недели без мед-допуска замораживаются, а не сгорают
        </div>
      )}
    </Card>
  )
}
