/**
 * Adherence nudge service — Sprint W8 Day 40 (PR #58).
 *
 * Finds athletes who would benefit from a gentle proactive email:
 *   - missed_workouts: prescribed ≥3 workouts in past 7d but completed ≤1
 *   - expiring_pass:   has an active pass expiring within 7 days
 *
 * Dedup via `workout_nudges` table (Migration 070): no more than one
 * nudge of a given type per athlete per 7-day window. The /api/cron/
 * adherence-nudge route consumes these finders, applies notification_prefs
 * gate (W6 Day 29 pattern), and dispatches via Resend.
 *
 * Server-only — uses admin client (bypasses RLS to scan all athletes).
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type NudgeType = 'missed_workouts' | 'expiring_pass' | 'at_risk_acwr' | 'recovery_low'

export interface NudgeCandidate {
  athlete_id:    string
  athlete_name:  string | null
  athlete_email: string | null
  nudge_type:    NudgeType
  /** Free-form context displayed in the email body / logged in workout_nudges.payload. */
  context:       Record<string, unknown>
}

const SCAN_WINDOW_DAYS    = 7   // how far back to look for missed workouts
const THRESHOLD_PRESCRIBED = 3  // need at least this many prescribed to trigger
const THRESHOLD_COMPLETED  = 1  // and at most this many completed to count as missed
const EXPIRING_AHEAD_DAYS  = 7  // pass expiring within this many days

/**
 * Pulls athletes who have missed prescribed workouts in the last 7 days.
 * Heuristic: prescribed >= 3 AND completed <= 1 → nudge candidate.
 */
export async function findAthletesMissingWorkouts(): Promise<NudgeCandidate[]> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - SCAN_WINDOW_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // Step 1: pull all prescribed workouts in window. RLS is bypassed (admin client).
  const { data: rawWorkouts, error } = await admin
    .from('workouts')
    .select('id, athlete_id, event_date, completion_status')
    .eq('event_type', 'prescribed')
    .gte('event_date', weekAgo)
    .lte('event_date', today)
    .limit(5000)
  if (error) {
    console.warn('[adherence-nudge.findAthletesMissingWorkouts]', error.message)
    return []
  }
  const workouts = (rawWorkouts ?? []) as Array<{ id: string; athlete_id: string; event_date: string; completion_status: string | null }>

  // Step 2: bucket by athlete.
  const buckets = new Map<string, { prescribed: number; completed: number }>()
  for (const w of workouts) {
    const b = buckets.get(w.athlete_id) ?? { prescribed: 0, completed: 0 }
    b.prescribed += 1
    if (w.completion_status === 'completed') b.completed += 1
    buckets.set(w.athlete_id, b)
  }

  // Step 3: filter to candidates.
  const candidateIds: string[] = []
  const contextByAthlete = new Map<string, { prescribed: number; completed: number; missed: number }>()
  for (const [athleteId, b] of buckets) {
    if (b.prescribed >= THRESHOLD_PRESCRIBED && b.completed <= THRESHOLD_COMPLETED) {
      candidateIds.push(athleteId)
      contextByAthlete.set(athleteId, {
        prescribed: b.prescribed,
        completed:  b.completed,
        missed:     b.prescribed - b.completed,
      })
    }
  }
  if (candidateIds.length === 0) return []

  // Step 4: resolve names + emails.
  const { data: usersRows } = await admin
    .from('users')
    .select('id, name, email')
    .in('id', candidateIds)
    .eq('role', 'athlete')
  const users = (usersRows ?? []) as Array<{ id: string; name: string | null; email: string | null }>

  return users
    .filter(u => !!u.email)
    .map(u => ({
      athlete_id:    u.id,
      athlete_name:  u.name,
      athlete_email: u.email,
      nudge_type:    'missed_workouts' as const,
      context:       (contextByAthlete.get(u.id) ?? {}) as Record<string, unknown>,
    }))
}

/**
 * Pulls athletes who have at least one active pass expiring within 7 days.
 * Heuristic: status='active' AND expires_at BETWEEN today AND today+7.
 */
export async function findAthletesWithExpiringPasses(): Promise<NudgeCandidate[]> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() + EXPIRING_AHEAD_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const { data: passes, error } = await admin
    .from('athlete_passes')
    .select('id, athlete_id, title, total_sessions, used_sessions, expires_at')
    .eq('status', 'active')
    .gte('expires_at', today)
    .lte('expires_at', cutoff)
    .limit(2000)
  if (error) {
    console.warn('[adherence-nudge.findAthletesWithExpiringPasses]', error.message)
    return []
  }
  const rows = (passes ?? []) as Array<{
    id: string; athlete_id: string; title: string;
    total_sessions: number; used_sessions: number; expires_at: string
  }>

  // Group by athlete: keep most-urgent (earliest expires_at) per athlete.
  const byAthlete = new Map<string, typeof rows[number]>()
  for (const r of rows) {
    const existing = byAthlete.get(r.athlete_id)
    if (!existing || r.expires_at < existing.expires_at) byAthlete.set(r.athlete_id, r)
  }
  const athleteIds = Array.from(byAthlete.keys())
  if (athleteIds.length === 0) return []

  const { data: usersRows } = await admin
    .from('users')
    .select('id, name, email')
    .in('id', athleteIds)
    .eq('role', 'athlete')
  const users = (usersRows ?? []) as Array<{ id: string; name: string | null; email: string | null }>

  return users
    .filter(u => !!u.email)
    .map(u => {
      const pass = byAthlete.get(u.id)!
      const daysLeft = Math.max(0, Math.ceil(
        (new Date(pass.expires_at).getTime() - Date.now()) / (24 * 3600 * 1000)
      ))
      return {
        athlete_id:    u.id,
        athlete_name:  u.name,
        athlete_email: u.email,
        nudge_type:    'expiring_pass' as const,
        context: {
          pass_title:     pass.title,
          expires_at:     pass.expires_at,
          days_left:      daysLeft,
          remaining_sessions: pass.total_sessions - pass.used_sessions,
        },
      }
    })
}

/**
 * Has this athlete already received this nudge type in the last 7 days?
 * Cheap lookup powered by idx_workout_nudges_dedup partial index.
 */
export async function wasNudgedRecently(
  athleteId: string,
  nudgeType: NudgeType,
): Promise<boolean> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { count } = await admin
    .from('workout_nudges')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .eq('nudge_type', nudgeType)
    .gte('sent_at', cutoff)
  return (count ?? 0) > 0
}

/** Record that a nudge of `nudgeType` was sent to `athleteId`. */
export async function recordNudgeSent(
  athleteId: string,
  nudgeType: NudgeType,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('workout_nudges')
    .insert({ athlete_id: athleteId, nudge_type: nudgeType, payload })
  if (error) {
    console.warn('[adherence-nudge.recordNudgeSent]', error.message)
    return false
  }
  return true
}
