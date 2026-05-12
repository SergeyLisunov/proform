'use client'
/**
 * /onboarding — role dispatcher. Sprint W6 Day 30 (PR #48).
 *
 * Reads the current user + their onboarding_state:
 *   - completed → /dashboard
 *   - role=athlete or trainer alias → /onboarding/athlete
 *   - role=coach → /onboarding/coach
 *   - role=organization/admin/doctor → fallback to /dashboard for now
 *     (org + doctor wizards land in Sprint W6 Day 31)
 *   - unauth → /auth/login
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { loadMyOnboarding, isOnboarded } from '@/services/onboarding.service'

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
      const role = user.role
      if (role === 'athlete') router.replace('/onboarding/athlete')
      else if (role === 'coach' || role === 'trainer') router.replace('/onboarding/coach')
      else if (role === 'organization') router.replace('/onboarding/organization')
      else if (role === 'doctor') router.replace('/onboarding/doctor')
      else router.replace('/dashboard')   // admin — skip wizard
    })()
    return () => { cancelled = true }
  }, [user, loading, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )
}
