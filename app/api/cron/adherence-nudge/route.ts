/**
 * GET /api/cron/adherence-nudge — Sprint W8 Day 40 (PR #58).
 *
 * Daily cron (Vercel schedule "0 9 * * *" — 09:00 UTC = noon MSK).
 * Sends gentle reminder emails to athletes who:
 *   1. Missed multiple prescribed workouts in past 7 days
 *   2. Have an active pass expiring within 7 days
 *
 * Dedup via workout_nudges table (Migration 070): one nudge per
 * (athlete, type) per 7-day window. Notification prefs (W6 Day 29)
 * are honoured — athletes who opted out of adherence_email are skipped.
 *
 * Auth: CRON_SECRET via Bearer header (Vercel auto-adds in scheduled
 * invocations; manual triggers work if secret known).
 *
 * Returns summary { processed, sent, skipped_dedup, skipped_pref, skipped_nemail, by_type, duration_ms }.
 */
import { NextResponse } from 'next/server'
import {
  findAthletesMissingWorkouts,
  findAthletesWithExpiringPasses,
  wasNudgedRecently,
  recordNudgeSent,
  type NudgeCandidate,
} from '@/services/adherence-nudge.service'
import { createAdminClient } from '@/lib/supabase/admin'
import { isChannelAllowed, type PrefsBag } from '@/services/notification-prefs-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FROM = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

interface CronResult {
  ok:              true
  processed:       number
  sent:            number
  skipped_dedup:   number   // had a recent nudge of same type
  skipped_pref:    number   // opted out via notification_prefs.adherence_email
  skipped_nemail:  number   // no email on file
  by_type:         Record<'missed_workouts' | 'expiring_pass', { sent: number; skipped: number }>
  duration_ms:     number
}

function renderEmail(c: NudgeCandidate): { subject: string; html: string } {
  const greet = c.athlete_name ?? 'Привет'
  const settingsUrl = `${APP_URL}/settings/notifications?ref=email`
  const dashboardUrl = `${APP_URL}/athlete/dashboard?ref=adherence`

  if (c.nudge_type === 'missed_workouts') {
    const missed = (c.context.missed as number) ?? 0
    const prescribed = (c.context.prescribed as number) ?? 0
    const subject = `Возвращаемся к тренировкам? Пропущено ${missed} из ${prescribed}`
    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"/><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06)">
        <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F1F5F9">
          <span style="font-size:12px;font-weight:700;color:#F35703;letter-spacing:2px;text-transform:uppercase">Sporteo</span>
        </td></tr>
        <tr><td style="padding:24px 32px 28px 32px">
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">${escape(greet)}, как тренировки?</h1>
          <p style="margin:0 0 14px 0;color:#475569;font-size:14px;line-height:1.6">
            За последнюю неделю в плане было <strong style="color:#0F172A">${prescribed}</strong> тренировок,
            а отмечено выполнено — <strong style="color:#0F172A">${prescribed - missed}</strong>.
            Это не упрёк — просто хотим помочь вернуться в ритм.
          </p>
          <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:14px 16px;margin:0 0 18px 0">
            <p style="margin:0 0 6px 0;color:#9A3412;font-size:13px;font-weight:700">3 шага чтобы вернуться:</p>
            <ol style="margin:0;padding-left:20px;color:#7C2D12;font-size:13px;line-height:1.6">
              <li>Зайдите в календарь — что планировалось на эту неделю?</li>
              <li>Отметьте 1-2 тренировки на ближайшие дни как «сделано» или «перенесено».</li>
              <li>Если план не реалистичен — напишите тренеру, пересмотрите вместе.</li>
            </ol>
          </div>
          <p style="margin:0 0 12px 0">
            <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#F35703,#D44A02);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Открыть мой dashboard →</a>
          </p>
          <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
            Это автоматическое напоминание. Отправляется максимум раз в 7 дней.
            Отключить — <a href="${settingsUrl}" style="color:#64748B">настройки уведомлений</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    return { subject, html }
  }

  // expiring_pass
  const passTitle = (c.context.pass_title as string) ?? 'Абонемент'
  const daysLeft = (c.context.days_left as number) ?? 0
  const remaining = (c.context.remaining_sessions as number) ?? 0
  const subject = `Абонемент истекает через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дн'}`
  const passesUrl = `${APP_URL}/athlete/passes?ref=adherence`
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"/><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06)">
        <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F1F5F9">
          <span style="font-size:12px;font-weight:700;color:#D97706;letter-spacing:2px;text-transform:uppercase">Sporteo</span>
        </td></tr>
        <tr><td style="padding:24px 32px 28px 32px">
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">${escape(greet)}, абонемент скоро закончится</h1>
          <p style="margin:0 0 14px 0;color:#475569;font-size:14px;line-height:1.6">
            «<strong style="color:#0F172A">${escape(passTitle)}</strong>» истекает через
            <strong style="color:#D97706">${daysLeft} ${daysLeft === 1 ? 'день' : 'дн'}</strong>.
            ${remaining > 0 ? `Осталось <strong>${remaining}</strong> сессий — успейте использовать.` : 'Все сессии использованы — самое время продлить.'}
          </p>
          <p style="margin:0 0 12px 0">
            <a href="${passesUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#D97706,#B45309);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Мои абонементы →</a>
          </p>
          <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
            Это автоматическое напоминание. Отправляется один раз за 7 дней.
            Отключить — <a href="${settingsUrl}" style="color:#64748B">настройки уведомлений</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  // W21 audit fix (#4): fail-closed. Was `if (cronSecret) {...}` — skipped auth
  // entirely when CRON_SECRET unset, letting any anon caller trigger this.
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
    return NextResponse.json({
      ok: false, error: 'RESEND_NOT_CONFIGURED',
    }, { status: 503 })
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

  // ── Pull candidates from both finders ─────────────────────────────────
  const [missed, expiring] = await Promise.all([
    findAthletesMissingWorkouts(),
    findAthletesWithExpiringPasses(),
  ])
  const candidates: NudgeCandidate[] = [...missed, ...expiring]

  // ── Batch-load prefs for all candidate athletes ───────────────────────
  const allAthleteIds = Array.from(new Set(candidates.map(c => c.athlete_id)))
  const prefsByAthleteId = new Map<string, PrefsBag>()
  if (allAthleteIds.length > 0) {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('users')
      .select('id, notification_prefs')
      .in('id', allAthleteIds)
    for (const r of (rows ?? []) as Array<{ id: string; notification_prefs: PrefsBag }>) {
      prefsByAthleteId.set(r.id, r.notification_prefs)
    }
  }

  let sent = 0
  let skipped_dedup = 0
  let skipped_pref  = 0
  let skipped_nemail = 0
  const by_type: CronResult['by_type'] = {
    missed_workouts: { sent: 0, skipped: 0 },
    expiring_pass:   { sent: 0, skipped: 0 },
  }

  for (const c of candidates) {
    if (!c.athlete_email) {
      skipped_nemail++
      by_type[c.nudge_type as 'missed_workouts' | 'expiring_pass'].skipped++
      continue
    }
    if (!isChannelAllowed(prefsByAthleteId.get(c.athlete_id), 'adherence_email')) {
      skipped_pref++
      by_type[c.nudge_type as 'missed_workouts' | 'expiring_pass'].skipped++
      continue
    }
    if (await wasNudgedRecently(c.athlete_id, c.nudge_type)) {
      skipped_dedup++
      by_type[c.nudge_type as 'missed_workouts' | 'expiring_pass'].skipped++
      continue
    }

    const { subject, html } = renderEmail(c)
    try {
      await resend.emails.send({ from: FROM, to: c.athlete_email, subject, html })
      await recordNudgeSent(c.athlete_id, c.nudge_type, c.context)
      sent++
      by_type[c.nudge_type as 'missed_workouts' | 'expiring_pass'].sent++
    } catch (e) {
      console.warn('[adherence-nudge] send failed for', c.athlete_id, e instanceof Error ? e.message : e)
    }
  }

  const result: CronResult = {
    ok: true,
    processed:      candidates.length,
    sent,
    skipped_dedup,
    skipped_pref,
    skipped_nemail,
    by_type,
    duration_ms:    Date.now() - start,
  }
  return NextResponse.json(result)
}
