/**
 * /api/coach-reviews/[id]/reply — Sprint W11 Day 55 (PR #76).
 *
 * POST — coach updates `coach_response` + `coach_response_at` on a review
 *        they're the subject of, AND triggers an email notification to
 *        the athlete (respecting notification_prefs.coach_reply_email).
 *
 * Server-side execution because:
 *   1. Resend API key must not appear in browser bundle
 *   2. Need to fetch athlete's email + prefs with elevated read context
 *   3. Single source of truth — update + notify wrapped together avoids
 *      "update sent but email skipped due to race" gotchas
 *
 * Empty-trimmed response → NULL fields (delete-by-empty pattern from
 * W10 Day 48). When clearing, no email sent.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isChannelAllowed } from '@/services/notification-prefs-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
const FROM    = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'

function renderCoachReplyEmail(input: {
  athlete_name: string | null
  coach_name:   string | null
  rating:       number
  athlete_comment: string | null
  coach_response: string
  permalink:    string
}): { subject: string; html: string } {
  const coachLabel = input.coach_name ?? 'Тренер'
  const stars = '★'.repeat(input.rating) + '☆'.repeat(5 - input.rating)
  const safeAthleteComment = (input.athlete_comment ?? '').replace(/</g, '&lt;')
  const safeCoachResponse = input.coach_response.replace(/</g, '&lt;')
  const subject = `${coachLabel} ответил на ваш отзыв`
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
    <p style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.18em;margin:0 0 6px">ProForm</p>
    <h1 style="font-size:20px;font-weight:800;margin:0 0 14px">${coachLabel} ответил на ваш отзыв</h1>

    ${input.athlete_comment ? `
    <div style="background:#fafafa;border-left:3px solid #e5e7eb;padding:10px 14px;margin:0 0 14px;border-radius:8px">
      <p style="font-size:11px;font-weight:600;color:#64748b;margin:0 0 4px">Ваш отзыв · <span style="color:#f59e0b">${stars}</span></p>
      <p style="font-size:13px;color:#0f172a;margin:0;white-space:pre-wrap">${safeAthleteComment}</p>
    </div>` : ''}

    <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:12px 14px;margin:0 0 18px;border-radius:8px">
      <p style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Ответ тренера</p>
      <p style="font-size:14px;color:#0f172a;margin:0;line-height:1.5;white-space:pre-wrap">${safeCoachResponse}</p>
    </div>

    <p style="margin:0 0 18px">
      <a href="${input.permalink}" style="display:inline-block;padding:11px 22px;background:#f97316;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть профиль тренера →
      </a>
    </p>

    <p style="font-size:11px;color:#94a3b8;margin:18px 0 0">
      Не хотите получать такие письма? Отключите «Ответы тренера на ваши отзывы» в
      <a href="${APP_URL}/settings/notifications" style="color:#64748b">настройках уведомлений</a>.
    </p>
  </div>
</body></html>`
  return { subject, html }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params
  if (!reviewId || !/^[0-9a-f-]{36}$/i.test(reviewId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id, role').eq('auth_id', authUser.id).single()
  const me = meRow as { id: string; role: string } | null
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (me.role !== 'coach') return NextResponse.json({ error: 'coach_only' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { response?: string }
  const rawResponse = (body.response ?? '').toString()
  const trimmed = rawResponse.trim()
  const isClear = trimmed.length === 0

  // Verify caller owns this review row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviewRow, error: rfErr } = await (supabase as any)
    .from('coach_reviews')
    .select('id, coach_id, athlete_id, rating, comment')
    .eq('id', reviewId)
    .maybeSingle()
  if (rfErr || !reviewRow) {
    return NextResponse.json({ error: 'review_not_found' }, { status: 404 })
  }
  if ((reviewRow as { coach_id: string }).coach_id !== me.id) {
    return NextResponse.json({ error: 'not_your_review' }, { status: 403 })
  }

  // Perform update — coach RLS update policy (W10 Day 48) gates this too,
  // but we already verified ownership; uses authenticated client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase as any)
    .from('coach_reviews')
    .update({
      coach_response:    isClear ? null : trimmed,
      coach_response_at: isClear ? null : new Date().toISOString(),
    })
    .eq('id', reviewId)
  if (updErr) {
    console.warn('[coach-reviews/reply] update failed:', updErr.message)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // No email when clearing the reply.
  if (isClear) {
    return NextResponse.json({ ok: true, email_sent: false }, { status: 200 })
  }

  // Fetch athlete email + prefs + coach name via admin client (bypass RLS
  // for prefs read — athlete user row isn't necessarily readable by coach).
  const admin = createAdminClient()
  const review = reviewRow as { athlete_id: string; coach_id: string; rating: number; comment: string | null }
  const [{ data: athleteRow }, { data: coachRow }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('users')
      .select('id, email, name, notification_prefs')
      .eq('id', review.athlete_id)
      .maybeSingle(),
    admin
      .from('users')
      .select('id, name')
      .eq('id', review.coach_id)
      .maybeSingle(),
  ])
  const athlete = athleteRow as {
    id: string
    email: string | null
    name: string | null
    notification_prefs: Record<string, unknown> | null
  } | null
  const coach = coachRow as { id: string; name: string | null } | null

  let emailSent = false
  let emailSkippedReason: string | null = null
  if (!athlete?.email) {
    emailSkippedReason = 'no_email'
  } else if (!isChannelAllowed(athlete.notification_prefs, 'coach_reply_email')) {
    emailSkippedReason = 'opted_out'
  } else {
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (!RESEND_API_KEY) {
      emailSkippedReason = 'resend_not_configured'
    } else {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(RESEND_API_KEY)
        const { subject, html } = renderCoachReplyEmail({
          athlete_name:    athlete.name,
          coach_name:      coach?.name ?? null,
          rating:          review.rating,
          athlete_comment: review.comment,
          coach_response:  trimmed,
          permalink:       `${APP_URL}/profile/${review.coach_id}#review-${review.athlete_id}`,
        })
        await resend.emails.send({ from: FROM, to: athlete.email, subject, html })
        emailSent = true
      } catch (e) {
        console.warn('[coach-reviews/reply] email send failed:', e instanceof Error ? e.message : e)
        emailSkippedReason = 'send_failed'
      }
    }
  }

  return NextResponse.json({
    ok: true,
    email_sent: emailSent,
    email_skipped_reason: emailSkippedReason,
  }, { status: 200 })
}
