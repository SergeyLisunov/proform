'use client'
import { ReactNode } from 'react'
import { useSubscription, PaywallBanner, type Plan } from './Paywall'

type Props = {
  requiredPlan?: Plan
  feature: string
  title: string
  description: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * PlanGate — declarative wrapper that shows children only when the current
 * subscription meets the required plan. Otherwise renders a paywall banner
 * (or custom fallback).
 *
 * Usage:
 *   <PlanGate requiredPlan="pro" feature="ai.video" title="AI разбор"
 *             description="Доступно с тарифом Pro">
 *     <VideoAnalysisPanel />
 *   </PlanGate>
 */
export default function PlanGate({
  requiredPlan = 'pro',
  feature,
  title,
  description,
  children,
  fallback,
}: Props) {
  const { plan, loading } = useSubscription()

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        Проверяем подписку…
      </div>
    )
  }

  const order: Record<Plan, number> = { free: 0, pro: 1, team: 2 }
  const hasAccess = order[plan] >= order[requiredPlan]
  if (hasAccess) return <>{children}</>

  if (fallback) return <>{fallback}</>
  return (
    <PaywallBanner
      feature={feature}
      title={title}
      description={description}
      requiredPlan={requiredPlan}
    />
  )
}
