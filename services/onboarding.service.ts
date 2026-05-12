/**
 * Onboarding state service — Sprint W6 Day 30 (PR #48).
 *
 * Thin wrapper around `users.onboarding_state` JSONB (Migration 066).
 * Used by the per-role wizards under `/app/onboarding/*`. State is
 * persisted on each step transition so resume-after-close works.
 *
 * Shape is loose by design — see migration comment for the canonical
 * structure. Each wizard owns its own sub-key (`athlete`, `coach`,
 * `org`, `doctor`) so other roles' data never collides.
 */
import { createClient } from '@/lib/supabase/client'

export type WizardRole = 'athlete' | 'coach' | 'organization' | 'admin' | 'doctor'

export interface AthleteWizardData {
  sport?:  string
  goal?:   string
  level?:  'beginner' | 'intermediate' | 'advanced'
}

export interface CoachWizardData {
  speciality?:         string
  first_invite_email?: string
  first_invite_sent?:  boolean
}

export interface OrgWizardData {
  org_name?:        string
  org_type?:        string   // club | federation | team | school | gym | academy | other
  sport_type?:      string
  description?:     string
  city?:            string
  profile_public?:  boolean
  invite_emails?:   string[]      // up to 3 first athlete invites
  invites_sent?:    number        // count of /api/invite POSTs that succeeded
  org_row_created?: boolean
}

export interface DoctorWizardData {
  medical_specialty?:  string   // cardiology | orthopedic | sports_medicine | general | other
  main_focus?:         string
  weekly_hours?:       number
  preferred_days?:     string[]   // mon | tue | wed | thu | fri | sat | sun
  consent_152fz?:      boolean
  accept_terms?:       boolean
  emergency_contact?:  boolean
}

export interface OnboardingState {
  completed?:          boolean
  started_at?:         string
  completed_at?:       string | null
  step?:               string
  role_when_started?:  WizardRole
  athlete?:            AthleteWizardData
  coach?:              CoachWizardData
  organization?:       OrgWizardData
  doctor?:             DoctorWizardData
}

/** Loads current user's onboarding state, or {} if missing. */
export async function loadMyOnboarding(): Promise<OnboardingState> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return {}
  const { data: meRow } = await sb
    .from('users')
    .select('onboarding_state')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as { onboarding_state: OnboardingState | null } | null
  return (me?.onboarding_state ?? {}) as OnboardingState
}

/**
 * Shallow-merges `patch` into existing state and persists.
 * Returns the merged state (or {} on failure).
 *
 * Why shallow merge? Sub-keys (athlete, coach, …) are themselves
 * objects — a top-level spread would clobber prior fields. We do a
 * 2-level merge: top-level keys + role sub-keys.
 */
export async function patchMyOnboarding(patch: Partial<OnboardingState>): Promise<OnboardingState> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return {}
  const { data: meRow } = await sb
    .from('users')
    .select('id, onboarding_state')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as { id: string; onboarding_state: OnboardingState | null } | null
  if (!me) return {}

  const prev = (me.onboarding_state ?? {}) as OnboardingState
  const next: OnboardingState = {
    ...prev,
    ...patch,
    athlete:      { ...(prev.athlete      ?? {}), ...(patch.athlete      ?? {}) },
    coach:        { ...(prev.coach        ?? {}), ...(patch.coach        ?? {}) },
    organization: { ...(prev.organization ?? {}), ...(patch.organization ?? {}) },
    doctor:       { ...(prev.doctor       ?? {}), ...(patch.doctor       ?? {}) },
  }

  // Drop empty sub-objects so the JSON stays tidy.
  for (const k of ['athlete', 'coach', 'organization', 'doctor'] as const) {
    if (next[k] && Object.keys(next[k] as object).length === 0) delete next[k]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('users')
    .update({ onboarding_state: next })
    .eq('id', me.id)
  if (error) {
    console.warn('[onboarding.patchMyOnboarding]', error.message)
    return prev
  }
  return next
}

/** Terminal: marks completed + sets timestamp. */
export async function markOnboardingComplete(): Promise<boolean> {
  const merged = await patchMyOnboarding({
    completed:    true,
    completed_at: new Date().toISOString(),
    step:         'done',
  })
  return merged.completed === true
}

/** Cheap helper — is the wizard already done? */
export function isOnboarded(state: OnboardingState | null | undefined): boolean {
  return !!state && state.completed === true
}
