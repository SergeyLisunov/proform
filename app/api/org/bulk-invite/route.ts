/**
 * POST /api/org/bulk-invite — Sprint W3 Day 16 (PR #31).
 *
 * Org admin uploads CSV → batch creates email_invites + sends Resend
 * invitation emails.
 *
 * This is a "batch" version of POST /api/invite. We deliberately reuse the
 * same email_invites table + connection_type='org_athlete'/'org_coach' so
 * the claim flow on /invite/:token already handles the rest. No new DB
 * surface needed.
 *
 * Request body (JSON):
 *   {
 *     csv: string,              // raw CSV text (email[,name] rows)
 *     member_role: 'athlete' | 'coach',
 *     message?: string,         // optional, included in every email
 *   }
 *
 * Response 200:
 *   {
 *     ok: true,
 *     summary: {
 *       parsed: number,         // distinct rows after dedup
 *       invited: number,        // new invites created (or reused pending)
 *       skipped_member: number, // user already in org_members (active|pending)
 *       skipped_self: number,   // tried to invite themselves
 *       invalid_email: number,  // failed regex
 *       email_sent: number,     // Resend delivery success
 *       failed: number,         // any other error during insert/send
 *     },
 *     details: Array<RowResult>
 *   }
 *
 * Limits:
 *   - Max 500 distinct rows per request (sanity)
 *   - Max CSV body 256 KB
 *
 * Auth:
 *   - Caller must have users.role === 'organization' (their user.id is the
 *     org_id, mirroring /app/org/members/page.tsx line 204 convention).
 *   - admin role is intentionally rejected here — admins should target a
 *     specific org explicitly via a future endpoint, not bulk-invite to
 *     "their" org (admins don't own one).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderInviteEmail } from '@/lib/email/templates'
import { parseCsv, isValidEmail } from '@/lib/csv/parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM     = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'
const MAX_ROWS = 500
const MAX_BODY = 256 * 1024
const SEND_BATCH_SIZE = 10  // parallel Resend calls per batch

const BodySchema = z.object({
  csv: z.string().min(1).max(MAX_BODY),
  member_role: z.enum(['athlete', 'coach']),
  message: z.string().max(2000).optional(),
})

type RowStatus =
  | 'invited'
  | 'skipped_member'
  | 'skipped_self'
  | 'invalid_email'
  | 'failed'

interface RowResult {
  email: string
  line: number
  status: RowStatus
  reason?: string
}

interface MeRow {
  id: string
  role: string
  name: string | null
  nickname: string | null
  email: string | null
}

export async function POST(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: meRaw } = await supabase
    .from('users')
    .select('id, role, name, nickname, email')
    .eq('auth_id', authUser.id)
    .single()
  const me = meRaw as MeRow | null
  if (!me) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  if (me.role !== 'organization') {
    return NextResponse.json({ error: 'forbidden_role' }, { status: 403 })
  }

  // ── Body ─────────────────────────────────────────────────────────────
  const json = await req.json().catch(() => null)
  const parsedBody = BodySchema.safeParse(json)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsedBody.error.format() },
      { status: 400 },
    )
  }
  const { csv, member_role, message } = parsedBody.data
  const connection_type = member_role === 'athlete' ? 'org_athlete' : 'org_coach'

  // ── CSV ──────────────────────────────────────────────────────────────
  const csvResult = parseCsv(csv)
  if (csvResult.rows.length === 0) {
    return NextResponse.json(
      { error: 'no_valid_rows', total_lines: csvResult.total_lines },
      { status: 400 },
    )
  }
  if (csvResult.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: 'too_many_rows', max: MAX_ROWS, got: csvResult.rows.length },
      { status: 400 },
    )
  }

  // Dedup within the CSV itself (case-insensitive on email)
  const uniqueRows = new Map<string, { email: string; name?: string; raw_line: number }>()
  for (const r of csvResult.rows) {
    if (!uniqueRows.has(r.email)) uniqueRows.set(r.email, r)
  }
  const rowsList = [...uniqueRows.values()]

  // ── Pre-fetch existing member emails (avoid re-inviting) ─────────────
  const admin = createAdminClient()
  const orgId = me.id
  const myEmail = (me.email ?? '').trim().toLowerCase()

  const { data: existingMembers } = await admin
    .from('org_members')
    .select('user_id, status, users!inner(email)')
    .eq('org_id', orgId)
    .in('status', ['active', 'pending'])
  const existingEmails = new Set<string>()
  for (const row of (existingMembers ?? []) as Array<{ users: { email: string | null } | { email: string | null }[] }>) {
    // Supabase returns embedded relation as object (single FK) or array — handle both
    const u = Array.isArray(row.users) ? row.users[0] : row.users
    const e = u?.email
    if (e) existingEmails.add(String(e).toLowerCase())
  }

  // ── Resend setup (lazy import — match /api/invite pattern) ───────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  let resend: { emails: { send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } } | null = null
  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      resend = new Resend(RESEND_API_KEY)
    } catch (e) {
      console.warn('[bulk-invite] resend module unavailable:', e instanceof Error ? e.message : e)
    }
  }

  const inviterDisplayName =
    (me.name ?? me.nickname ?? me.email ?? 'Организация').toString().trim() || 'Организация'

  // ── Per-row processor ────────────────────────────────────────────────
  async function processRow(
    r: { email: string; name?: string; raw_line: number },
  ): Promise<{ result: RowResult; email_sent: boolean }> {
    const email = r.email
    const line  = r.raw_line

    if (!isValidEmail(email)) {
      return { result: { email, line, status: 'invalid_email' }, email_sent: false }
    }
    if (myEmail && myEmail === email) {
      return { result: { email, line, status: 'skipped_self' }, email_sent: false }
    }
    if (existingEmails.has(email)) {
      return {
        result: { email, line, status: 'skipped_member', reason: 'already_in_org' },
        email_sent: false,
      }
    }

    // Reuse pending invite if one already exists (mirror /api/invite)
    let token: string
    let expiresAt: string
    try {
      const { data: existing } = await admin
        .from('email_invites')
        .select('token, expires_at')
        .eq('inviter_id', me!.id)
        .eq('email', email)
        .eq('connection_type', connection_type)
        .eq('status', 'pending')
        .maybeSingle()

      if (existing) {
        token     = (existing as { token: string; expires_at: string }).token
        expiresAt = (existing as { token: string; expires_at: string }).expires_at
      } else {
        const { data: created, error } = await admin
          .from('email_invites')
          .insert({
            inviter_id:      me!.id,
            email,
            connection_type,
            message:         message ?? null,
          })
          .select('token, expires_at')
          .single()
        if (error || !created) {
          return {
            result: { email, line, status: 'failed', reason: error?.message ?? 'insert_failed' },
            email_sent: false,
          }
        }
        token     = (created as { token: string; expires_at: string }).token
        expiresAt = (created as { token: string; expires_at: string }).expires_at
      }
    } catch (e) {
      return {
        result: { email, line, status: 'failed', reason: e instanceof Error ? e.message : String(e) },
        email_sent: false,
      }
    }

    // Send email — silent-fail (invite token persists regardless)
    let email_sent = false
    if (resend) {
      try {
        const { subject, html } = renderInviteEmail({
          inviter_name:    inviterDisplayName,
          connection_type,
          message:         message ?? null,
          claim_url:       `${APP_URL}/invite/${token}`,
          expires_at:      expiresAt,
        })
        await resend.emails.send({ from: FROM, to: email, subject, html })
        email_sent = true
      } catch (e) {
        console.warn(
          '[bulk-invite] email send failed:',
          email,
          e instanceof Error ? e.message : e,
        )
      }
    }

    return { result: { email, line, status: 'invited' }, email_sent }
  }

  // ── Process in parallel batches ──────────────────────────────────────
  const results: RowResult[] = []
  let emailSentCount = 0

  for (let i = 0; i < rowsList.length; i += SEND_BATCH_SIZE) {
    const slice = rowsList.slice(i, i + SEND_BATCH_SIZE)
    const settled = await Promise.allSettled(slice.map(r => processRow(r)))
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j]
      if (s.status === 'fulfilled') {
        results.push(s.value.result)
        if (s.value.email_sent) emailSentCount++
      } else {
        // Defensive: processRow swallows errors into RowResult, but if it
        // throws unexpectedly, surface it as 'failed' rather than crashing.
        const r = slice[j]
        results.push({
          email:  r.email,
          line:   r.raw_line,
          status: 'failed',
          reason: s.reason instanceof Error ? s.reason.message : String(s.reason),
        })
      }
    }
  }

  // ── Roll up summary ──────────────────────────────────────────────────
  const summary = {
    parsed:         rowsList.length,
    invited:        results.filter(r => r.status === 'invited').length,
    skipped_member: results.filter(r => r.status === 'skipped_member').length,
    skipped_self:   results.filter(r => r.status === 'skipped_self').length,
    invalid_email:  results.filter(r => r.status === 'invalid_email').length,
    failed:         results.filter(r => r.status === 'failed').length,
    email_sent:     emailSentCount,
  }

  return NextResponse.json({ ok: true, summary, details: results })
}
