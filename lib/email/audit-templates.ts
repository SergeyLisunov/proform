/**
 * lib/email/audit-templates.ts — W16 Day 80.
 *
 * HTML email templates для landing «Получить аудит» soft-conversion flow.
 * Two emails sent on successful POST /api/leads/audit:
 *
 *   1. User confirmation — sent to lead email. Says «получили вашу заявку,
 *      готовим аудит, придёт в течение 24h». Includes link к demo.
 *
 *   2. Admin notification — sent to ADMIN_NOTIFICATIONS_EMAIL (env, fallback
 *      support@). Full form payload, quick-action links. Triggers actual
 *      audit prep (manual или future automation).
 *
 * Style: inline-only (most email clients ignore <style> tags). Pattern
 * mirrors `lib/email/templates.ts` (W4 Day 27 — drip cadence).
 *
 * Why not a Supabase-trigger or queue: lead capture latency-sensitive
 * (user expects immediate confirmation). Inline send via Resend keeps
 * the request boundary clean — no separate worker.
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
  'https://proform-delta.vercel.app'

const ORG_TYPE_LABELS: Record<string, string> = {
  fitness:        'Фитнес-клуб / сеть',
  'sport-school': 'Спортивная школа',
  academy:        'Академия / performance-центр',
  medical:        'Медицинско-спортивный центр',
  team:           'Команда / секция',
  other:          'Другое',
}

interface AuditEmailContext {
  name:         string
  email:        string
  telegram:     string | null
  organization: string
  orgType:      string
  coachCount:   string
  athleteCount: string
  painPoints:   string[]
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrap(title: string, preheader: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
  <head><meta charset="utf-8"/><title>${escape(title)}</title></head>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A">
    <span style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escape(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06)">
          <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F1F5F9">
            <table role="presentation" width="100%"><tr>
              <td style="font-size:12px;font-weight:700;color:#D44A02;letter-spacing:2px;text-transform:uppercase">Sporteo</td>
              <td align="right" style="font-size:11px;color:#94A3B8">Аудит клуба</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:24px 32px 28px 32px">
            ${inner}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #F1F5F9;background:#F8FAFC;font-size:11px;color:#64748B;text-align:center">
            <a href="${APP_URL}" style="color:#D44A02;text-decoration:none;font-weight:600">Открыть Sporteo</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/legal/privacy" style="color:#64748B;text-decoration:underline">Конфиденциальность</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

/**
 * User-facing confirmation. Sets expectation «24 часов на email».
 * Adds demo link as «можете попробовать пока ждёте».
 */
export function buildUserConfirmationEmail(ctx: AuditEmailContext): {
  subject: string
  html:    string
} {
  const subject = `Заявка на аудит ${ctx.organization} получена — готовим`
  const preheader = `Привет, ${ctx.name}! Готовим персональный аудит вашего клуба. Пришлём в течение 24 часов.`

  const inner = `
    <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0F172A;font-weight:700">
      Спасибо, ${escape(ctx.name)} 👋
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#334155">
      Получили вашу заявку на аудит клуба
      <strong style="color:#0F172A">${escape(ctx.organization)}</strong>.
      Подготовим персональный health-score, top-3 области риска и план на 30 дней —
      пришлём на этот email в течение <strong style="color:#0F172A">24 часов</strong>
      (в рабочие дни обычно за 2-4 часа).
    </p>

    <div style="margin:20px 0;padding:14px 16px;background:#FEF0E7;border:1px solid #FBC1A0;border-radius:12px">
      <div style="font-size:11px;font-weight:700;color:#B03D04;letter-spacing:1px;text-transform:uppercase">Что в аудите</div>
      <ul style="margin:8px 0 0 0;padding:0 0 0 18px;font-size:14px;line-height:1.6;color:#334155">
        <li><strong style="color:#0F172A">Health-score клуба</strong> — общая оценка управляемости 0-100</li>
        <li><strong style="color:#0F172A">Top-3 области риска</strong> — где теряете контроль прямо сейчас</li>
        <li><strong style="color:#0F172A">План на 30 дней</strong> — конкретные шаги для улучшения</li>
        <li><strong style="color:#0F172A">Без обязательств</strong> — не нужно регистрироваться</li>
      </ul>
    </div>

    <p style="margin:20px 0 8px 0;font-size:14px;color:#334155">
      Пока ждёте аудит — можете посмотреть платформу в demo-режиме.
      Без банковской карты, без регистрации:
    </p>
    <p style="margin:0 0 4px 0">
      <a href="${APP_URL}/auth/login?demo=coach"
         style="display:inline-block;padding:10px 18px;background:#F35703;color:#fff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px">
        Открыть демо как тренер →
      </a>
    </p>

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748B;line-height:1.5">
      Не получили аудит за 24 часа? Напишите на
      <a href="mailto:support@proform-delta.vercel.app" style="color:#D44A02">support@proform-delta.vercel.app</a>
      ${ctx.telegram ? `или в Telegram — мы связались бы с вами по ${escape(ctx.telegram)}` : ''}.
    </p>
  `

  return { subject, html: wrap(subject, preheader, inner) }
}

/**
 * Admin notification — internal. Full form data + quick actions для
 * следующего шага (manual reply OR auto-audit generation в будущем).
 */
export function buildAdminNotificationEmail(ctx: AuditEmailContext): {
  subject: string
  html:    string
} {
  const orgTypeLabel = ORG_TYPE_LABELS[ctx.orgType] ?? ctx.orgType
  const subject = `🔔 New audit request: ${ctx.organization} (${orgTypeLabel}, ${ctx.coachCount} coaches)`
  const preheader = `${ctx.name} from ${ctx.organization} requested an audit. ${ctx.coachCount} coaches, ${ctx.athleteCount} athletes.`

  const painList = ctx.painPoints.length > 0
    ? ctx.painPoints.map((p) => `<li>${escape(p)}</li>`).join('')
    : '<li style="color:#94A3B8;font-style:italic">не указано</li>'

  const inner = `
    <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;color:#0F172A;font-weight:700">
      🔔 Новая заявка на аудит клуба
    </h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:8px 0;color:#64748B;width:35%">Имя</td>
        <td style="padding:8px 0;color:#0F172A;font-weight:600">${escape(ctx.name)}</td>
      </tr>
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Email</td>
        <td style="padding:8px 0;color:#0F172A"><a href="mailto:${escape(ctx.email)}" style="color:#D44A02;text-decoration:none">${escape(ctx.email)}</a></td>
      </tr>
      ${ctx.telegram ? `
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Telegram</td>
        <td style="padding:8px 0;color:#0F172A;font-family:monospace">${escape(ctx.telegram)}</td>
      </tr>` : ''}
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Организация</td>
        <td style="padding:8px 0;color:#0F172A;font-weight:600">${escape(ctx.organization)}</td>
      </tr>
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Тип</td>
        <td style="padding:8px 0;color:#0F172A">${escape(orgTypeLabel)}</td>
      </tr>
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Тренеров</td>
        <td style="padding:8px 0;color:#0F172A;font-weight:600">${escape(ctx.coachCount)}</td>
      </tr>
      <tr style="border-top:1px solid #F1F5F9">
        <td style="padding:8px 0;color:#64748B">Атлетов</td>
        <td style="padding:8px 0;color:#0F172A;font-weight:600">${escape(ctx.athleteCount)}</td>
      </tr>
    </table>

    <div style="margin:0 0 18px 0;padding:12px 14px;background:#F1F5F9;border-radius:10px">
      <div style="font-size:11px;font-weight:700;color:#475569;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Pain points</div>
      <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#334155;line-height:1.5">
        ${painList}
      </ul>
    </div>

    <p style="margin:16px 0 8px 0;font-size:13px;color:#334155">
      Действия:
    </p>
    <p style="margin:0">
      <a href="mailto:${escape(ctx.email)}?subject=Sporteo%20—%20аудит%20клуба%20${encodeURIComponent(ctx.organization)}"
         style="display:inline-block;margin-right:8px;padding:8px 14px;background:#0F172A;color:#fff;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px">
        Ответить
      </a>
      <a href="${APP_URL}/admin"
         style="display:inline-block;padding:8px 14px;background:#F1F5F9;color:#0F172A;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px">
        Открыть admin
      </a>
    </p>
  `

  return { subject, html: wrap(subject, preheader, inner) }
}
