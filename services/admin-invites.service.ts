/**
 * Admin invites service — Sprint W10 Day 51 (PR #72).
 *
 * Reads + revoke helpers around `admin_user_invites` table. Creating
 * an invite happens server-side via /api/admin/invite (uses admin
 * client + sends Resend email). RLS layer (migration 074) restricts
 * all ops to authenticated admins.
 */
import { createClient } from '@/lib/supabase/client'

export type AdminInviteRole = 'athlete' | 'coach' | 'doctor' | 'organization'
export type AdminInviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked'

export interface AdminUserInvite {
  id:                   string
  token:                string
  email:                string
  target_role:          AdminInviteRole
  created_by_admin_id:  string
  status:               AdminInviteStatus
  claimed_by_user_id:   string | null
  claimed_at:           string | null
  expires_at:           string
  created_at:           string
}

/**
 * Lists invites the current admin has created, newest-first.
 * Optionally filter by status.
 */
export async function listMyAdminInvites(opts?: {
  status?: AdminInviteStatus
  limit?:  number
}): Promise<AdminUserInvite[]> {
  const sb = createClient()
  let q = sb
    .from('admin_user_invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100)
  if (opts?.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) {
    console.warn('[admin-invites.listMyAdminInvites]', error.message)
    return []
  }
  return (data ?? []) as AdminUserInvite[]
}

/**
 * Revokes a pending invite (status → 'revoked'). RLS allows the
 * current admin to update any row.
 */
export async function revokeAdminInvite(inviteId: string): Promise<{ ok: boolean; error: string | null }> {
  const sb = createClient()
  const { error } = await sb
    .from('admin_user_invites')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: 'revoked' } as any)
    .eq('id', inviteId)
    .eq('status', 'pending')
  if (error) {
    console.warn('[admin-invites.revokeAdminInvite]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}
