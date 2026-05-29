/**
 * /api/admin/invite/bulk — Sprint W11 Day 57 (PR #78).
 *
 * POST — admin sends a batch of invites in one call. Extends the
 *        single-invite endpoint from W10 Day 51 with:
 *          - up to 50 emails per call (rate cap)
 *          - per-email result breakdown
 *          - idempotency carry-over (same (email, role) pair won't
 *            create duplicate pending invites)
 *
 * Sales unblocker: «onboard a 30-coach club without typing 30 times».
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['athlete', 'coach', 'doctor', 'organization'])
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM    = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'
const MAX_BATCH = 50

const ROLE_LABEL_RU: Record<string, string> = {
  athlete:      'атлет',
  coach:        'тренер',
  doctor:       'врач',
  organization: 'организация',
}

interface PerEmailResult {
  email:  string
  status: 'sent' | 'reused' | 'user_exists' | 'invalid' | 'failed'
  error?: string
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
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

  const body = await req.json().catch(() => ({})) as { emails?: string[]; role?: string }
  const targetRole = body.role ?? ''
  if (!ALLOWED_ROLES.has(targetRole)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }
  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  if (rawEmails.length === 0) {
    return NextResponse.json({ error: 'empty_emails' }, { status: 400 })
  }
  if (rawEmails.length > MAX_BATCH) {
    return NextResponse.json({ error: 'batch_too_large', max: MAX_BATCH }, { status: 400 })
  }

  // Dedup + lowercase + trim
  const emails = Array.from(new Set(
    rawEmails.map(e => (e ?? '').toString().trim().toLowerCase()).filter(Boolean),
  ))

  const admin = createAdminClient()
  const inviterName =
    ((me as { name?: string | null }).name)
    ?? ((me as { nickname?: string | null }).nickname)
    ?? 'Администратор ProForm'

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resend: any = null
  if (RESEND_API_KEY) {
    try {
      const mod = await import('resend')
      resend = new mod.Resend(RESEND_API_KEY)
    } catch (e) {
      console.warn('[admin/invite/bulk] resend init failed:', e instanceof Error ? e.message : e)
    }
  }

  const results: PerEmailResult[] = []
  for (const email of emails) {
    if (!isValidEmail(email)) {
      results.push({ email, status: 'invalid' })
      continue
    }

    // Skip if user already exists.
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existingUser) {
      results.push({ email, status: 'user_exists' })
      continue
    }

    // Idempotency: reuse pending invite for same (email, role).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('admin_user_invites')
      .select('id, token, expires_at')
      .eq('email', email)
      .eq('target_role', targetRole)
      .eq('status', 'pending')
      .maybeSingle()

    let token: string, expiresAt: string, reused = false
    if (existing) {
      token = (existing as { token: string }).token
      expiresAt = (existing as { expires_at: string }).expires_at
      reused = true
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
        results.push({ email, status: 'failed', error: 'insert_failed' })
        continue
      }
      token = (created as { token: string }).token
      expiresAt = (created as { expires_at: string }).expires_at
    }

    const claimUrl = `${APP_URL}/auth/register?invite=${token}&role=${targetRole}`
    if (resend) {
      try {
        const { subject, html } = renderAdminInviteEmail({
          inviter_name: inviterName,
          target_role:  targetRole,
          claim_url:    claimUrl,
          expires_at:   expiresAt,
        })
        await resend.emails.send({ from: FROM, to: email, subject, html })
        results.push({ email, status: reused ? 'reused' : 'sent' })
      } catch (e) {
        console.warn('[admin/invite/bulk] send failed for', email, e instanceof Error ? e.message : e)
        results.push({ email, status: 'failed', error: 'email_send_failed' })
      }
    } else {
      // No Resend configured — still consider invite "sent" record-wise.
      results.push({ email, status: reused ? 'reused' : 'sent' })
    }
  }

  const summary = {
    total:        results.length,
    sent:         results.filter(r => r.status === 'sent').length,
    reused:       results.filter(r => r.status === 'reused').length,
    user_exists:  results.filter(r => r.status === 'user_exists').length,
    invalid:      results.filter(r => r.status === 'invalid').length,
    failed:       results.filter(r => r.status === 'failed').length,
  }

  return NextResponse.json({ ok: true, summary, results }, { status: 200 })
}
