'use client'
/**
 * /coach/plans/new — Sprint W5 Day 24 (PR #40).
 *
 * Create-mode wrapper для PlanEditor. После сохранения navigate'ит
 * к /coach/plans/[id] для assign-to-athlete workflow.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import PlanEditor from '../PlanEditor'

export default function NewPlanPage() {
  const { user, loading: userLoading } = useUser()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (userLoading) return
    setAllowed(!!user && (user.role === 'coach'))
  }, [user, userLoading])

  if (userLoading || allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!allowed) {
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

  return <PlanEditor mode="create" initial={null} />
}
