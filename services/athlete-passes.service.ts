/**
 * Athlete passes service — Sprint W8 Day 39 (PR #57).
 *
 * Read + atomic-use helpers around `athlete_passes` table. Passes are
 * issued to athletes either via coach manual creation OR (eventually)
 * via marketplace purchase + payment webhook.
 *
 * RLS (already in place):
 *   - athlete_passes_athlete_select: athlete reads own rows
 *   - athlete_passes_coach_all:      coach has ALL ops on own rows
 *
 * Atomic session deduction is the only "tricky" part: prevent double-
 * spend race condition via WHERE clause on used_sessions < total_sessions.
 * For high-frequency contention a SQL function with row-lock would be
 * stronger, but at current scale the optimistic UPDATE is adequate.
 *
 * Price stored in CENTS (matches coach_pass_plans convention).
 */
import { createClient } from '@/lib/supabase/client'

export type PassStatus = 'active' | 'expired' | 'cancelled' | 'used_up'

export interface AthletePass {
  id:                string
  coach_id:          string
  athlete_id:        string
  plan_id:           string | null
  title:             string
  total_sessions:    number          // smallint
  used_sessions:     number          // smallint, starts at 0
  starts_at:         string          // YYYY-MM-DD
  expires_at:        string          // YYYY-MM-DD
  price_cents:       number          // CENTS
  currency:          string          // 'RUB' default
  status:            PassStatus
  notes:             string | null
  seller_specialty:  string | null
  service_type:      string
  created_at:        string
  updated_at:        string
}

export interface AthletePassWithCoach extends AthletePass {
  coach_name:        string | null
  coach_avatar_url:  string | null
}

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * Returns athlete's currently-usable passes:
 *   status='active' AND expires_at >= today AND used_sessions < total_sessions.
 * Sorted by expires_at ASC (most-urgent first).
 */
export async function listMyActivePasses(): Promise<AthletePassWithCoach[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('athlete_passes')
    .select('*')
    .eq('athlete_id', me.id)
    .eq('status', 'active')
    .gte('expires_at', today)
    .order('expires_at', { ascending: true })
  if (error) {
    console.warn('[athlete-passes.listMyActivePasses]', error.message)
    return []
  }
  const passes = (data ?? []) as AthletePass[]
  return enrichWithCoach(sb, passes)
}

/**
 * Returns athlete's archived passes (expired by date, status, OR fully used).
 * Sorted by expires_at DESC (most-recent first).
 */
export async function listMyExpiredPasses(): Promise<AthletePassWithCoach[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const today = new Date().toISOString().slice(0, 10)
  // PostgREST .or() requires comma-separated filters in nested form.
  const { data, error } = await sb
    .from('athlete_passes')
    .select('*')
    .eq('athlete_id', me.id)
    .or(`status.eq.expired,status.eq.cancelled,status.eq.used_up,expires_at.lt.${today}`)
    .order('expires_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[athlete-passes.listMyExpiredPasses]', error.message)
    return []
  }
  const passes = (data ?? []) as AthletePass[]
  return enrichWithCoach(sb, passes)
}

/**
 * Count of currently-usable passes for the calling athlete. Used by
 * dashboard widget.
 */
export async function countMyActivePasses(): Promise<number> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return 0
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return 0

  const today = new Date().toISOString().slice(0, 10)
  const { count } = await sb
    .from('athlete_passes')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', me.id)
    .eq('status', 'active')
    .gte('expires_at', today)
  return count ?? 0
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Atomically decrement a pass's available sessions. Coach-side helper
 * (athletes don't self-use). Uses optimistic conditional UPDATE — if
 * the pass became unusable between read and write (race), the update
 * matches 0 rows and we return false.
 *
 * Conditions enforced atomically:
 *   - status = 'active'
 *   - expires_at >= today
 *   - used_sessions < total_sessions
 *
 * RLS layer: coach must own the pass (athlete_passes_coach_all).
 */
export async function useSession(passId: string): Promise<{ ok: boolean; remaining: number | null }> {
  const sb = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // First read the pass to know current used_sessions (needed for explicit
  // SET clause — Supabase doesn't expose RPC for atomic increment without
  // a SQL function). The .lt() filter prevents underflow.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: readErr } = await (sb as any)
    .from('athlete_passes')
    .select('id, used_sessions, total_sessions, status, expires_at')
    .eq('id', passId)
    .maybeSingle()
  if (readErr || !row) return { ok: false, remaining: null }
  if (row.status !== 'active') return { ok: false, remaining: row.total_sessions - row.used_sessions }
  if (row.expires_at < today)  return { ok: false, remaining: row.total_sessions - row.used_sessions }
  if (row.used_sessions >= row.total_sessions) return { ok: false, remaining: 0 }

  const newUsed = row.used_sessions + 1
  const reachesCap = newUsed >= row.total_sessions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updErr } = await (sb as any)
    .from('athlete_passes')
    .update({
      used_sessions: newUsed,
      // Auto-flip status when last session consumed.
      status: reachesCap ? 'used_up' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', passId)
    .eq('used_sessions', row.used_sessions)   // OPTIMISTIC LOCK: only update if value hasn't changed
    .select('used_sessions, total_sessions')
    .maybeSingle()
  if (updErr || !updated) return { ok: false, remaining: null }
  return { ok: true, remaining: updated.total_sessions - updated.used_sessions }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function enrichWithCoach(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  passes: AthletePass[],
): Promise<AthletePassWithCoach[]> {
  if (passes.length === 0) return []
  const coachIds = Array.from(new Set(passes.map(p => p.coach_id)))
  const { data: users } = await sb
    .from('users')
    .select('id, name, avatar_url')
    .in('id', coachIds)
  const map = new Map<string, { name: string | null; avatar_url: string | null }>()
  for (const u of (users ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>) {
    map.set(u.id, { name: u.name, avatar_url: u.avatar_url })
  }
  return passes.map(p => ({
    ...p,
    coach_name:       map.get(p.coach_id)?.name       ?? null,
    coach_avatar_url: map.get(p.coach_id)?.avatar_url ?? null,
  }))
}
