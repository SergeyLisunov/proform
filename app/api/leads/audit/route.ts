/**
 * POST /api/leads/audit — W16 Day 79; Resend wired W16 Day 80.
 *
 * Public endpoint без auth — landing soft-conversion path. Lead capture
 * form (`<LeadCaptureForm />` в `HeroAuditModal` + dedicated section) sends:
 *
 *   { name, email, telegram?, organization, orgType, coachCount,
 *     athleteCount, painPoints[], consent }
 *
 * Flow:
 *   1. Validate payload (mirror client validation, defense in depth)
 *   2. IP rate-limit 5/hour
 *   3. Insert to `tool_leads` source='landing-audit-form' (W4 schema reused)
 *   4. Send 2 emails in parallel via Resend:
 *      - User confirmation ("получили, готовим, придёт в 24h")
 *      - Admin notification (full payload + quick-action buttons)
 *   5. Email failures DO NOT fail the request — lead is already captured.
 *      Errors logged для manual reconciliation.
 *
 * Why split user + admin emails: user expects immediate ack (UX). Admin
 * email triggers actual audit prep workflow (manual до Day 82 admin viewer).
 */
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAdminNotificationEmail, buildUserConfirmationEmail } from '@/lib/email/audit-templates'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORG_TYPES = new Set(['fitness', 'sport-school', 'academy', 'medical', 'team', 'other'])
const COACH_COUNTS = new Set(['1-3', '4-10', '10-25', '25+'])
const ATHLETE_COUNTS = new Set(['<20', '20-50', '50-200', '200+'])

const MAX_PAYLOAD_BYTES = 8_000
const MAX_PER_IP_PER_HOUR = 5

const FROM = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'
const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATIONS_EMAIL ?? 'support@proform-delta.vercel.app'

interface AuditPayload {
  name?:         string
  email?:        string
  telegram?:     string | null
  organization?: string
  orgType?:      string
  coachCount?:   string
  athleteCount?: string
  painPoints?:   string[]
  consent?:      boolean
}

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 48)
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(req: Request) {
  let body: AuditPayload
  try {
    body = await req.json() as AuditPayload
  } catch {
    return bad('invalid_json')
  }

  const name         = (body.name ?? '').trim()
  const email        = (body.email ?? '').trim().toLowerCase()
  const telegram     = body.telegram ? String(body.telegram).trim() : null
  const organization = (body.organization ?? '').trim()
  const orgType      = (body.orgType ?? '').trim()
  const coachCount   = (body.coachCount ?? '').trim()
  const athleteCount = (body.athleteCount ?? '').trim()
  const painPoints   = Array.isArray(body.painPoints) ? body.painPoints.slice(0, 10) : []

  // Validation — match client-side rules
  if (!name || name.length < 2 || name.length > 100)         return bad('invalid_name')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   return bad('invalid_email')
  if (telegram && !/^@?[A-Za-z0-9_]{3,32}$/.test(telegram))  return bad('invalid_telegram')
  if (!organization || organization.length < 2 || organization.length > 200) return bad('invalid_organization')
  if (!ORG_TYPES.has(orgType))                                return bad('invalid_org_type')
  if (!COACH_COUNTS.has(coachCount))                          return bad('invalid_coach_count')
  if (!ATHLETE_COUNTS.has(athleteCount))                      return bad('invalid_athlete_count')
  if (body.consent !== true)                                  return bad('consent_required')

  const cleanPainPoints = painPoints
    .map((p) => (typeof p === 'string' ? p.trim().slice(0, 200) : ''))
    .filter((p) => p.length > 0)

  // Payload size guard
  const payloadObj = {
    name,
    telegram,
    organization,
    org_type:      orgType,
    coach_count:   coachCount,
    athlete_count: athleteCount,
    pain_points:   cleanPainPoints,
  }
  if (JSON.stringify(payloadObj).length > MAX_PAYLOAD_BYTES) {
    return bad('payload_too_large', 413)
  }

  // IP rate-limit
  const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              ?? req.headers.get('x-real-ip')
              ?? ''
  const ipHash    = rawIp.length > 0 ? sha(rawIp) : null
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null

  const admin = createAdminClient()

  if (ipHash) {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('tool_leads')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'landing-audit-form')
      .eq('ip_hash', ipHash)
      .gte('created_at', sinceIso)
    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return bad('rate_limited', 429)
    }
  }

  // Insert lead — single source of truth, must succeed before email send.
  const { error: insertError } = await admin
    .from('tool_leads')
    .insert({
      source:      'landing-audit-form',
      email,
      payload:     payloadObj,
      ip_hash:     ipHash,
      user_agent:  userAgent,
      consent_at:  new Date().toISOString(),
    })

  if (insertError) {
    console.error('[/api/leads/audit] insert failed', insertError.message)
    return bad('server_error', 500)
  }

  // W16 Day 80: send user + admin emails in parallel via Resend.
  // Email failures DO NOT fail the request — lead is already saved,
  // admin can manually reconcile from tool_leads table / /admin/leads.
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY)
    const ctx = {
      name,
      email,
      telegram,
      organization,
      orgType,
      coachCount,
      athleteCount,
      painPoints: cleanPainPoints,
    }
    const userEmail = buildUserConfirmationEmail(ctx)
    const adminEmail = buildAdminNotificationEmail(ctx)

    const sends = await Promise.allSettled([
      resend.emails.send({
        from:    FROM,
        to:      email,
        subject: userEmail.subject,
        html:    userEmail.html,
      }),
      resend.emails.send({
        from:    FROM,
        to:      ADMIN_EMAIL,
        subject: adminEmail.subject,
        html:    adminEmail.html,
        replyTo: email,
      }),
    ])

    sends.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const target = idx === 0 ? 'user' : 'admin'
        console.error(`[/api/leads/audit] resend send (${target}) failed`, result.reason)
      }
    })
  } else {
    console.warn('[/api/leads/audit] RESEND_API_KEY not configured — lead saved, no emails sent')
  }

  return NextResponse.json({ ok: true })
}
