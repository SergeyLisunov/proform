/**
 * POST /api/doctor-inquiries/[id]/convert-to-recommendation
 * Sprint W6 Day 28.
 *
 * One-click "save as restriction" for the doctor on an answered
 * inquiry. Creates a `recommendations` row tied back to the inquiry
 * via attachments.source_inquiry_id, with sensible defaults the
 * doctor can override:
 *   - category:     'activity_restriction'
 *   - severity:     'moderate'
 *   - valid_until:  +30 days (nullable)
 *   - visibility:   'coach_and_athlete'
 *
 * Auth + rules:
 *   - caller must be the doctor on the inquiry (RLS-equivalent)
 *   - inquiry.status must be 'answered'
 *   - inquiry.response must be non-empty
 *
 * Notifications are dispatched by the trigger in migration 052
 * (recommendations.status='sent' → coach + athlete notifications).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Schema = z.object({
  category: z.enum([
    'load_restriction',
    'activity_restriction',
    'recovery',
    'observation',
    'consultation_request',
    'clearance',
    'nutrition',
    'general',
    'referral',
  ]).default('activity_restriction'),
  severity: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  title: z.string().min(3).max(120).optional(),
})

const QUESTION_TYPE_TITLE: Record<string, string> = {
  general:         'Заключение врача',
  load_clearance:  'Решение по допуску к нагрузке',
  injury_review:   'Заключение по травме',
  return_to_play:  'Заключение по возврату к спорту',
  red_flag:        'Заключение по красным флагам',
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json().catch(() => ({})))
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY', details: (e as Error).message },
      { status: 400 },
    )
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { data: meRow } = await sb
    .from('users')
    .select('id, role')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) {
    return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  }
  if (me.role !== 'doctor') {
    return NextResponse.json({ ok: false, error: 'NOT_A_DOCTOR' }, { status: 403 })
  }

  // ── Load inquiry; RLS lets the doctor read own assigned + open queue ─
  const { data: inquiryRow, error: readErr } = await sb
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, doctor_id, response, status, question_type')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !inquiryRow) {
    return NextResponse.json({ ok: false, error: 'INQUIRY_NOT_FOUND' }, { status: 404 })
  }
  const inquiry = inquiryRow as {
    id: string; coach_id: string; athlete_id: string; doctor_id: string | null
    response: string | null; status: string; question_type: string
  }

  if (inquiry.doctor_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'NOT_INQUIRY_DOCTOR' }, { status: 403 })
  }
  if (inquiry.status !== 'answered' || !inquiry.response || inquiry.response.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'NOT_YET_ANSWERED' }, { status: 409 })
  }

  // ── Compute defaults ─────────────────────────────────────────────────
  const validFrom = new Date().toISOString().slice(0, 10)
  const defaultValidUntil = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })()
  const validUntil = body.valid_until ?? defaultValidUntil

  const responseTrimmed = inquiry.response.trim()
  const bodyText = responseTrimmed.length > 1000
    ? responseTrimmed.slice(0, 997) + '…'
    : responseTrimmed

  const title = body.title?.trim()
    || QUESTION_TYPE_TITLE[inquiry.question_type]
    || 'Заключение врача'

  // ── Insert recommendation; visibility default = coach + athlete ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertErr } = await (sb as any)
    .from('recommendations')
    .insert({
      doctor_id:        me.id,
      athlete_id:       inquiry.athlete_id,
      coach_id:         inquiry.coach_id,
      title,
      body:             bodyText,
      category:         body.category,
      severity:         body.severity,
      visibility_level: 'coach_and_athlete',
      status:           'sent',
      valid_from:       validFrom,
      valid_until:      validUntil,
      attachments:      { source_inquiry_id: inquiry.id, source: 'doctor_inquiry' },
    })
    .select('id, title, category, severity, valid_until, status')
    .single()

  if (insertErr || !created) {
    return NextResponse.json(
      { ok: false, error: 'INSERT_FAILED' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, recommendation: created })
}
