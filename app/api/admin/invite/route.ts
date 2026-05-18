/**
 * /api/admin/invite — Sprint W10 Day 51 (PR #72).
 *
 * POST  — admin creates a new-user invite. Inserts `admin_user_invites`
 *         row, sends Resend email pointing to /auth/register?invite=
 *         <token>&role=<target_role>.
 *
 * Requires authenticated user with role='admin'. RLS additionally
 * enforces this at DB layer.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

const ALLOWED_ROLES = new Set(['athlete', 'coach', 'doctor', 'organization'])
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM    = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'

const ROLE_LABEL_RU: Record<string, string> = {
  athlete:      'атлет',
  coach:        'тренер',
  doctor:       'врач',
  organization: 'организация',
}

function renderAdminInviteEmail(input: {
  inviter_name: string
  target_role:  string
  claim_url:    string
  expires_at:   string
}): { subject: string; html: string } {
  const roleRu = ROLE_LABEL_RU[input.target_role] ?? input.target_role
  const subject = `Приглашение в ProForm как ${roleRu}`
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
    <p style="font-size:11px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:0.18em;margin:0 0 6px">ProForm</p>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 12px">Приглашение от администратора</h1>
    <p style="font-size:14px;line-height:1.55;margin:0 0 16px">
      ${input.inviter_name} приглашает вас присоединиться к платформе ProForm
      как <strong>${roleRu}</strong>.
    </p>
    <p style="font-size:14px;line-height:1.55;margin:0 0 20px">
      Перейдите по ссылке, чтобы зарегистрироваться:
    </p>
    <p style="margin:0 0 20px">
      <a href="${input.claim_url}" style="display:inline-block;padding:12px 22px;background:#f97316;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Принять приглашение →
      </a>
    </p>
    <p style="font-size:12px;color:#64748b;margin:0">
      Ссылка действует до ${new Date(input.expires_at).toLocaleDateString('ru-RU')}.
      Если не вы регистрировались — просто игнорируйте это письмо.
    </p>
  </div>
</body></html>`
  return { subject, html }
}

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
  if ((me as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { email?: string; role?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const targetRole = body.role ?? ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.has(targetRole)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Block invite if email already belongs to an existing user.
  const { data: existingUser } = await admin
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()
  if (existingUser) {
    return NextResponse.json({ error: 'user_already_exists' }, { status: 409 })
  }

  // Reuse pending invite if one exists for same (email, role) — idempotent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('admin_user_invites')
    .select('id, token, expires_at')
    .eq('email', email)
    .eq('target_role', targetRole)
    .eq('status', 'pending')
    .maybeSingle()

  let token: string, inviteId: string, expiresAt: string
  if (existing) {
    token = (existing as { token: string }).token
    inviteId = (existing as { id: string }).id
    expiresAt = (existing as { expires_at: string }).expires_at
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (admin as any)
      .from('admin_user_invites')
      .insert({
        email,
        target_role: targetRole,
        created_by_admin_id: (me as { id: string }).id,
      })
      .select('id, token, expires_at')
      .single()
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 })
    }
    token = (created as { token: string }).token
    inviteId = (created as { id: string }).id
    expiresAt = (created as { expires_at: string }).expires_at
  }

  const claimUrl = `${APP_URL}/auth/register?invite=${token}&role=${targetRole}`
  const inviterName =
    ((me as { name?: string | null }).name)
    ?? ((me as { nickname?: string | null }).nickname)
    ?? 'Администратор ProForm'

  let emailSent = false
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(RESEND_API_KEY)
      const { subject, html } = renderAdminInviteEmail({
        inviter_name: inviterName,
        target_role:  targetRole,
        claim_url:    claimUrl,
        expires_at:   expiresAt,
      })
      await resend.emails.send({ from: FROM, to: email, subject, html })
      emailSent = true
    } catch (e) {
      console.warn('[admin/invite] email send failed:', e instanceof Error ? e.message : e)
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
