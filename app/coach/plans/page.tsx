'use client'
/**
 * /coach/plans — Sprint W5 Day 24 (PR #40).
 *
 * Список workout_plans coach'а. CTA "Создать план" → /coach/plans/new.
 * Click на карточку → /coach/plans/[id] (edit + assign-to-athlete).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useDialog } from '@/lib/hooks/useDialog'
import {
  listMyPlans, archivePlan, ACTIVITY_LABELS,
  type WorkoutPlan,
} from '@/services/workout-plans.service'
import { Card, Badge } from '@/components/ui/metronic'

export default function CoachPlansPage() {
  const { user, loading: userLoading } = useUser()
  const { confirm } = useDialog()
  const [plans, setPlans]     = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId]   = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user || (user.role !== 'coach')) {
      setLoading(false)
      return
    }
    listMyPlans().then(list => {
      setPlans(list)
      setLoading(false)
    })
  }, [user, userLoading])

  async function handleArchive(planId: string) {
    if (!(await confirm('Архивировать план? Восстановить можно через SQL.'))) return
    setBusyId(planId)
    try {
      const ok = await archivePlan(planId)
      if (ok) setPlans(prev => prev.filter(p => p.id !== planId))
    } finally {
      setBusyId(null)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user || (user.role !== 'coach')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ тренера</p>
        <Link href="/dashboard" className="text-sm text-orange-600 font-semibold hover:underline">
          ← На главную
        </Link>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Тренер · Планы</p>
          <h1 className="text-3xl font-bold text-navy-500">Планы тренировок</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Re-usable weekly plans. Создайте один раз → назначайте разным атлетам с разной даты старта.
          </p>
        </div>
        <Link href="/coach/plans/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 text-sm font-bold shadow-md no-underline">
          <i className="ki-filled ki-plus text-sm" />
          Создать план
        </Link>
      </div>

      {/* Empty state */}
      {plans.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-calendar-tick text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-navy-500">У вас пока нет планов</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте первый weekly plan для атлета — типовая тренировочная неделя с распределением по дням.
          </p>
          <Link href="/coach/plans/new"
            className="mt-5 inline-block rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold no-underline">
            + Создать первый план
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-orange-200 relative group">
              <Link href={`/coach/plans/${p.id}`} className="block no-underline">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-navy-500 line-clamp-2 group-hover:text-orange-700 transition-colors">{p.name}</h3>
                  {p.is_public && (
                    <Badge variant="info" size="sm" className="uppercase tracking-wider shrink-0">
                      Public
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.sport && (
                    <Badge variant="warning" size="sm" className="uppercase tracking-wider">
                      {ACTIVITY_LABELS[p.sport] ?? p.sport}
                    </Badge>
                  )}
                  <Badge variant="secondary" size="sm" className="uppercase tracking-wider bg-violet-50 text-violet-700">
                    {p.duration_weeks} {p.duration_weeks === 1 ? 'неделя' : p.duration_weeks < 5 ? 'недели' : 'недель'}
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
                  Обновлено {new Date(p.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </Link>
              <button
                onClick={() => handleArchive(p.id)}
                disabled={busyId === p.id}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg border border-border bg-background hover:bg-red-50 hover:border-red-200 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Архивировать">
                <i className="ki-filled ki-archive text-xs" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
