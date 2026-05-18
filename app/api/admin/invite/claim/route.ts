/**
 * /api/admin/invite/claim — Sprint W10 Day 52 (PR #73).
 *
 * POST — server-side claim of an admin_user_invites row after the
 * invitee has completed registration. Uses admin client (bypass RLS)
 * because at this moment the new auth.user → users row may have just
 * been created by the handle_new_auth_user trigger and the caller
 * isn't necessarily signed in yet.
 *
 * Security: we trust the token alone — the only way to know it is
 * via the email Resend delivered. Email already lands in the
 * recipient's inbox, so possession of the token is the auth signal.
 * To prevent token replay, we only claim invites currently in
 * `pending` status — multiple POSTs short-circuit on the second call.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { token?: string; email?: string }
  const token = (body.token ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (admin as any)
    .from('admin_user_invites')
    .select('id, email, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!inv) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = inv as any
  if (row.status !== 'pending') {
    return NextResponse.json({ ok: true, already: row.status }, { status: 200 })
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // Mark as expired in passing; don't claim.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('admin_user_invites').update({ status: 'expired' }).eq('id', row.id)
    return NextResponse.json({ error: 'invite_expired' }, { status: 410 })
  }
  if (row.email.toLowerCase() !== email) {
    // Token belongs to a different email — could be a typo or replay.
    return NextResponse.json({ error: 'email_mismatch' }, { status: 422 })
  }

  // Resolve newly-created users row by email (trigger handle_new_auth_user
  // already populated it after auth.signUp resolved).
  const { data: userRow } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  const userId = (userRow as { id?: string } | null)?.id ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('admin_user_invites')
    .update({
      status: 'claimed',
      claimed_by_user_id: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')   // belt-and-braces vs race
  if (error) {
    console.warn('[admin/invite/claim] update failed:', error.message)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, invite_id: row.id, claimed_by_user_id: userId }, { status: 200 })
}
