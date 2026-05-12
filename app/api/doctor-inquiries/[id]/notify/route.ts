/**
 * POST /api/doctor-inquiries/[id]/notify — Sprint W6 Day 28.
 *
 * Sends an email to the doctor when a coach creates an inquiry.
 *
 *   - If inquiry.doctor_id is set: email that doctor only.
 *   - If inquiry.doctor_id is null (open queue): email up to 20
 *     active doctors (role='doctor') so somebody picks it up.
 *
 * Auth: caller must be the coach who owns the inquiry (RLS-equivalent
 * check enforced here against doctor_inquiries.coach_id = me).
 *
 * Idempotency: there is no de-dupe — repeated calls re-send. Caller
 * should only invoke right after createInquiry.
 *
 * Failures are silent (logged, not raised) so coach UI stays snappy.
 * Returns { ok, sent_count, recipients }.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDoctorInquiryEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM    = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'
const MAX_OPEN_QUEUE_FANOUT = 20

const QUESTION_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  general:         { label: 'Общий вопрос',          emoji: '💬' },
  load_clearance:  { label: 'Допуск к нагрузке',     emoji: '✅' },
  injury_review:   { label: 'Оценка травмы',         emoji: '🩹' },
  return_to_play:  { label: 'Return to play',        emoji: '🏃' },
  red_flag:        { label: 'Срочно: красные флаги', emoji: '🚨' },
}

const URGENCY_LABELS: Record<'routine' | 'urgent' | 'red_flag', string> = {
  routine:  'Routine (7 дн)',
  urgent:   'Urgent (72 ч)',
  red_flag: 'Red Flag (24 ч)',
}

interface NamedUser { id: string; name: string | null; email: string | null }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // ── Auth: caller must be inquiry's coach ─────────────────────────────
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { data: meRow } = await sb
    .from('users')
    .select('id, role, name')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as NamedUser & { role: string } | null
  if (!me) {
    return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  }

  // Use admin client from here — we need to fan-out across doctors
  // (RLS would hide non-self user rows for non-admin readers).
  const admin = createAdminClient()
  const { data: inquiryRow, error: inquiryErr } = await admin
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, doctor_id, question, question_type, urgency, expires_at, status')
    .eq('id', id)
    .maybeSingle()
  if (inquiryErr || !inquiryRow) {
    return NextResponse.json({ ok: false, error: 'INQUIRY_NOT_FOUND' }, { status: 404 })
  }
  const inquiry = inquiryRow as {
    id: string; coach_id: string; athlete_id: string; doctor_id: string | null
    question: string; question_type: string; urgency: 'routine' | 'urgent' | 'red_flag'
    expires_at: string; status: string
  }

  if (inquiry.coach_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }
  if (inquiry.status !== 'pending') {
    return NextResponse.json({ ok: false, error: 'NOT_PENDING' }, { status: 409 })
  }

  // ── Resolve recipients ───────────────────────────────────────────────
  let recipients: NamedUser[] = []
  if (inquiry.doctor_id) {
    const { data } = await admin.from('users').select('id, name, email').eq('id', inquiry.doctor_id).maybeSingle()
    if (data) recipients = [data as NamedUser]
  } else {
    const { data } = await admin
      .from('users')
      .select('id, name, email')
      .eq('role', 'doctor')
      .not('email', 'is', null)
      .limit(MAX_OPEN_QUEUE_FANOUT)
    recipients = ((data ?? []) as NamedUser[]).filter(r => !!r.email)
  }
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent_count: 0, recipients: [], note: 'NO_RECIPIENTS' })
  }

  // ── Resolve coach + athlete display names for the email body ─────────
  const { data: peopleData } = await admin
    .from('users')
    .select('id, name')
    .in('id', [inquiry.coach_id, inquiry.athlete_id])
  const namesMap = new Map<string, string>()
  for (const p of (peopleData ?? []) as Array<{ id: string; name: string | null }>) {
    if (p.name) namesMap.set(p.id, p.name)
  }
  const coachName   = namesMap.get(inquiry.coach_id)   ?? 'Тренер'
  const athleteName = namesMap.get(inquiry.athlete_id) ?? 'Атлет'

  const qtMeta = QUESTION_TYPE_LABELS[inquiry.question_type]
    ?? { label: inquiry.question_type, emoji: '📝' }

  // ── Send via Resend (silent-fail per recipient) ──────────────────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({
      ok: true,
      sent_count: 0,
      recipients: recipients.map(r => r.id),
      note: 'RESEND_NOT_CONFIGURED',
    })
  }

  let sent = 0
  const sentIds: string[] = []
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(RESEND_API_KEY)
    for (const r of recipients) {
      if (!r.email) continue
      try {
        const { subject, html } = renderDoctorInquiryEmail({
          doctor_name:   r.name ?? 'Доктор',
          coach_name:    coachName,
          athlete_name:  athleteName,
          question_type: qtMeta.label,
          type_emoji:    qtMeta.emoji,
          urgency:       inquiry.urgency,
          urgency_label: URGENCY_LABELS[inquiry.urgency],
          question:      inquiry.question,
          expires_at:    inquiry.expires_at,
          inquiry_url:   `${APP_URL}/doctor/inquiries?id=${inquiry.id}`,
        })
        await resend.emails.send({ from: FROM, to: r.email, subject, html })
        sent += 1
        sentIds.push(r.id)
      } catch (e) {
        console.warn('[doctor-inquiry.notify] send failed for', r.id, e instanceof Error ? e.message : e)
      }
    }
  } catch (e) {
    console.warn('[doctor-inquiry.notify] Resend init failed:', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true, sent_count: sent, recipients: sentIds })
}
