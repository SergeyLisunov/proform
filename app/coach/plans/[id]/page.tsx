'use client'
/**
 * /coach/plans/[id] — Sprint W5 Day 24 (PR #40).
 *
 * Edit-mode wrapper для PlanEditor. Загружает план через service, передаёт
 * в editor с initial data. Editor сам обрабатывает update + assign-to-athlete.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { getPlan, type WorkoutPlanFull } from '@/services/workout-plans.service'
import PlanEditor from '../PlanEditor'

export default function EditPlanPage() {
  const params = useParams<{ id: string }>()
  const planId = params.id

  const { user, loading: userLoading } = useUser()
  const [plan, setPlan]       = useState<WorkoutPlanFull | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getPlan(planId)
    setPlan(data)
    setLoading(false)
  }, [planId])

  useEffect(() => {
    if (userLoading) return
    if (!user || (user.role !== 'coach')) {
      setLoading(false)
      return
    }
    load()
  }, [user, userLoading, load])

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

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <i className="ki-filled ki-information-2 text-4xl text-muted-foreground mb-3 block" />
          <h2 className="text-lg font-semibold text-foreground">План не найден</h2>
          <p className="mt-2 text-sm text-muted-foreground">Возможно, он был архивирован или у вас нет доступа.</p>
          <Link href="/coach/plans"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold no-underline">
            ← К планам
          </Link>
        </div>
      </div>
    )
  }

  return <PlanEditor mode="edit" initial={plan} />
}
