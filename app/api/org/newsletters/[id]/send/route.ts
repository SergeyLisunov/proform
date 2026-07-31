import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/org/newsletters/[id]/send
 *
 * Sprint W1 Day 4 — until this route shipped, the "send" button on the
 * org newsletters page just flipped status='draft' → 'sent' without
 * actually emailing anyone. Org-роль был fundamentally broken: writing
 * a newsletter draft didn't reach the audience.
 *
 * This handler:
 *   1. Verifies caller is a logged-in user with role='organization' AND
 *      owns the newsletter (newsletter.org_id matches the user's org).
 *   2. Loads org members whose `member_role` ∈ newsletter.target_roles
 *      AND status='active'. Resolves their email from `users.email`.
 *   3. Sends each email via Resend (sequential, with per-email error
 *      capture so one bad address doesn't fail the whole batch).
 *   4. Records every send attempt in `newsletter_deliveries` (status
 *      'sent' / 'failed' + error_message). This feeds the existing
 *      stats page (`/org/newsletters/[id]/stats`).
 *   5. UPDATEs the newsletter row: status='sent', sent_at=now(),
 *      recipients_count=successful_sends.
 *
 * Idempotency: if newsletter.status is already 'sent', returns 409 to
 * prevent accidental re-send. If RESEND_API_KEY is missing returns 503.
 *
 * Uses createAdminClient() for the actual member fetch + delivery
 * insert + newsletter update — RLS would otherwise hide other users'
 * email addresses from the org admin. Caller authorization is enforced
 * BEFORE switching to admin client.
 */

const FROM = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'

interface MemberWithEmail {
  user_id: string
  member_role: string
  email: string | null
  name: string | null
}

function buildHtml(opts: { subject: string; bodyHtml: string; orgName: string | null }): string {
  // Wraps the doctor-authored body_html with subject header + footer.
  // Kept inline (no shared template) because newsletters are
  // free-form HTML — no fixed shape to template against.
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${escape(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="background:white;border-radius:16px;border:1px solid #E2E8F0;padding:32px;">
      <div style="border-bottom:1px solid #E2E8F0;padding-bottom:20px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#9333EA;">
          ${opts.orgName ? escape(opts.orgName) : 'Sporteo'}
        </div>
        <h1 style="margin:8px 0 0;font-size:22px;color:#0F172A;">${escape(opts.subject)}</h1>
      </div>
      <div style="color:#334155;line-height:1.6;font-size:15px;">${opts.bodyHtml}</div>
    </div>
    <div style="margin-top:16px;text-align:center;font-size:11px;color:#94A3B8;">
      Sporteo · Платформа спортивного клуба<br/>
      <a href="https://proform-delta.vercel.app" style="color:#9333EA;text-decoration:none;">proform-delta.vercel.app</a>
    </div>
  </div>
</body></html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[ch]);
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const newsletterId = params.id

  // ── Auth: caller must be a logged-in organization role ────────────────
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: meRow } = await sb
    .from('users')
    .select('id, role')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as { id: string; role: string | null } | null
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  if (me.role !== 'organization' && me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  // ── Resend availability ───────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'EMAIL_NOT_CONFIGURED' }, { status: 503 })
  }
  const resend = new Resend(apiKey)

  // ── Load newsletter (RLS prevents cross-org reads on the user client) ─
  const { data: nlRow } = await sb
    .from('newsletters')
    .select('id, org_id, subject, body_html, target_roles, status')
    .eq('id', newsletterId)
    .maybeSingle()
  type NewsletterCols = {
    id: string; org_id: string; subject: string;
    body_html: string; target_roles: string[] | null; status: string
  }
  const nl = nlRow as NewsletterCols | null
  if (!nl) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  // ── Ownership: admin role bypasses; аккаунт организации должен быть
  // активным участником newsletter.org_id с управляющей ролью.
  //
  // P1: раньше требовался строго member_role='coach'. Но владельцу клуба
  // при создании организации проставляется 'org_owner' (см. миграцию 088),
  // поэтому собственную рассылку он отправить не мог — получал 403 на своей
  // же организации. Принимаем все управляющие роли клуба.
  if (me.role === 'organization') {
    const { data: memRow } = await sb
      .from('org_members')
      .select('id')
      .eq('org_id', nl.org_id)
      .eq('user_id', me.id)
      .eq('status', 'active')
      .in('member_role', ['org_owner', 'org_admin', 'coach'])
      .maybeSingle()
    if (!memRow) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // ── Idempotency ───────────────────────────────────────────────────────
  if (nl.status === 'sent') {
    return NextResponse.json({ ok: false, error: 'ALREADY_SENT' }, { status: 409 })
  }

  // ── Switch to admin client for cross-user reads ───────────────────────
  const admin = createAdminClient()

  // Fetch org meta for email subject branding
  const { data: orgMeta } = await admin
    .from('organizations')
    .select('org_name')
    .eq('id', nl.org_id)
    .maybeSingle()
  const orgName = ((orgMeta as { org_name: string | null } | null)?.org_name) ?? null

  // Load active members with target roles
  const targetRoles = (nl.target_roles ?? []).filter((r): r is string => typeof r === 'string')
  if (targetRoles.length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_TARGET_ROLES' }, { status: 400 })
  }

  const { data: memRaw } = await admin
    .from('org_members')
    .select('user_id, member_role')
    .eq('org_id', nl.org_id)
    .eq('status', 'active')
    .in('member_role', targetRoles)
  const members = (memRaw ?? []) as Array<{ user_id: string; member_role: string }>
  if (members.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { sent: 0, failed: 0, total_recipients: 0, message: 'Нет активных получателей' },
    })
  }

  // Resolve emails
  const userIds = members.map(m => m.user_id)
  const { data: usersRaw } = await admin
    .from('users')
    .select('id, email, name')
    .in('id', userIds)
  const userById = new Map(
    ((usersRaw ?? []) as Array<{ id: string; email: string | null; name: string | null }>)
      .map(u => [u.id, u]),
  )
  const recipients: MemberWithEmail[] = members.map(m => {
    const u = userById.get(m.user_id)
    return {
      user_id: m.user_id,
      member_role: m.member_role,
      email: u?.email ?? null,
      name:  u?.name  ?? null,
    }
  })

  const html = buildHtml({ subject: nl.subject, bodyHtml: nl.body_html, orgName })

  // ── Batch send ─────────────────────────────────────────────────────────
  let sent = 0
  let failed = 0
  const deliveryRows: Array<{
    newsletter_id: string; user_id: string; email: string;
    status: string; sent_at: string | null; error_message: string | null;
  }> = []

  for (const r of recipients) {
    if (!r.email) {
      failed++
      deliveryRows.push({
        newsletter_id: newsletterId,
        user_id: r.user_id,
        email: '(no email)',
        status: 'failed',
        sent_at: null,
        error_message: 'NO_EMAIL_ON_FILE',
      })
      continue
    }
    try {
      await resend.emails.send({ from: FROM, to: r.email, subject: nl.subject, html })
      sent++
      deliveryRows.push({
        newsletter_id: newsletterId,
        user_id: r.user_id,
        email: r.email,
        status: 'delivered',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
    } catch (e) {
      failed++
      deliveryRows.push({
        newsletter_id: newsletterId,
        user_id: r.user_id,
        email: r.email,
        status: 'failed',
        sent_at: null,
        error_message: e instanceof Error ? e.message.slice(0, 500) : 'send_error',
      })
    }
  }

  // ── Persist delivery rows + finalize newsletter ───────────────────────
  if (deliveryRows.length > 0) {
    await admin.from('newsletter_deliveries').insert(deliveryRows)
  }
  await admin
    .from('newsletters')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipients_count: sent,
    })
    .eq('id', newsletterId)

  return NextResponse.json({
    ok: true,
    data: {
      sent,
      failed,
      total_recipients: recipients.length,
      message: failed > 0
        ? `Отправлено ${sent} из ${recipients.length} (${failed} сбоев)`
        : `Отправлено ${sent} получателям`,
    },
  })
}
