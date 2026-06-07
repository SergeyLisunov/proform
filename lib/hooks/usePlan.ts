'use client'

/**
 * usePlan — клиентский hook для текущего effective plan (sidebar этап 12).
 *
 * Резолвит `subscriptions` строку текущего пользователя и нормализует её
 * через `resolveEffectivePlan`. Подходит для UI gates: sidebar items с
 * `requiredPlan`, paywall banners, upgrade prompts.
 *
 * Сервер-side gating (компромиссы безопасности) идёт через
 * `lib/ai/plan-gate.ts` — этот hook ТОЛЬКО для UI hint.
 *
 * Возвращает:
 *   - loading — true пока useUser резолвится или fetch не вернулся
 *   - plan — effective Plan (free если subscription неактивна или нет строки)
 *   - isPaid — удобный alias `isPaidPlan(plan)`
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { isPaidPlan, resolveEffectivePlan, type Plan } from '@/lib/plans'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export interface PlanState {
  loading: boolean
  plan:    Plan
  isPaid:  boolean
}

export function usePlan(): PlanState {
  const { user, loading: userLoading } = useUser()
  const [plan, setPlan] = useState<Plan>('free')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) { setPlan('free'); setFetched(true); return }
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sb() as any)
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { plan: string | null; status: string | null } | null }) => {
        if (cancelled) return
        setPlan(resolveEffectivePlan({ plan: data?.plan, status: data?.status }))
        setFetched(true)
      })
    return () => { cancelled = true }
  }, [user, userLoading])

  return {
    loading: userLoading || !fetched,
    plan,
    isPaid:  isPaidPlan(plan),
  }
}
