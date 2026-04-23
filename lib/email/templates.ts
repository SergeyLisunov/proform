/**
 * Minimal HTML email templates for ProForm digests.
 * Inline styles only (most email clients ignore <style> tags).
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

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
              <td style="font-size:12px;font-weight:700;color:#EA580C;letter-spacing:2px;text-transform:uppercase">ProForm</td>
              <td align="right" style="font-size:11px;color:#94A3B8">${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:24px 32px 28px 32px">
            ${inner}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #F1F5F9;background:#F8FAFC;font-size:11px;color:#64748B;text-align:center">
            <a href="${BASE_URL}" style="color:#EA580C;text-decoration:none;font-weight:600">Открыть ProForm</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/settings?tab=notifications" style="color:#64748B;text-decoration:underline">Настройки уведомлений</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

export interface AthleteDailyEvent {
  kind: 'coach_session' | 'group_session' | 'checkup'
  title: string
  time: string | null   // "14:00" or null
  location: string | null
  note: string | null
}

export function renderAthleteDailyDigest(params: {
  name: string
  events: AthleteDailyEvent[]
}): { subject: string; html: string } {
  const { name, events } = params
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const subject = events.length === 0
    ? 'ProForm: сегодня свободный день'
    : `ProForm: ${events.length} ${events.length === 1 ? 'событие' : events.length < 5 ? 'события' : 'событий'} сегодня`

  const rows = events.map(e => {
    const color =
      e.kind === 'coach_session' ? '#EA580C' :
      e.kind === 'group_session' ? '#7C3AED' : '#DC2626'
    const label =
      e.kind === 'coach_session' ? 'Тренировка' :
      e.kind === 'group_session' ? 'Команда' : 'Медосмотр'
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #F1F5F9">
      <table role="presentation" width="100%"><tr>
        <td width="4" style="background:${color};border-radius:2px"></td>
        <td style="padding-left:14px">
          <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px">${label}</div>
          <div style="font-size:15px;font-weight:600;color:#0F172A;margin-top:2px">${escape(e.title)}</div>
          <div style="font-size:12px;color:#64748B;margin-top:4px">
            ${e.time ? `🕐 ${escape(e.time)}` : '⏱ время не задано'}
            ${e.location ? ` · 📍 ${escape(e.location)}` : ''}
          </div>
          ${e.note ? `<div style="font-size:12px;color:#334155;margin-top:6px;font-style:italic">${escape(e.note)}</div>` : ''}
        </td>
      </tr></table>
    </td></tr>`
  }).join('')

  const inner = events.length === 0 ? `
    <h1 style="margin:0 0 8px 0;font-size:24px;color:#0F172A">Свободный день, ${escape(name)}!</h1>
    <p style="margin:0;color:#64748B;font-size:14px;line-height:1.5">На сегодня ничего не запланировано. Отличный момент для восстановления или собственной тренировки.</p>
    <div style="margin-top:20px"><a href="${BASE_URL}/calendar" style="display:inline-block;padding:10px 20px;background:#F97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть календарь</a></div>
  ` : `
    <h1 style="margin:0 0 4px 0;font-size:22px;color:#0F172A">Привет, ${escape(name)}!</h1>
    <p style="margin:0 0 18px 0;color:#64748B;font-size:13px;text-transform:capitalize">${escape(dateStr)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="margin-top:20px"><a href="${BASE_URL}/calendar" style="display:inline-block;padding:10px 20px;background:#F97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть календарь →</a></div>
  `
  return { subject, html: wrap(subject, `${events.length} событий сегодня`, inner) }
}

export interface CoachWeeklyAthleteStat {
  name: string
  missed_sessions: number
  expiring_passes: number
  last_metric_date: string | null
  avg_recovery: number | null
}

export function renderCoachWeeklyDigest(params: {
  name: string
  athletes_count: number
  stats: CoachWeeklyAthleteStat[]
}): { subject: string; html: string } {
  const { name, athletes_count, stats } = params
  const attention = stats.filter(s => s.missed_sessions > 0 || s.expiring_passes > 0)
  const subject = attention.length > 0
    ? `ProForm: ${attention.length} ${attention.length === 1 ? 'атлет требует' : 'атлетов требуют'} внимания`
    : 'ProForm: еженедельная сводка'

  const rows = attention.map(s => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #F1F5F9">
      <div style="font-size:14px;font-weight:600;color:#0F172A">${escape(s.name)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px">
        ${s.missed_sessions > 0 ? `<span style="color:#DC2626">⚠ ${s.missed_sessions} пропуск${s.missed_sessions === 1 ? '' : 'ов'}</span>` : ''}
        ${s.missed_sessions > 0 && s.expiring_passes > 0 ? ' · ' : ''}
        ${s.expiring_passes > 0 ? `<span style="color:#F97316">⏱ ${s.expiring_passes} абонемент${s.expiring_passes === 1 ? '' : 'а'} истекает</span>` : ''}
        ${s.avg_recovery !== null ? ` · восстановление ${s.avg_recovery}%` : ''}
      </div>
    </td></tr>
  `).join('')

  const inner = `
    <h1 style="margin:0 0 6px 0;font-size:22px;color:#0F172A">Сводка за неделю, ${escape(name)}</h1>
    <p style="margin:0 0 18px 0;color:#64748B;font-size:13px">Всего атлетов под наблюдением: <strong>${athletes_count}</strong></p>
    ${attention.length > 0 ? `
      <div style="padding:14px 16px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Требуют внимания</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </div>
    ` : `
      <div style="padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;color:#166534;font-size:14px">
        ✅ Всё идёт по плану — никто не требует срочного внимания.
      </div>
    `}
    <div style="margin-top:20px"><a href="${BASE_URL}/athletes" style="display:inline-block;padding:10px 20px;background:#F97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть &laquo;Мои атлеты&raquo; →</a></div>
  `
  return { subject, html: wrap(subject, `${attention.length} атлетов требуют внимания`, inner) }
}
