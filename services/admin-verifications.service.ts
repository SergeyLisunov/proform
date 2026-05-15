/**
 * Admin verifications service — Sprint W9 Day 45 (PR #66).
 *
 * Admin-only RPC for toggling `users.is_verified` per coach.
 * RLS (migration 072) gates UPDATE to admins; this client wrapper
 * just bundles the metadata fields (verified_at, verified_by) and
 * exposes a simple list-by-role helper.
 */
import { createClient } from '@/lib/supabase/client'

export interface VerifiableCoach {
  id:                  string
  name:                string | null
  nickname:            string | null
  avatar_url:          string | null
  email:               string | null
  is_verified:         boolean
  verified_at:         string | null
  verified_by:         string | null
  verification_notes:  string | null
  created_at:          string
}

/**
 * Lists coaches for the admin verification panel. Returns ALL coaches
 * (verified + unverified). Sorted: unverified first (admin action
 * needed), then by created_at DESC.
 */
export async function listCoachesForVerification(): Promise<VerifiableCoach[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('id, name, nickname, avatar_url, email, is_verified, verified_at, verified_by, verification_notes, created_at' as any)
    .eq('role', 'coach')
    .order('is_verified', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.warn('[admin-verifications.listCoachesForVerification]', error.message)
    return []
  }
  return (data ?? []) as VerifiableCoach[]
}

/**
 * Toggle a coach's verification status. Sets metadata atomically.
 * RLS (migration 072) enforces admin role.
 */
export async function setCoachVerification(input: {
  coachId:  string
  verified: boolean
  notes?:   string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, error: 'Не авторизован' }
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return { ok: false, error: 'Профиль не найден' }
  if (me.role !== 'admin') return { ok: false, error: 'Доступно только администраторам' }

  const payload = input.verified
    ? {
        is_verified:        true,
        verified_at:        new Date().toISOString(),
        verified_by:        me.id,
        verification_notes: input.notes?.trim() || null,
      }
    : {
        is_verified:        false,
        verified_at:        null,
        verified_by:        null,
        verification_notes: null,
      }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('users')
    .update(payload)
    .eq('id', input.coachId)
  if (error) {
    console.warn('[admin-verifications.setCoachVerification]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}
