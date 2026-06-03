'use client'
/**
 * /athlete/progress — Sprint W5 Day 25 (PR #41).
 *
 * Athlete-side progress dashboard:
 *   - 4 stat tiles: completion rate / avg weekly minutes / active goals / achieved
 *   - 8-week bar chart (total_minutes per week, color-coded by completion ratio)
 *   - Recovery trend line (overlay)
 *   - Active goals summary с links к /athlete/goals
 *
 * Chart is inline SVG (no external library — следует patterns codebase).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  getProgressStats, listMyGoals,
  STATUS_META, type ProgressStats, type AthleteGoal,
} from '@/services/athlete-goals.service'
import { Card, ChartCard, Alert } from '@/components/ui/metronic'

export default function AthleteProgressPage() {
  const { user, loading: userLoading } = useUser()
  const [stats, setStats]                 = useState<ProgressStats | null>(null)
  const [activeGoals, setActiveGoals]     = useState<AthleteGoal[]>([])
  const [loading, setLoading]             = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, g] = await Promise.all([
      getProgressStats(8),
      listMyGoals('active'),
    ])
    setStats(s)
    setActiveGoals(g)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    load()
  }, [user, userLoading, load])

  // Chart dimensions
  const chartW = 720
  const chartH = 220
  const padL = 36
  const padR = 12
  const padT = 14
  const padB = 28
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  const maxMinutes = useMemo(() => {
    if (!stats || stats.weeks.length === 0) return 100
    return Math.max(60, Math.ceil(Math.max(...stats.weeks.map(w => w.total_minutes)) / 60) * 60)
  }, [stats])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Войдите в аккаунт</p>
        <Link href="/auth/login?next=/athlete/progress" className="text-sm text-orange-600 font-semibold hover:underline">
          → Войти
        </Link>
      </div>
    )
  }

  const s = stats!
  const hasData = s.weeks.some(w => w.workout_count > 0)

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Атлет · Прогресс</p>
          <h1 className="text-3xl font-bold text-foreground">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            8 недель тренировок: weekly volume, completion rate, recovery trend. Цели обновляются в реальном времени.
          </p>
        </div>
        <Link href="/athlete/goals"
          className="rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-sm font-semibold no-underline inline-flex items-center gap-1.5">
          <i className="ki-filled ki-flag text-sm" />
          К целям
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Completion rate" value={`${s.completion_rate_pct}%`} color="#15803D"
          subtitle="prescribed workouts" />
        <StatTile label="Avg weekly volume" value={`${s.avg_weekly_minutes}`} color="#2563EB"
          subtitle="минут / неделя" />
        <StatTile label="Активные цели" value={String(s.total_goals_active)} color="#D44A02"
          subtitle="в работе" />
        <StatTile label="Достигнуто целей" value={String(s.total_goals_done)} color="#7C3AED"
          subtitle="за всё время" />
      </div>

      {/* Chart */}
      <ChartCard
        title="8-week volume"
        subtitle="Бары — total_minutes; цвет = доля completed (зелёная) vs pending/skipped (серая)."
      >
        {!hasData ? (
          <Alert variant="info" title="Нет данных за 8 недель" icon="ki-chart-line-up">
            Логируйте тренировки на /calendar или подключите wearable — данные появятся здесь.
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-3xl mx-auto" style={{ maxHeight: 280 }}>
              {/* Y axis grid */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => {
                const y = padT + (1 - t) * innerH
                const lbl = Math.round(maxMinutes * t)
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={padL + innerW} y2={y}
                      stroke="#E2E8F0" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '3 3'} />
                    <text x={padL - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#94A3B8">
                      {lbl}m
                    </text>
                  </g>
                )
              })}

              {/* Bars */}
              {s.weeks.map((w, i) => {
                const barW = innerW / s.weeks.length - 8
                const barX = padL + (innerW / s.weeks.length) * i + 4
                const barH = (w.total_minutes / maxMinutes) * innerH
                const barY = padT + innerH - barH

                const totalPrescribed = w.completed + w.skipped + w.pending
                const completedRatio = totalPrescribed > 0 ? w.completed / totalPrescribed : 0
                const completedH = barH * completedRatio
                const completedY = padT + innerH - completedH

                return (
                  <g key={i}>
                    {/* Background bar (pending/skipped/no-completion-info) */}
                    <rect x={barX} y={barY} width={barW} height={barH}
                      fill="#CBD5E1" rx={4} />
                    {/* Completed portion */}
                    {completedH > 0 && (
                      <rect x={barX} y={completedY} width={barW} height={completedH}
                        fill="#15803D" rx={4} />
                    )}
                    {/* Value label */}
                    {w.total_minutes > 0 && (
                      <text x={barX + barW / 2} y={barY - 4} textAnchor="middle" fontSize={10} fill="#475569" fontWeight="600">
                        {w.total_minutes}
                      </text>
                    )}
                    {/* X-axis week label */}
                    <text x={barX + barW / 2} y={chartH - 10} textAnchor="middle" fontSize={10} fill="#64748B">
                      {formatWeek(w.week_start)}
                    </text>
                  </g>
                )
              })}

              {/* Legend */}
              <g transform={`translate(${padL}, ${chartH - 4})`}>
                <rect x={innerW - 130} y={-10} width={10} height={10} fill="#15803D" rx={2} />
                <text x={innerW - 116} y={-2} fontSize={10} fill="#475569">completed</text>
                <rect x={innerW - 60} y={-10} width={10} height={10} fill="#CBD5E1" rx={2} />
                <text x={innerW - 46} y={-2} fontSize={10} fill="#475569">pending/skip</text>
              </g>
            </svg>
          </div>
        )}
      </ChartCard>

      {/* Recovery trend */}
      {hasData && s.weeks.some(w => w.avg_recovery !== null) && (
        <Card className="p-5">
          <h2 className="text-lg font-bold text-foreground mb-2">Recovery trend</h2>
          <p className="text-xs text-muted-foreground mb-3">Средний recovery score (если есть данные от wearable / ручного ввода)</p>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {s.weeks.map((w, i) => {
              const color = w.avg_recovery === null ? '#CBD5E1'
                : w.avg_recovery >= 70 ? '#15803D'
                : w.avg_recovery >= 50 ? '#CA8A04'
                : '#DC2626'
              return (
                <div key={i} className="rounded-lg border border-border bg-background px-2 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">{formatWeek(w.week_start)}</div>
                  <div className="text-base font-bold" style={{ color }}>
                    {w.avg_recovery ?? '—'}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">recovery</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Active goals summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground">Активные цели</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeGoals.length === 0 ? 'Создайте цель, чтобы отслеживать прогресс.' : `${activeGoals.length} в работе`}
            </p>
          </div>
          <Link href="/athlete/goals"
            className="rounded-lg border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold no-underline">
            Управлять →
          </Link>
        </div>

        {activeGoals.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-accent/30 px-4 py-8 text-center">
            <i className="ki-filled ki-flag text-2xl text-muted-foreground mb-2 block" />
            <Link href="/athlete/goals"
              className="text-sm text-orange-600 font-semibold hover:underline no-underline">
              + Создать первую цель
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGoals.slice(0, 6).map(g => {
              const progressPct = g.target_value && g.current_value != null && g.target_value !== 0
                ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100)))
                : null
              return (
                <div key={g.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-foreground line-clamp-2">{g.metric_label}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5"
                      style={{ background: STATUS_META.active.bg, color: STATUS_META.active.color }}>
                      🎯
                    </span>
                  </div>
                  {g.target_value !== null && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Цель: {g.target_value} {g.target_unit ?? ''}
                      {g.current_value != null && ` (сейчас: ${g.current_value})`}
                    </div>
                  )}
                  {progressPct !== null && (
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                  {g.target_date && (
                    <div className="text-[10px] text-muted-foreground mt-1.5">
                      📅 {new Date(g.target_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function StatTile({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="pf-num text-2xl font-bold mt-1" style={{ color }}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </Card>
  )
}

function formatWeek(weekStartIso: string): string {
  const d = new Date(weekStartIso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
