/**
 * POST /api/leads/audit — W16 Day 79 NEW.
 *
 * Public endpoint без auth — landing soft-conversion path. Lead capture
 * form (`<LeadCaptureForm />` в `HeroAuditModal` + dedicated section) sends:
 *
 *   { name, email, telegram?, organization, orgType, coachCount,
 *     athleteCount, painPoints[], consent }
 *
 * Inserts into existing `tool_leads` table с source='landing-audit-form'
 * (reuse W4 Day 27 infrastructure — admin view, rate-limit per IP, schema).
 *
 * Rate-limit: 5 submissions / hour per IP (strict — soft conversion form
 * = higher-trust path than tool calculators which allow 20/hr).
 *
 * Resend email send TBD (Day 80 wire) — Day 79 ships capture-only with
 * honest success UX («ответим в течение 24 часов»). Admin reviews leads
 * via `/admin/leads` (Day 82).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORG_TYPES = new Set(['fitness', 'sport-school', 'academy', 'medical', 'team', 'other'])
const COACH_COUNTS = new Set(['1-3', '4-10', '10-25', '25+'])
const ATHLETE_COUNTS = new Set(['<20', '20-50', '50-200', '200+'])

const MAX_PAYLOAD_BYTES = 8_000
const MAX_PER_IP_PER_HOUR = 5

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

  // Insert lead. Schema: tool_leads(source, email, payload jsonb, ip_hash,
  // user_agent, consent_at). RLS allows insert via service-role client.
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
    // Log on server, return generic error to client
    console.error('[/api/leads/audit] insert failed', insertError.message)
    return bad('server_error', 500)
  }

  // TODO Day 80: send Resend email with audit template + admin notification
  // for now: lead is captured, manual review via /admin/leads (Day 82)

  return NextResponse.json({ ok: true })
}
