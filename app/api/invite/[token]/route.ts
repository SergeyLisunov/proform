import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/invite/[token] — fetch invite info for the landing page
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('email_invites')
    .select('id, email, connection_type, message, status, expires_at, inviter_id')
    .eq('token', params.token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const expired = new Date((invite as any).expires_at).getTime() < Date.now()
  if ((invite as any).status !== 'pending' || expired) {
    return NextResponse.json({
      ok: false,
      error: expired ? 'expired' : (invite as any).status,
      email: (invite as any).email,
    }, { status: 410 })
  }

  const { data: inviter } = await admin
    .from('users')
    .select('id, name, nickname, role, avatar_url')
    .eq('id', (invite as any).inviter_id)
    .single()

  return NextResponse.json({
    ok: true,
    invite: {
      email: (invite as any).email,
      connection_type: (invite as any).connection_type,
      message: (invite as any).message,
      expires_at: (invite as any).expires_at,
    },
    inviter: inviter ?? null,
  })
}

// POST /api/invite/[token] — claim the invite (must be signed in)
export async function POST(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('id, role, email')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('email_invites')
    .select('*')
    .eq('token', params.token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const inv = invite as any
  // Block self-claim — even if creation slipped through, claim must not credit
  // the inviter for inviting themselves (closes +1mo Pro abuse vector).
  if (inv.inviter_id === (me as { id: string }).id) {
    return NextResponse.json({ ok: false, error: 'self_referral_not_allowed' }, { status: 422 })
  }
  if (inv.status !== 'pending') {
    return NextResponse.json({ ok: false, error: inv.status }, { status: 410 })
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    await admin.from('email_invites').update({ status: 'expired' }).eq('id', inv.id)
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 })
  }

  // Role check — the signed-in user's role must match the invite's other side.
  const VALID_COMBOS: Record<string, [string, string]> = {
    coach_athlete:  ['coach', 'athlete'],
    org_coach:      ['organization', 'coach'],
    org_athlete:    ['organization', 'athlete'],
    doctor_athlete: ['doctor', 'athlete'],
    coach_doctor:   ['coach', 'doctor'],
    org_doctor:     ['organization', 'doctor'],
    admin_doctor:   ['admin', 'doctor'],
  }
  const combo = VALID_COMBOS[inv.connection_type]
  if (!combo) return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })

  // Determine which side is the recipient (the one that isn't the inviter's role).
  const { data: inviter } = await admin
    .from('users').select('id, role').eq('id', inv.inviter_id).single()
  if (!inviter) return NextResponse.json({ ok: false, error: 'inviter_missing' }, { status: 410 })

  const myRole = (me as any).role
  const inviterRole = (inviter as any).role
  const recipientRole = combo[0] === inviterRole ? combo[1] : combo[0]
  if (myRole !== recipientRole) {
    return NextResponse.json({ ok: false, error: 'role_mismatch', required_role: recipientRole }, { status: 422 })
  }

  // Upsert connection in pending state (existing connections API expects this shape).
  const { data: existingConn } = await admin
    .from('connections')
    .select('id, status')
    .or(
      `and(initiator_id.eq.${inv.inviter_id},recipient_id.eq.${(me as any).id}),` +
      `and(initiator_id.eq.${(me as any).id},recipient_id.eq.${inv.inviter_id})`
    )
    .eq('connection_type', inv.connection_type)
    .maybeSingle()

  let connectionId: string
  if (existingConn) {
    connectionId = (existingConn as any).id
    if ((existingConn as any).status !== 'active') {
      await admin
        .from('connections')
        .update({ status: 'active', responded_at: new Date().toISOString() })
        .eq('id', connectionId)
    }
  } else {
    const { data: newConn, error: cErr } = await admin
      .from('connections')
      .insert({
        initiator_id: inv.inviter_id,
        recipient_id: (me as any).id,
        connection_type: inv.connection_type,
        status: 'active',
        message: inv.message,
        responded_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (cErr || !newConn) {
      return NextResponse.json({ ok: false, error: 'connection_failed' }, { status: 500 })
    }
    connectionId = (newConn as any).id
  }

  // Sync org roster: org_* invites grant a connection AND must add an
  // org_members row — the org roster (app/org/members) reads org_members, so
  // without this an invite-link member is silently invisible in the roster.
  // Non-blocking: the connection above is the canonical access grant; a roster
  // sync failure must not fail the claim.
  const ORG_MEMBER_ROLE: Record<string, string> = {
    org_athlete: 'athlete',
    org_coach:   'coach',
    org_doctor:  'doctor',
  }
  const orgMemberRole = ORG_MEMBER_ROLE[inv.connection_type]
  if (orgMemberRole) {
    // The org side is the party whose role is 'organization'
    // (organizations.id == that user's id); the other party is the member.
    const orgUserId    = inviterRole === 'organization' ? inv.inviter_id : (me as any).id
    const memberUserId = inviterRole === 'organization' ? (me as any).id : inv.inviter_id
    try {
      const { error: omErr } = await (admin as any)
        .from('org_members')
        .upsert(
          {
            org_id:      orgUserId,
            user_id:     memberUserId,
            member_role: orgMemberRole,
            status:      'active',
            joined_at:   new Date().toISOString(),
            invited_by:  inv.inviter_id,
          },
          { onConflict: 'org_id,user_id' }
        )
      if (omErr) console.warn('[invite] org_members roster sync skipped:', omErr.message)
    } catch (e) {
      console.warn('[invite] org_members roster sync error:', e)
    }
  }

  // Mark invite claimed.
  await admin
    .from('email_invites')
    .update({
      status: 'claimed',
      claimed_by_user_id: (me as any).id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', inv.id)

  // Referral credit: +1 месяц Pro инвайтеру. Идемпотентно через
  // unique source_invite_id → повторный claim того же invite ничего не даст.
  let referralCreditId: string | null = null
  try {
    const { data: rpcData } = await (admin as any).rpc('grant_referral_credit', {
      p_inviter_id:       inv.inviter_id,
      p_invited_user_id:  (me as any).id,
      p_source_invite_id: inv.id,
      p_months:           1,
    })
    referralCreditId = rpcData ?? null
  } catch (e) {
    console.warn('[invite] referral credit skipped:', e)
  }

  // Notify inviter.
  await admin.from('notifications').insert({
    user_id: inv.inviter_id,
    type: 'invitation_accepted',
    title: referralCreditId ? 'Приглашение принято — +1 месяц Pro' : 'Приглашение принято',
    body: (me as any).email ?? null,
    entity_type: 'connection',
    entity_id: connectionId,
    action_url: '/connections',
  })

  return NextResponse.json({ ok: true, connection_id: connectionId })
}
