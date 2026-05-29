import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderInviteEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_COMBOS: Record<string, [string, string]> = {
  coach_athlete:  ['coach', 'athlete'],
  org_coach:      ['organization', 'coach'],
  org_athlete:    ['organization', 'athlete'],
  doctor_athlete: ['doctor', 'athlete'],
  coach_doctor:   ['coach', 'doctor'],
  org_doctor:     ['organization', 'doctor'],
  admin_doctor:   ['admin', 'doctor'],
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM    = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'

function displayName(u: { name?: string | null; nickname?: string | null; email?: string | null }): string {
  // Schema only has `name` (no first_name/last_name) — the previous
  // signature accepted those fields as defensive fallback, but the
  // SELECT below never asked for them. Drop both.
  return (u.name ?? u.nickname ?? u.email ?? 'Коллега').trim() || 'Коллега'
}

// POST /api/invite — create + email a tokenised invitation
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('id, role, name, nickname, email')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { email?: string; connection_type?: string; message?: string | null }
  const email = (body.email ?? '').trim().toLowerCase()
  const connection_type = body.connection_type ?? ''
  const message = body.message ?? null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  // Block self-invite — closes the +1mo Pro referral abuse vector at creation.
  const myEmail = ((me as { email?: string | null }).email ?? '').trim().toLowerCase()
  if (myEmail && myEmail === email) {
    return NextResponse.json({ error: 'self_invite_not_allowed' }, { status: 400 })
  }
  const combo = VALID_COMBOS[connection_type]
  if (!combo) return NextResponse.json({ error: 'invalid_connection_type' }, { status: 400 })
  if (me.role !== combo[0] && me.role !== combo[1]) {
    return NextResponse.json({ error: 'role_mismatch' }, { status: 422 })
  }

  // Avoid spamming: one pending invite per (inviter, email, type).
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('email_invites')
    .select('id, token, status, expires_at')
    .eq('inviter_id', me.id)
    .eq('email', email)
    .eq('connection_type', connection_type)
    .eq('status', 'pending')
    .maybeSingle()

  let token: string, inviteId: string, expiresAt: string
  if (existing) {
    token = (existing as any).token
    inviteId = (existing as any).id
    expiresAt = (existing as any).expires_at
  } else {
    const { data: created, error } = await admin
      .from('email_invites')
      .insert({
        inviter_id: me.id,
        email,
        connection_type,
        message,
      })
      .select('id, token, expires_at')
      .single()
    if (error || !created) {
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }
    token = (created as any).token
    inviteId = (created as any).id
    expiresAt = (created as any).expires_at
  }

  const claimUrl = `${APP_URL}/invite/${token}`

  // Send via Resend (silent-fail: invite still exists if email delivery fails).
  let emailSent = false
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(RESEND_API_KEY)
      const { subject, html } = renderInviteEmail({
        inviter_name: displayName(me as any),
        connection_type,
        message,
        claim_url: claimUrl,
        expires_at: expiresAt,
      })
      await resend.emails.send({ from: FROM, to: email, subject, html })
      emailSent = true
    } catch (e) {
      console.warn('[invite] email send failed:', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({
    ok: true,
    token,
    id: inviteId,
    url: claimUrl,
    email_sent: emailSent,
    expires_at: expiresAt,
  }, { status: 201 })
}
