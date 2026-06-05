/**
 * Minimal HTML email templates for Sporteo digests.
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
              <td style="font-size:12px;font-weight:700;color:#D44A02;letter-spacing:2px;text-transform:uppercase">Sporteo</td>
              <td align="right" style="font-size:11px;color:#94A3B8">${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:24px 32px 28px 32px">
            ${inner}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #F1F5F9;background:#F8FAFC;font-size:11px;color:#64748B;text-align:center">
            <a href="${BASE_URL}" style="color:#D44A02;text-decoration:none;font-weight:600">Открыть Sporteo</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/settings/notifications?ref=email" style="color:#64748B;text-decoration:underline">Настройки уведомлений</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/settings/notifications?ref=email&action=unsubscribe" style="color:#64748B;text-decoration:underline">Отписаться</a>
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
    ? 'Sporteo: сегодня свободный день'
    : `Sporteo: ${events.length} ${events.length === 1 ? 'событие' : events.length < 5 ? 'события' : 'событий'} сегодня`

  const rows = events.map(e => {
    const color =
      e.kind === 'coach_session' ? '#D44A02' :
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
    <div style="margin-top:20px"><a href="${BASE_URL}/calendar" style="display:inline-block;padding:10px 20px;background:#F35703;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть календарь</a></div>
  ` : `
    <h1 style="margin:0 0 4px 0;font-size:22px;color:#0F172A">Привет, ${escape(name)}!</h1>
    <p style="margin:0 0 18px 0;color:#64748B;font-size:13px;text-transform:capitalize">${escape(dateStr)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="margin-top:20px"><a href="${BASE_URL}/calendar" style="display:inline-block;padding:10px 20px;background:#F35703;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть календарь →</a></div>
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
    ? `Sporteo: ${attention.length} ${attention.length === 1 ? 'атлет требует' : 'атлетов требуют'} внимания`
    : 'Sporteo: еженедельная сводка'

  const rows = attention.map(s => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #F1F5F9">
      <div style="font-size:14px;font-weight:600;color:#0F172A">${escape(s.name)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px">
        ${s.missed_sessions > 0 ? `<span style="color:#DC2626">⚠ ${s.missed_sessions} пропуск${s.missed_sessions === 1 ? '' : 'ов'}</span>` : ''}
        ${s.missed_sessions > 0 && s.expiring_passes > 0 ? ' · ' : ''}
        ${s.expiring_passes > 0 ? `<span style="color:#F35703">⏱ ${s.expiring_passes} абонемент${s.expiring_passes === 1 ? '' : 'а'} истекает</span>` : ''}
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
    <div style="margin-top:20px"><a href="${BASE_URL}/athletes" style="display:inline-block;padding:10px 20px;background:#F35703;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Открыть &laquo;Мои атлеты&raquo; →</a></div>
  `
  return { subject, html: wrap(subject, `${attention.length} атлетов требуют внимания`, inner) }
}

// ─── Email invitation ──────────────────────────────────────────────────────

const INVITE_ROLE_LABELS: Record<string, string> = {
  coach_athlete:  'тренера',
  org_coach:      'организации',
  org_athlete:    'организации',
  doctor_athlete: 'врача',
  coach_doctor:   'тренера',
  org_doctor:     'организации',
  admin_doctor:   'администратора',
  parent_link:    'родителя / опекуна',
}

export function renderInviteEmail(input: {
  inviter_name: string
  connection_type: string
  message: string | null
  claim_url: string
  expires_at: string
}): { subject: string; html: string } {
  const roleLabel = INVITE_ROLE_LABELS[input.connection_type] ?? 'пользователя'
  const subject = `${input.inviter_name} приглашает вас в Sporteo`
  const expiresHuman = new Date(input.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const inner = `
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A">Вас приглашают в Sporteo</h1>
    <p style="margin:0 0 16px 0;color:#334155;font-size:14px;line-height:1.55">
      <strong>${escape(input.inviter_name)}</strong> приглашает вас подключиться в качестве ${escape(roleLabel)} на платформе Sporteo —
      тренировки, медицинские осмотры и командные события в одном месте.
    </p>
    ${input.message ? `
      <div style="padding:14px 16px;background:#FEF0E7;border-left:3px solid #F35703;border-radius:8px;margin-bottom:20px;color:#8A300A;font-size:13px;line-height:1.5;white-space:pre-wrap">${escape(input.message)}</div>
    ` : ''}
    <div style="margin:20px 0">
      <a href="${input.claim_url}" style="display:inline-block;padding:14px 28px;background:#F35703;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Принять приглашение →</a>
    </div>
    <p style="margin:12px 0 0 0;color:#64748B;font-size:12px;line-height:1.5">
      Ссылка действует до <strong>${escape(expiresHuman)}</strong>. Если у вас ещё нет аккаунта — вы сможете зарегистрироваться по той же ссылке, и связь установится автоматически.
    </p>
    <p style="margin:12px 0 0 0;color:#94A3B8;font-size:11px;word-break:break-all">
      Или скопируйте ссылку: ${escape(input.claim_url)}
    </p>
  `
  return { subject, html: wrap(subject, `${input.inviter_name} зовёт вас в Sporteo`, inner) }
}

// ── Sprint W3 Day 14 — subscription lifecycle emails ───────────────────────

export interface SubscriptionActivatedInput {
  name: string
  tariff_name: string
  price_label: string             // "599₽ / месяц" or "Бесплатно"
  period_end: string | null       // "ISO date — when first charge will fire"
  trial_ends_at: string | null    // "ISO date" if applicable
}

/** Sent immediately after webhook payment.succeeded activates subscription. */
export function renderSubscriptionActivated(input: SubscriptionActivatedInput): { subject: string; html: string } {
  const subject = `Подписка активирована · ${input.tariff_name}`
  const trialBadge = input.trial_ends_at
    ? `<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ECFEFF;color:#0891B2;font-size:11px;font-weight:700;border:1px solid #A5F3FC;margin-bottom:16px">
         🎁 Trial-период до ${escape(new Date(input.trial_ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))}
       </div>`
    : ''
  const periodLine = input.period_end
    ? `<p style="margin:8px 0 0 0;color:#64748B;font-size:13px">
         Следующее списание: <strong>${escape(new Date(input.period_end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }))}</strong>
       </p>`
    : ''
  const inner = `
    ${trialBadge}
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A">Спасибо, ${escape(input.name)}!</h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Подписка <strong>${escape(input.tariff_name)}</strong> активирована. Доступ открыт прямо сейчас.
    </p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:16px 0">
      <div style="font-size:11px;color:#15803D;text-transform:uppercase;letter-spacing:1px;font-weight:700">Тариф</div>
      <div style="margin-top:6px;font-size:18px;color:#0F172A;font-weight:700">${escape(input.tariff_name)} · ${escape(input.price_label)}</div>
      ${periodLine}
    </div>
    <p style="margin:24px 0 0 0">
      <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#F35703,#D44A02);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть платформу →
      </a>
    </p>
    <p style="margin:24px 0 0 0;color:#64748B;font-size:12px;line-height:1.5">
      Управление подпиской: <a href="${BASE_URL}/settings/billing" style="color:#D44A02;text-decoration:none">/settings/billing</a>
    </p>
  `
  return { subject, html: wrap(subject, 'Подписка активирована, доступ открыт', inner) }
}

export interface SubscriptionPaymentFailedInput {
  name: string
  tariff_name: string
  retry_url: string
}

/** Sent on payment.canceled / payment-failed events. */
export function renderSubscriptionPaymentFailed(input: SubscriptionPaymentFailedInput): { subject: string; html: string } {
  const subject = `Не удалось списать оплату · ${input.tariff_name}`
  const inner = `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;color:#B91C1C;text-transform:uppercase;letter-spacing:1px;font-weight:700">Платёж не прошёл</div>
      <div style="margin-top:6px;font-size:14px;color:#0F172A">${escape(input.tariff_name)}</div>
    </div>
    <h1 style="margin:0 0 8px 0;font-size:20px;color:#0F172A">Здравствуйте, ${escape(input.name)}</h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Списание не прошло. Подписка пока активна — у вас есть несколько дней, чтобы обновить способ оплаты, прежде чем доступ ограничится.
    </p>
    <p style="margin:24px 0 0 0">
      <a href="${escape(input.retry_url)}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#F35703,#D44A02);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Повторить оплату
      </a>
    </p>
    <p style="margin:16px 0 0 0;color:#64748B;font-size:12px;line-height:1.5">
      Если ничего не сделать в течение 7 дней — подписка перейдёт в статус «Просрочена», и платные функции скроются.
    </p>
  `
  return { subject, html: wrap(subject, 'Платёж не прошёл, обновите способ оплаты', inner) }
}

export interface SubscriptionCancelledInput {
  name: string
  tariff_name: string
  access_until: string | null
}

/** Sent when user cancels (cancel_at_period_end → cancelled). */
export function renderSubscriptionCancelled(input: SubscriptionCancelledInput): { subject: string; html: string } {
  const subject = `Подписка отменена · ${input.tariff_name}`
  const accessLine = input.access_until
    ? `<p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
         Доступ к платным функциям сохраняется до <strong>${escape(new Date(input.access_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }))}</strong>.
       </p>`
    : `<p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">Подписка отменена.</p>`
  const inner = `
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A">${escape(input.name)}, мы получили вашу отмену</h1>
    ${accessLine}
    <p style="margin:0 0 16px 0;color:#64748B;font-size:13px;line-height:1.6">
      После окончания периода ваш аккаунт перейдёт на тариф Free. История тренировок, контакты и данные сохраняются — можно вернуться в любой момент.
    </p>
    <p style="margin:24px 0 0 0">
      <a href="${BASE_URL}/pricing" style="display:inline-block;padding:12px 24px;background:#F8FAFC;color:#0F172A;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;border:1px solid #E2E8F0">
        Посмотреть тарифы
      </a>
    </p>
    <p style="margin:16px 0 0 0;color:#94A3B8;font-size:12px">
      Возобновить можно через <a href="${BASE_URL}/settings/billing" style="color:#D44A02;text-decoration:none">/settings/billing</a>.
    </p>
  `
  return { subject, html: wrap(subject, 'Подписка отменена', inner) }
}

// ── Sprint W4 Day 18 — Team Risk Snapshot lead magnet email ───────────

const STATUS_BADGE: Record<'ok' | 'watch' | 'risk', { label: string; color: string; bg: string; emoji: string }> = {
  ok:    { label: 'OK',    color: '#15803D', bg: '#F0FDF4', emoji: '🟢' },
  watch: { label: 'WATCH', color: '#A16207', bg: '#FEFCE8', emoji: '🟡' },
  risk:  { label: 'RISK',  color: '#B91C1C', bg: '#FEF2F2', emoji: '🔴' },
}

export interface TeamRiskSnapshotEmailInput {
  sport:       string
  team_name?:  string | null
  overall:     string
  athletes:    Array<{ name: string; status: 'ok' | 'watch' | 'risk'; reason: string; action: string }>
  priorities:  string[]
}

/**
 * Sent после email-capture в /tools/team-risk lead magnet.
 *
 * Текущий /api/tools/lead не диспетчит email напрямую — этот рендерер
 * готов для будущей интеграции (admin batch outreach или dedicated
 * /api/tools/team-risk/email endpoint).
 */
export function renderTeamRiskSnapshot(input: TeamRiskSnapshotEmailInput): { subject: string; html: string } {
  const teamLabel = input.team_name ? `${escape(input.team_name)} · ${escape(input.sport)}` : escape(input.sport)
  const subject = `Team Risk Snapshot · ${input.team_name ?? input.sport}`

  const counts = {
    ok:    input.athletes.filter(a => a.status === 'ok').length,
    watch: input.athletes.filter(a => a.status === 'watch').length,
    risk:  input.athletes.filter(a => a.status === 'risk').length,
  }

  const athleteRows = input.athletes.map(a => {
    const badge = STATUS_BADGE[a.status]
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;width:38%">
          <div style="font-size:13px;font-weight:700;color:#0F172A">${escape(a.name)}</div>
          <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${badge.bg};color:${badge.color}">
            ${badge.emoji} ${badge.label}
          </span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top">
          <div style="font-size:12px;color:#475569;line-height:1.5">
            <strong style="color:#0F172A">Причина:</strong> ${escape(a.reason)}
          </div>
          <div style="font-size:12px;color:#475569;line-height:1.5;margin-top:4px">
            <strong style="color:#0F172A">Действие:</strong> ${escape(a.action)}
          </div>
        </td>
      </tr>`
  }).join('')

  const prioritiesList = input.priorities.length > 0
    ? `<ol style="margin:8px 0 0 0;padding-left:20px;color:#0F172A;font-size:13px;line-height:1.6">
         ${input.priorities.map(p => `<li>${escape(p)}</li>`).join('')}
       </ol>`
    : ''

  const inner = `
    <div style="font-size:11px;color:#7C3AED;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:6px">
      Team Risk Snapshot
    </div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A;line-height:1.3">${teamLabel}</h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      ${escape(input.overall)}
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0">
      <tr>
        <td style="padding:0 4px 0 0;width:33.33%">
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#15803D">${counts.ok}</div>
            <div style="font-size:10px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:1px;margin-top:2px">🟢 В норме</div>
          </div>
        </td>
        <td style="padding:0 2px;width:33.33%">
          <div style="background:#FEFCE8;border:1px solid #FDE68A;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#A16207">${counts.watch}</div>
            <div style="font-size:10px;font-weight:700;color:#A16207;text-transform:uppercase;letter-spacing:1px;margin-top:2px">🟡 Наблюдение</div>
          </div>
        </td>
        <td style="padding:0 0 0 4px;width:33.33%">
          <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#B91C1C">${counts.risk}</div>
            <div style="font-size:10px;font-weight:700;color:#B91C1C;text-transform:uppercase;letter-spacing:1px;margin-top:2px">🔴 Риск</div>
          </div>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px 0;font-size:14px;color:#0F172A;text-transform:uppercase;letter-spacing:1px;font-weight:700">Состав</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F1F5F9;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${athleteRows}
    </table>

    ${input.priorities.length > 0 ? `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin:0 0 18px 0">
        <div style="font-size:11px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:1px">🎯 Приоритеты на 7-14 дней</div>
        ${prioritiesList}
      </div>
    ` : ''}

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:14px;line-height:1.6">
      Хотите видеть snapshot автоматически по всем тренировкам команды?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=tools&utm_medium=team-risk&utm_campaign=email" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#F35703,#D44A02);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Sporteo — платформа для атлетов, тренеров и спортивных врачей. Подключите Garmin / Whoop / ручной ввод —
      и risk-светофор обновляется в реальном времени.
    </p>
  `
  return { subject, html: wrap(subject, `Team Risk Snapshot · ${input.athletes.length} атлетов`, inner) }
}

// ── Sprint W4 Day 19 — Adaptive Plan Preview lead magnet email ────────

const INTENSITY_BADGE: Record<'easy' | 'moderate' | 'hard' | 'rest', { label: string; color: string; bg: string; emoji: string }> = {
  rest:     { label: 'REST',  color: '#475569', bg: '#F8FAFC', emoji: '🛌' },
  easy:     { label: 'EASY',  color: '#15803D', bg: '#F0FDF4', emoji: '🟢' },
  moderate: { label: 'MOD',   color: '#0E7490', bg: '#ECFEFF', emoji: '🟦' },
  hard:     { label: 'HARD',  color: '#B91C1C', bg: '#FEF2F2', emoji: '🔥' },
}

export interface AdaptivePlanPreviewEmailInput {
  sport:        string
  goal?:        string | null
  level:        string
  overview:     string
  weekly_load_assessment: 'low' | 'moderate' | 'high' | 'overtraining'
  days: Array<{
    day:           number
    weekday:       string
    activity_type: string
    duration_min:  number
    intensity:     'easy' | 'moderate' | 'hard' | 'rest'
    notes:         string
  }>
  rationale:    string
  red_flags:    string[]
}

/**
 * Sent после email-capture в /tools/adaptive-plan lead magnet. Готов
 * для будущей dispatch (admin batch outreach или dedicated endpoint).
 */
export function renderAdaptivePlanPreview(input: AdaptivePlanPreviewEmailInput): { subject: string; html: string } {
  const subject = `Free 7-day Adaptive Plan · ${input.sport}`

  const dayRows = input.days.map(d => {
    const badge = INTENSITY_BADGE[d.intensity]
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;width:18%">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:700">День ${d.day}</div>
          <div style="font-size:13px;font-weight:700;color:#0F172A;margin-top:2px">${escape(d.weekday)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;width:22%">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:${badge.bg};color:${badge.color}">
            ${badge.emoji} ${badge.label}
          </span>
          <div style="font-size:12px;color:#475569;margin-top:4px">${d.duration_min > 0 ? `${d.duration_min} мин` : '—'}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top">
          <div style="font-size:13px;font-weight:600;color:#0F172A">${escape(d.activity_type)}</div>
          <div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.5">${escape(d.notes)}</div>
        </td>
      </tr>`
  }).join('')

  const redFlagsBlock = input.red_flags.length > 0
    ? `<div style="background:#FEF0E7;border:1px solid #FBC1A0;border-radius:12px;padding:14px;margin:0 0 18px 0">
         <div style="font-size:11px;font-weight:700;color:#8A300A;text-transform:uppercase;letter-spacing:1px">⚠️ На что обратить внимание</div>
         <ul style="margin:8px 0 0 0;padding-left:20px;color:#0F172A;font-size:13px;line-height:1.6">
           ${input.red_flags.map(rf => `<li>${escape(rf)}</li>`).join('')}
         </ul>
       </div>`
    : ''

  const inner = `
    <div style="font-size:11px;color:#2563EB;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:6px">
      Free 7-day Adaptive Plan
    </div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Ваш план · ${escape(input.sport)}
    </h1>
    ${input.goal ? `<p style="margin:0 0 4px 0;color:#64748B;font-size:13px">Цель: ${escape(input.goal)}</p>` : ''}
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      ${escape(input.overview)}
    </p>

    <h2 style="margin:0 0 8px 0;font-size:14px;color:#0F172A;text-transform:uppercase;letter-spacing:1px;font-weight:700">7 дней</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F1F5F9;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${dayRows}
    </table>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin:0 0 14px 0">
      <div style="font-size:11px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:1px">🧠 Логика плана</div>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:13px;line-height:1.6">${escape(input.rationale)}</p>
    </div>

    ${redFlagsBlock}

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:14px;line-height:1.6">
      Хотите свежий план каждую неделю автоматически?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=tools&utm_medium=adaptive-plan&utm_campaign=email" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Подключите Garmin / Whoop / Apple Health — каждую неделю AI обновляет план
      на основе фактической нагрузки и recovery.
    </p>
  `
  return { subject, html: wrap(subject, `7-day plan · ${input.sport} · ${input.level}`, inner) }
}

// ── Sprint W4 Day 20 — Club Audit lead magnet email ───────────────────

const HEALTH_BADGE: Record<'critical' | 'at-risk' | 'stable' | 'healthy', { label: string; color: string; bg: string; emoji: string }> = {
  critical: { label: 'CRITICAL', color: '#B91C1C', bg: '#FEF2F2', emoji: '🚨' },
  'at-risk':{ label: 'AT RISK',  color: '#B03D04', bg: '#FEF0E7', emoji: '⚠️' },
  stable:   { label: 'STABLE',   color: '#A16207', bg: '#FEFCE8', emoji: '🟡' },
  healthy:  { label: 'HEALTHY',  color: '#15803D', bg: '#F0FDF4', emoji: '🟢' },
}

const SEVERITY_BADGE_EMAIL: Record<'low' | 'medium' | 'high', { color: string; bg: string }> = {
  low:    { color: '#15803D', bg: '#F0FDF4' },
  medium: { color: '#B03D04', bg: '#FEF0E7' },
  high:   { color: '#B91C1C', bg: '#FEF2F2' },
}

export interface ClubAuditEmailInput {
  club_name?:                 string | null
  primary_sport:              string
  health_score:               number
  health_label:               'critical' | 'at-risk' | 'stable' | 'healthy'
  summary:                    string
  risk_areas: Array<{
    name:                string
    severity:            'low' | 'medium' | 'high'
    current_state:       string
    recommended_action:  string
    proform_helps_with?: string
  }>
  top_3_priorities:           string[]
  estimated_revenue_at_risk?: string
  next_steps:                 string
}

/**
 * Sent после email-capture в /tools/club-audit lead magnet. Готов
 * для будущей dispatch (admin batch outreach или dedicated endpoint).
 */
export function renderClubAuditReport(input: ClubAuditEmailInput): { subject: string; html: string } {
  const clubLabel = input.club_name ? `${escape(input.club_name)} · ${escape(input.primary_sport)}` : escape(input.primary_sport)
  const subject = `Club Audit · ${input.club_name ?? input.primary_sport} · score ${input.health_score}/100`
  const healthMeta = HEALTH_BADGE[input.health_label]

  const riskRows = input.risk_areas.map(r => {
    const sev = SEVERITY_BADGE_EMAIL[r.severity]
    return `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #F1F5F9;vertical-align:top">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <strong style="font-size:14px;color:#0F172A">${escape(r.name)}</strong>
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${sev.bg};color:${sev.color}">${r.severity.toUpperCase()}</span>
          </div>
          <div style="font-size:12px;color:#475569;line-height:1.55;margin-bottom:6px">
            <strong style="color:#0F172A">Сейчас:</strong> ${escape(r.current_state)}
          </div>
          <div style="font-size:12px;color:#475569;line-height:1.55">
            <strong style="color:#0F172A">Действие:</strong> ${escape(r.recommended_action)}
          </div>
          ${r.proform_helps_with ? `
            <div style="margin-top:8px;font-size:11px;color:#15803D;font-style:italic;background:#F0FDF4;border-left:3px solid #BBF7D0;padding:6px 10px;border-radius:6px">
              💡 ${escape(r.proform_helps_with)}
            </div>
          ` : ''}
        </td>
      </tr>`
  }).join('')

  const prioritiesList = input.top_3_priorities.length > 0
    ? `<ol style="margin:8px 0 0 0;padding-left:20px;color:#0F172A;font-size:13px;line-height:1.6">
         ${input.top_3_priorities.map(p => `<li>${escape(p)}</li>`).join('')}
       </ol>`
    : ''

  const inner = `
    <div style="font-size:11px;color:#059669;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:6px">
      Club Audit
    </div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A;line-height:1.3">${clubLabel}</h1>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 18px 0">
      <tr>
        <td style="vertical-align:middle;width:140px">
          <div style="background:${healthMeta.bg};border:2px solid ${healthMeta.color}33;border-radius:14px;padding:14px;text-align:center">
            <div style="font-size:36px;font-weight:800;color:${healthMeta.color};line-height:1">${input.health_score}</div>
            <div style="font-size:10px;font-weight:700;color:${healthMeta.color};text-transform:uppercase;letter-spacing:1px;margin-top:4px">/ 100</div>
            <span style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:white;color:${healthMeta.color};border:1px solid ${healthMeta.color}55">
              ${healthMeta.emoji} ${healthMeta.label}
            </span>
          </div>
        </td>
        <td style="padding-left:16px;vertical-align:top">
          <p style="margin:0 0 8px 0;color:#475569;font-size:14px;line-height:1.6">${escape(input.summary)}</p>
          ${input.estimated_revenue_at_risk ? `
            <div style="display:inline-block;background:#FEF0E7;border:1px solid #FBC1A0;border-radius:8px;padding:6px 10px;font-size:12px;color:#8A300A;font-weight:600">
              💸 ${escape(input.estimated_revenue_at_risk)}
            </div>
          ` : ''}
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px 0;font-size:14px;color:#0F172A;text-transform:uppercase;letter-spacing:1px;font-weight:700">Области риска</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F1F5F9;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${riskRows}
    </table>

    ${input.top_3_priorities.length > 0 ? `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin:0 0 14px 0">
        <div style="font-size:11px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:1px">🎯 Top-3 приоритеты на 30 дней</div>
        ${prioritiesList}
      </div>
    ` : ''}

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px;margin:0 0 18px 0">
      <div style="font-size:11px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:1px">Next Steps · 7-14 дней</div>
      <p style="margin:8px 0 0 0;color:#0F172A;font-size:13px;line-height:1.6">${escape(input.next_steps)}</p>
    </div>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:14px;line-height:1.6">
      Хотите эти метрики автоматически в Org Dashboard?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=tools&utm_medium=club-audit&utm_campaign=email" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#10B981,#0F766E);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Sporteo для клубов: KPI tiles, roster matrix с overload highlighting, recommendations stream от спорт.врачей,
      автоматизированный биллинг. Подключение — 30 минут с CSV-импорта.
    </p>
  `
  return { subject, html: wrap(subject, `Club Audit · score ${input.health_score}/100`, inner) }
}

// ── Sprint W4 Day 21 — Medical Summary Demo lead magnet email ──────────

const TRIAGE_BADGE: Record<'red_flag' | 'urgent_referral' | 'restricted_activity' | 'monitor' | 'return_to_play', { label: string; color: string; bg: string; emoji: string }> = {
  red_flag:            { label: 'RED FLAG',            color: '#B91C1C', bg: '#FEF2F2', emoji: '🚨' },
  urgent_referral:     { label: 'URGENT REFERRAL',     color: '#B03D04', bg: '#FEF0E7', emoji: '⚠️' },
  restricted_activity: { label: 'RESTRICTED ACTIVITY', color: '#A16207', bg: '#FEFCE8', emoji: '🟠' },
  monitor:             { label: 'MONITOR',             color: '#0E7490', bg: '#ECFEFF', emoji: '🟡' },
  return_to_play:      { label: 'RETURN TO PLAY',      color: '#15803D', bg: '#F0FDF4', emoji: '🟢' },
}

export interface MedicalSummaryEmailInput {
  age:                 number
  sport:               string
  triage:              'red_flag' | 'urgent_referral' | 'restricted_activity' | 'monitor' | 'return_to_play'
  triage_explanation:  string
  red_flags:           string[]
  differential: Array<{
    condition:  string
    likelihood: 'low' | 'medium' | 'high'
    notes:      string
  }>
  recommended_next_steps: {
    imaging_suggested:      string | null
    specialist_referral:    string | null
    activity_modifications: string
    follow_up_timeline:     string
  }
  patient_education:   string[]
  confidence:          'low' | 'medium' | 'high'
}

/**
 * Sent после email-capture в /tools/medical-summary lead magnet.
 *
 * ⚠️ Email body содержит prominent disclaimer что это AI-generated draft
 * и НЕ диагноз. Liability framing critical для medical content.
 */
export function renderMedicalSummaryDemo(input: MedicalSummaryEmailInput): { subject: string; html: string } {
  const subject = `Medical Summary Draft · ${input.sport} · ${input.age}y · ${input.triage.replace('_', ' ')}`
  const tri = TRIAGE_BADGE[input.triage]

  const redFlagsBlock = input.red_flags.length > 0
    ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:14px;margin:0 0 16px 0">
         <div style="font-size:11px;font-weight:700;color:#B91C1C;text-transform:uppercase;letter-spacing:1px">🚨 Red flags identified</div>
         <ul style="margin:8px 0 0 0;padding-left:20px;color:#7F1D1D;font-size:13px;line-height:1.6">
           ${input.red_flags.map(rf => `<li>${escape(rf)}</li>`).join('')}
         </ul>
       </div>`
    : ''

  const differentialRows = input.differential.map(d => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;width:55%">
        <strong style="font-size:13px;color:#0F172A">${escape(d.condition)}</strong>
        <div style="font-size:11px;color:#64748B;margin-top:4px;line-height:1.5">${escape(d.notes)}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:top;text-align:right">
        <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;background:#F1F5F9;color:#475569;text-transform:uppercase">${d.likelihood}</span>
      </td>
    </tr>`).join('')

  const educationList = input.patient_education.length > 0
    ? `<ul style="margin:8px 0 0 0;padding-left:20px;color:#0F172A;font-size:13px;line-height:1.6">
         ${input.patient_education.map(e => `<li>${escape(e)}</li>`).join('')}
       </ul>`
    : ''

  const inner = `
    <!-- ⚠ Persistent disclaimer — Top -->
    <div style="background:#FFFBEB;border:2px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:#92400E;line-height:1.5">
        ⚠ AI-generated draft. NOT a diagnosis.
      </div>
      <div style="font-size:11px;color:#78350F;margin-top:6px;line-height:1.5">
        Все clinical decisions требуют review licensed practitioner. Confidence level отчёта: <strong>${escape(input.confidence.toUpperCase())}</strong>.
        Не используйте автономно для acute / emergency situations.
      </div>
    </div>

    <div style="font-size:11px;color:#7C3AED;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:6px">
      Medical Summary Demo
    </div>
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0F172A;line-height:1.3">
      ${escape(input.sport)} · ${input.age} лет
    </h1>

    <!-- Triage hero -->
    <div style="background:${tri.bg};border:2px solid ${tri.color}55;border-radius:14px;padding:14px;margin:12px 0 18px 0">
      <div style="font-size:11px;font-weight:700;color:${tri.color};text-transform:uppercase;letter-spacing:1px">
        ${tri.emoji} Triage Classification
      </div>
      <div style="font-size:18px;font-weight:800;color:${tri.color};margin-top:6px">
        ${tri.label}
      </div>
      <p style="margin:8px 0 0 0;color:#0F172A;font-size:13px;line-height:1.6">${escape(input.triage_explanation)}</p>
    </div>

    ${redFlagsBlock}

    <!-- Differential -->
    <h2 style="margin:0 0 8px 0;font-size:14px;color:#0F172A;text-transform:uppercase;letter-spacing:1px;font-weight:700">🧠 Differential</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F1F5F9;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${differentialRows}
    </table>

    <!-- Next steps -->
    <h2 style="margin:0 0 8px 0;font-size:14px;color:#0F172A;text-transform:uppercase;letter-spacing:1px;font-weight:700">🩺 Recommended next steps</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #F1F5F9;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${input.recommended_next_steps.imaging_suggested ? `
        <tr><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;width:38%">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:700">Imaging</div>
        </td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9">
          <div style="font-size:13px;color:#0F172A">${escape(input.recommended_next_steps.imaging_suggested)}</div>
        </td></tr>` : ''}
      ${input.recommended_next_steps.specialist_referral ? `
        <tr><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9">
          <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:700">Specialist Referral</div>
        </td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9">
          <div style="font-size:13px;color:#0F172A">${escape(input.recommended_next_steps.specialist_referral)}</div>
        </td></tr>` : ''}
      <tr><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9">
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:700">Activity Modifications</div>
      </td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9">
        <div style="font-size:13px;color:#0F172A">${escape(input.recommended_next_steps.activity_modifications)}</div>
      </td></tr>
      <tr><td style="padding:10px 12px">
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:700">Follow-up</div>
      </td><td style="padding:10px 12px">
        <div style="font-size:13px;color:#0F172A">${escape(input.recommended_next_steps.follow_up_timeline)}</div>
      </td></tr>
    </table>

    ${input.patient_education.length > 0 ? `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin:0 0 18px 0">
        <div style="font-size:11px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:1px">📘 Patient education</div>
        ${educationList}
      </div>
    ` : ''}

    <!-- ⚠ Disclaimer footer -->
    <div style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:10px;padding:12px;margin:18px 0 0 0">
      <div style="font-size:11px;color:#475569;line-height:1.55">
        <strong>Disclaimer:</strong> Этот summary создан AI на основе предоставленных данных. Он НЕ заменяет clinical examination, imaging, lab work или judgment licensed practitioner. Если есть signs of acute distress — refer to emergency services.
      </div>
    </div>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:14px;line-height:1.6">
      Хотите вести медицинскую документацию атлетов в одной системе?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=tools&utm_medium=medical-summary&utm_campaign=email" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#8B5CF6,#A21CAF);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Sporteo для врачей: structured recommendations с visibility levels (athlete only / coach + athlete / org_full),
      integration с тренировочными данными, автоматический dispatch уведомлений.
    </p>
  `
  return { subject, html: wrap(subject, `Medical Summary Draft · ${input.triage.replace('_', ' ')}`, inner) }
}

// ── Doctor inquiry notification email (Sprint W6 Day 28) ────────────────────

export interface DoctorInquiryEmailInput {
  doctor_name:   string
  coach_name:    string
  athlete_name:  string
  question_type: string         // e.g. "Допуск к нагрузке"
  type_emoji:    string         // e.g. "✅"
  urgency:       'routine' | 'urgent' | 'red_flag'
  urgency_label: string         // e.g. "Routine (7 дн)"
  question:      string
  expires_at:    string         // ISO
  inquiry_url:   string         // deep link to /doctor/inquiries?id=X
}

/**
 * Email to doctor when coach creates an inquiry. Subject is
 * urgency-prefixed so it stands out in inbox. Body is short:
 * who/what/why + CTA. Inline styles only.
 */
export function renderDoctorInquiryEmail(input: DoctorInquiryEmailInput): { subject: string; html: string } {
  const urgencyPrefix = input.urgency === 'red_flag' ? '🔴 RED FLAG (24ч) · '
    : input.urgency === 'urgent' ? '🟠 СРОЧНО (72ч) · '
    : ''
  const subject = `${urgencyPrefix}Запрос врачу: ${input.athlete_name} (${input.question_type})`

  const urgencyBg = input.urgency === 'red_flag' ? '#FEF2F2'
    : input.urgency === 'urgent' ? '#FEF0E7' : '#F8FAFC'
  const urgencyColor = input.urgency === 'red_flag' ? '#B91C1C'
    : input.urgency === 'urgent' ? '#B03D04' : '#475569'
  const urgencyBorder = input.urgency === 'red_flag' ? '#FECACA'
    : input.urgency === 'urgent' ? '#FBC1A0' : '#E2E8F0'

  const expiresFmt = (() => {
    try {
      return new Date(input.expires_at).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
    } catch { return input.expires_at }
  })()

  const inner = `
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px 0;color:#0F172A;font-weight:700">
      Запрос медицинского заключения
    </h1>
    <p style="margin:0 0 18px 0;color:#475569;font-size:14px;line-height:1.5">
      Здравствуйте, ${escape(input.doctor_name)}. Тренер
      <strong style="color:#0F172A">${escape(input.coach_name)}</strong> запросил ваше
      мнение по атлету <strong style="color:#0F172A">${escape(input.athlete_name)}</strong>.
    </p>

    <div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;padding:14px 16px;margin:0 0 18px 0">
      <div style="margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:${urgencyColor};text-transform:uppercase;letter-spacing:1px">
          ${escape(input.urgency_label)}
        </span>
      </div>
      <div style="font-size:13px;color:#0F172A;font-weight:600;margin-bottom:8px">
        ${escape(input.type_emoji)} ${escape(input.question_type)}
      </div>
      <p style="margin:0;color:#0F172A;font-size:14px;line-height:1.55;white-space:pre-wrap">${escape(input.question)}</p>
    </div>

    <table role="presentation" width="100%" style="margin:0 0 18px 0;font-size:12px;color:#64748B">
      <tr><td style="padding:6px 0;border-bottom:1px dashed #E2E8F0">
        <strong style="color:#475569">Срок ответа</strong>
      </td><td align="right" style="padding:6px 0;border-bottom:1px dashed #E2E8F0">
        <strong style="color:${urgencyColor}">${escape(expiresFmt)}</strong>
      </td></tr>
    </table>

    <p style="margin:0 0 12px 0">
      <a href="${input.inquiry_url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Ответить в Sporteo →
      </a>
    </p>

    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Ваш ответ будет виден тренеру и атлету (summary). Если запрос больше неактуален —
      coach его отменит, либо он автоматически expires по сроку.
    </p>
  `
  return { subject, html: wrap(subject, `${urgencyPrefix}${input.athlete_name}: ${input.question_type}`, inner) }
}

// ── Org weekly activity digest (Sprint W8 Day 41) ──────────────────────────

export interface OrgWeeklyDigestEvent {
  type:       'member_joined' | 'inquiry_created' | 'inquiry_answered' | 'recommendation_issued'
  summary:    string
  actor_name: string | null
  target_name:string | null
  timestamp:  string
  tone?:      'info' | 'warning' | 'critical' | 'success'
}

export interface OrgWeeklyDigestInput {
  org_name:   string
  events:     OrgWeeklyDigestEvent[]
  counts:     {
    member_joined:         number
    inquiry_created:       number
    inquiry_answered:      number
    recommendation_issued: number
  }
  activity_url: string
}

/**
 * Sunday digest email for org admins summarising the week's
 * cross-cutting events. Mirrors /org/activity page UX but rendered
 * for email (inline styles, table-based layout).
 */
export function renderOrgWeeklyDigest(input: OrgWeeklyDigestInput): { subject: string; html: string } {
  const totalEvents = input.events.length
  const subject = totalEvents > 0
    ? `${escape(input.org_name)}: ${totalEvents} событий за неделю`
    : `${escape(input.org_name)}: тихая неделя`

  const TYPE_LABELS: Record<OrgWeeklyDigestEvent['type'], { label: string; emoji: string; color: string }> = {
    member_joined:         { label: 'Новый член',      emoji: '👋', color: '#16A34A' },
    inquiry_created:       { label: 'Запрос врачу',    emoji: '❓', color: '#7C3AED' },
    inquiry_answered:      { label: 'Ответ врача',     emoji: '✅', color: '#0891B2' },
    recommendation_issued: { label: 'Рекомендация',    emoji: '🩺', color: '#B91C1C' },
  }

  const TONE_COLOR: Record<NonNullable<OrgWeeklyDigestEvent['tone']>, string> = {
    info:     '#94A3B8',
    warning:  '#F59E0B',
    critical: '#DC2626',
    success:  '#10B981',
  }

  const kpiTiles = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0">
      <tr>
        ${kpiTile('👋 Новые члены',  input.counts.member_joined,         '#16A34A')}
        ${kpiTile('❓ Запросов',      input.counts.inquiry_created,       '#7C3AED')}
      </tr>
      <tr><td style="height:6px"></td><td style="height:6px"></td></tr>
      <tr>
        ${kpiTile('✅ Ответов',       input.counts.inquiry_answered,      '#0891B2')}
        ${kpiTile('🩺 Рекомендаций',  input.counts.recommendation_issued, '#B91C1C')}
      </tr>
    </table>
  `

  const eventRows = input.events.slice(0, 8).map(e => {
    const meta = TYPE_LABELS[e.type]
    const toneColor = e.tone ? TONE_COLOR[e.tone] : '#CBD5E1'
    const actor = e.actor_name ? escape(e.actor_name) : '—'
    const target = e.target_name && e.target_name !== e.actor_name ? ` · атлет: <strong>${escape(e.target_name)}</strong>` : ''
    return `
      <tr><td style="padding:10px 0;border-bottom:1px solid #F1F5F9">
        <table role="presentation" width="100%"><tr>
          <td width="6" style="background:${toneColor};border-radius:2px"></td>
          <td style="padding-left:12px">
            <div style="font-size:10px;font-weight:700;color:${meta.color};text-transform:uppercase;letter-spacing:1px">
              ${meta.emoji} ${meta.label}
            </div>
            <div style="font-size:13px;color:#0F172A;margin-top:3px">${escape(e.summary)}</div>
            <div style="font-size:11px;color:#64748B;margin-top:3px">
              <strong>${actor}</strong>${target}
            </div>
          </td>
        </tr></table>
      </td></tr>
    `
  }).join('')

  const moreLink = totalEvents > 8
    ? `<p style="margin:6px 0 0 0;text-align:center"><a href="${input.activity_url}" style="color:#2563EB;font-size:12px;font-weight:600">Ещё ${totalEvents - 8} событий →</a></p>`
    : ''

  const inner = totalEvents === 0 ? `
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Тихая неделя в ${escape(input.org_name)}
    </h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      За последние 7 дней значимых событий не было — никто не присоединялся, не было запросов врачам или новых рекомендаций.
    </p>
    <p style="margin:0 0 12px 0">
      <a href="${input.activity_url}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Открыть панель организации →</a>
    </p>
  ` : `
    <h1 style="margin:0 0 6px 0;font-size:22px;color:#0F172A;line-height:1.3">
      ${escape(input.org_name)} — еженедельная сводка
    </h1>
    <p style="margin:0 0 18px 0;color:#64748B;font-size:13px">
      Что происходило в команде за последние 7 дней.
    </p>

    ${kpiTiles}

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:6px 14px;margin:0 0 18px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${eventRows}</table>
    </div>
    ${moreLink}

    <p style="margin:18px 0 0 0">
      <a href="${input.activity_url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Открыть полную ленту событий →</a>
    </p>

    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Сводка приходит раз в неделю, по воскресеньям. Если в команде ничего не происходило, письма не будет.
    </p>
  `
  return { subject, html: wrap(subject, `${totalEvents} событий за неделю`, inner) }
}

function kpiTile(label: string, value: number, color: string): string {
  return `
    <td width="50%" style="padding:0 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px">
        <tr><td style="padding:14px 16px">
          <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:1px">${label}</div>
          <div style="font-size:24px;font-weight:700;color:${color};margin-top:4px">${value}</div>
        </td></tr>
      </table>
    </td>
  `
}

