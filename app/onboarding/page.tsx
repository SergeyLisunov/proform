'use client'
/**
 * /onboarding — role dispatcher. Sprint W6 Day 30 (PR #48).
 *
 * Reads the current user + their onboarding_state:
 *   - completed → /dashboard
 *   - роль с мастером → её мастер (lib/onboarding/wizard-routes)
 *   - роль без мастера (admin) → /dashboard: middleware таких сюда не шлёт,
 *     поэтому круга /dashboard ↔ /onboarding нет
 *   - unauth → /auth/login
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { loadMyOnboarding, isOnboarded } from '@/services/onboarding.service'
import { wizardPathForRole } from '@/lib/onboarding/wizard-routes'

export default function OnboardingDispatcherPage() {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth/login'); return }

    let cancelled = false
    void (async () => {
      const state = await loadMyOnboarding()
      if (cancelled) return
      if (isOnboarded(state)) {
        router.replace('/dashboard')
        return
      }
      router.replace(wizardPathForRole(user.role) ?? '/dashboard')
    })()
    return () => { cancelled = true }
  }, [user, loading, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )
}
