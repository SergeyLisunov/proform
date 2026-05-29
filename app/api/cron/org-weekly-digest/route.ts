/**
 * GET /api/cron/org-weekly-digest — Sprint W8 Day 41 (PR #59).
 *
 * Weekly cron (Vercel schedule "0 18 * * 0" — Sunday 18:00 UTC = 21:00 MSK).
 * For each organization, summarises the past 7 days of cross-cutting
 * events (member joins, inquiries, recommendations) and emails the org
 * admin. Skips orgs with zero events — no empty digest noise.
 *
 * Reuses W7 Day 37 org-activity aggregator (admin-client variant
 * added in W8 Day 41) so logic stays consistent with the in-app
 * /org/activity feed.
 *
 * Auth: CRON_SECRET via Bearer header (Vercel auto-adds in scheduled
 * invocations; manual triggers work if secret known).
 *
 * Returns summary { processed, sent, skipped_empty, skipped_pref,
 * skipped_nemail, duration_ms }.
 */
import { NextResponse } from 'next/server'
import { findActivityForOrg } from '@/services/org-activity.service'
import { renderOrgWeeklyDigest } from '@/lib/email/templates'
import { createAdminClient } from '@/lib/supabase/admin'
import { isChannelAllowed, type PrefsBag } from '@/services/notification-prefs-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const FROM = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const WINDOW_DAYS = 7

interface CronResult {
  ok:               true
  processed:        number
  sent:             number
  skipped_empty:    number   // 0 events in window — no digest
  skipped_pref:     number   // opted out via notification_prefs.org_digest_email
  skipped_nemail:   number   // org row has no email
  duration_ms:      number
}

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  // W21 audit fix (#4): fail-closed (was fail-open when CRON_SECRET unset).
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const start = Date.now()

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: 'RESEND_NOT_CONFIGURED' }, { status: 503 })
  }
  let resend: { emails: { send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } }
  try {
    const { Resend } = await import('resend')
    resend = new Resend(RESEND_API_KEY) as unknown as typeof resend
  } catch (e) {
    return NextResponse.json({
      ok: false, error: 'RESEND_LOAD_FAILED',
      details: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }

  // ── Pull all orgs ─────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: orgsRaw } = await admin
    .from('users')
    .select('id, name, email, notification_prefs')
    .eq('role', 'organization')
    .limit(5000)
  const orgs = (orgsRaw ?? []) as Array<{
    id: string; name: string | null; email: string | null
    notification_prefs: PrefsBag
  }>

  let sent = 0
  let skipped_empty  = 0
  let skipped_pref   = 0
  let skipped_nemail = 0

  // Also fetch the org_name from organizations table (canonical brand name)
  const orgIds = orgs.map(o => o.id)
  const orgNameMap = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: orgRows } = await admin
      .from('organizations')
      .select('id, org_name')
      .in('id', orgIds)
    for (const r of (orgRows ?? []) as Array<{ id: string; org_name: string }>) {
      orgNameMap.set(r.id, r.org_name)
    }
  }

  for (const org of orgs) {
    if (!org.email) {
      skipped_nemail++
      continue
    }
    if (!isChannelAllowed(org.notification_prefs, 'org_digest_email')) {
      skipped_pref++
      continue
    }

    // Pull 7-day activity for this org via admin variant
    const events = await findActivityForOrg(org.id, WINDOW_DAYS, 50)
    if (events.length === 0) {
      skipped_empty++
      continue
    }

    // Tally counts per type
    const counts = {
      member_joined:         0,
      inquiry_created:       0,
      inquiry_answered:      0,
      recommendation_issued: 0,
    }
    for (const e of events) counts[e.type as keyof typeof counts]++

    const orgName = orgNameMap.get(org.id) ?? org.name ?? 'Ваша организация'
    const { subject, html } = renderOrgWeeklyDigest({
      org_name: orgName,
      events:   events.map(e => ({
        type:        e.type,
        summary:     e.summary,
        actor_name:  e.actor_name,
        target_name: e.target_name,
        timestamp:   e.timestamp,
        tone:        e.tone,
      })),
      counts,
      activity_url: `${APP_URL}/org/activity?ref=digest`,
    })

    try {
      await resend.emails.send({ from: FROM, to: org.email, subject, html })
      sent++
    } catch (e) {
      console.warn('[org-weekly-digest] send failed for', org.id, e instanceof Error ? e.message : e)
    }
  }

  const result: CronResult = {
    ok: true,
    processed:      orgs.length,
    sent,
    skipped_empty,
    skipped_pref,
    skipped_nemail,
    duration_ms:    Date.now() - start,
  }
  return NextResponse.json(result)
}
