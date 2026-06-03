'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/metronic'

/**
 * Compact 12-week heatmap (à la GitHub contributions).
 * Columns = weeks, rows = days of week, cells coloured by entry count.
 */

function startOfMondayWeek(d: Date): Date {
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() + diff)
  return r
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_LABELS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

function colorFor(count: number): { bg: string; border: string } {
  if (count <= 0) return { bg: '#F1F5F9', border: '#E2E8F0' }
  if (count === 1) return { bg: '#FED7AA', border: '#FDBA74' }
  if (count <= 3) return { bg: '#FDBA74', border: '#FB923C' }
  if (count <= 6) return { bg: '#FB923C', border: '#F97316' }
  return { bg: '#EA580C', border: '#C2410C' }
}

export function DiaryHeatmap({
  data,
  weeks = 12,
  onClickDay,
}: {
  data: Record<string, number>
  weeks?: number
  onClickDay?: (isoDate: string) => void
}) {
  const { columns, monthColumns } = useMemo(() => {
    const end = new Date()
    const endMonday = startOfMondayWeek(end)
    const cols: { weekStart: Date; days: { date: string; count: number; inFuture: boolean }[] }[] = []
    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(endMonday)
      weekStart.setDate(weekStart.getDate() - w * 7)
      const days: { date: string; count: number; inFuture: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart)
        dt.setDate(dt.getDate() + d)
        const iso = isoDate(dt)
        days.push({
          date: iso,
          count: data[iso] ?? 0,
          inFuture: dt > end,
        })
      }
      cols.push({ weekStart, days })
    }
    // For each column: show month label only if this is the first column of that month.
    const monthCols: Record<number, string> = {}
    let lastMonth = -1
    cols.forEach((c, idx) => {
      const m = c.weekStart.getMonth()
      if (m !== lastMonth) { monthCols[idx] = MONTH_LABELS[m]; lastMonth = m }
    })
    return { columns: cols, monthColumns: monthCols }
  }, [data, weeks])

  const total = Object.values(data).reduce((s, n) => s + n, 0)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Активность журнала · {weeks} нед
        </p>
        <span className="text-[10px] text-muted-foreground">
          Всего записей: <strong className="text-foreground">{total}</strong>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {/* day-of-week labels column */}
        <div className="flex flex-col gap-[3px] shrink-0 pt-4">
          {DAY_LABELS.map((lbl, i) => (
            <div key={i}
              className="text-[9px] text-muted-foreground"
              style={{ height: 14, lineHeight: '14px', visibility: i % 2 ? 'hidden' : 'visible' }}>
              {lbl}
            </div>
          ))}
        </div>
        {/* week columns */}
        <div className="flex gap-[3px]">
          {columns.map((col, idx) => (
            <div key={idx} className="flex flex-col gap-[3px]">
              <div className="text-[9px] text-muted-foreground h-3" style={{ height: 12 }}>
                {monthColumns[idx] ?? ''}
              </div>
              {col.days.map(d => {
                if (d.inFuture) {
                  return <div key={d.date} className="rounded-[3px]"
                    style={{ width: 14, height: 14, background: 'transparent', border: '1px dashed #E2E8F0' }} />
                }
                const c = colorFor(d.count)
                return (
                  <button
                    key={d.date}
                    onClick={() => onClickDay?.(d.date)}
                    title={`${d.date}: ${d.count} ${d.count === 1 ? 'запись' : 'запис(и/ей)'}`}
                    className="rounded-[3px] transition-all hover:scale-125 hover:z-10"
                    style={{ width: 14, height: 14, background: c.bg, border: `1px solid ${c.border}` }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <span>меньше</span>
        {[0, 1, 3, 6, 7].map(n => {
          const c = colorFor(n)
          return <span key={n} className="rounded-[3px] inline-block"
            style={{ width: 12, height: 12, background: c.bg, border: `1px solid ${c.border}` }} />
        })}
        <span>больше</span>
      </div>
    </Card>
  )
}
