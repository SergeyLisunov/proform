/**
 * Lead drip templates — Sprint W4 Day 22 (PR #38).
 *
 * Source-specific follow-up emails для leads из 4 W4 lead-magnets.
 * Отправляются cron'ом /api/cron/leads-digest еженедельно (Monday).
 *
 * Почему НЕ reuse существующие render*() из lib/email/templates.ts:
 *   - Те emails требуют full snapshot data (athletes[], days[], risk_areas[])
 *   - tool_leads.payload хранит только meta (sport, count, label) для аудита
 *   - Drip emails — generic conversion-focused, не personalized snapshot replay
 *   - Цель drip = «прийти зарегистрироваться», не «прислать ещё один отчёт»
 *
 * Каждый drip template:
 *   - Source-specific subject + hero
 *   - Light personalization из payload meta (sport name / team name etc.)
 *   - Конкретный USP про продукт (что в Sporteo даёт бóльшую ценность чем
 *     standalone tool)
 *   - Strong CTA "Открыть бесплатно"
 *   - 1 disclaimer block для medical-summary source (regulatory)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

function wrap(title: string, preheader: string, inner: string, accentColor = '#D44A02'): string {
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
              <td style="font-size:12px;font-weight:700;color:${accentColor};letter-spacing:2px;text-transform:uppercase">Sporteo</td>
              <td align="right" style="font-size:11px;color:#94A3B8">Lead drip · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:24px 32px 28px 32px">${inner}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #F1F5F9;background:#F8FAFC;font-size:11px;color:#64748B;text-align:center">
            <a href="${BASE_URL}" style="color:${accentColor};text-decoration:none;font-weight:600">Открыть Sporteo</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/legal/unsubscribe" style="color:#64748B;text-decoration:underline">Отписаться</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

// ── Source: team-risk ──────────────────────────────────────────────────

export interface TeamRiskDripPayload {
  sport?:            string
  team_name?:        string | null
  athletes_count?:   number
  risk_count?:       number
  watch_count?:      number
}

export function renderTeamRiskDrip(payload: TeamRiskDripPayload | null | undefined): { subject: string; html: string } {
  const p = payload ?? {}
  const sport = p.sport ?? 'команды'
  const subject = `5 способов автоматизировать risk monitoring в ${escape(sport)}`
  const teamLabel = p.team_name ? escape(p.team_name) : escape(sport)
  const inner = `
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Привет! Спасибо что попробовали Team Risk Snapshot
    </h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Вы получили snapshot для <strong>${teamLabel}</strong>${p.athletes_count ? ` (${p.athletes_count} атлет${p.athletes_count === 1 ? '' : 'ов'})` : ''}.
      ${p.risk_count ? `${p.risk_count} в красной зоне риска${p.watch_count ? `, ${p.watch_count} требуют наблюдения.` : '.'}` : ''}
    </p>

    <p style="margin:0 0 16px 0;color:#0F172A;font-size:14px;line-height:1.6">Что даёт Sporteo над standalone snapshot:</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0">
      <tr><td style="padding:10px 12px;border:1px solid #FED7AA;border-radius:10px;background:#FFF7ED;margin-bottom:8px">
        <strong style="color:#C2410C;font-size:13px">🔄 Auto-update</strong>
        <div style="font-size:12px;color:#475569;margin-top:4px">Atlete подключает Garmin/Whoop — ACWR обновляется ежедневно автоматически</div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px 0">
      <tr><td style="padding:10px 12px;border:1px solid #FED7AA;border-radius:10px;background:#FFF7ED">
        <strong style="color:#C2410C;font-size:13px">🚨 Early warning</strong>
        <div style="font-size:12px;color:#475569;margin-top:4px">Cron уведомляет когда athlete в зоне риска — до травмы, не после</div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px 0">
      <tr><td style="padding:10px 12px;border:1px solid #FED7AA;border-radius:10px;background:#FFF7ED">
        <strong style="color:#C2410C;font-size:13px">📊 Roster matrix</strong>
        <div style="font-size:12px;color:#475569;margin-top:4px">Все атлеты в одной таблице со статусами — coach видит overload в одном scan'е</div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px 0">
      <tr><td style="padding:10px 12px;border:1px solid #FED7AA;border-radius:10px;background:#FFF7ED">
        <strong style="color:#C2410C;font-size:13px">🩺 Doctor recommendations</strong>
        <div style="font-size:12px;color:#475569;margin-top:4px">Спортивный врач может оставить рекомендацию — coach + athlete видят одно и то же</div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0">
      <tr><td style="padding:10px 12px;border:1px solid #FED7AA;border-radius:10px;background:#FFF7ED">
        <strong style="color:#C2410C;font-size:13px">📅 Bulk planning</strong>
        <div style="font-size:12px;color:#475569;margin-top:4px">CSV-импорт всей команды + bulk-invite за 2 минуты вместо ручного добавления</div>
      </td></tr>
    </table>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:15px;line-height:1.5;font-weight:600">
      Хотите такой workflow для своей команды?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=drip&utm_medium=email&utm_campaign=team-risk" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#F35703,#D44A02);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Free forever для до 5 атлетов. Pro tier с recurring billing — когда команда растёт.
    </p>
  `
  return { subject, html: wrap(subject, `Team Risk follow-up · ${teamLabel}`, inner, '#D44A02') }
}

// ── Source: adaptive-plan ──────────────────────────────────────────────

export interface AdaptivePlanDripPayload {
  sport?:                  string
  level?:                  string
  workouts_count?:         number
  weekly_load_assessment?: string
}

export function renderAdaptivePlanDrip(payload: AdaptivePlanDripPayload | null | undefined): { subject: string; html: string } {
  const p = payload ?? {}
  const sport = p.sport ?? 'тренировок'
  const subject = `Почему ваш план для ${escape(sport)} должен адаптироваться еженедельно`
  const inner = `
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Спасибо что попробовали Adaptive Plan
    </h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Вы получили 7-day plan для <strong>${escape(sport)}</strong>${p.level ? ` (${escape(p.level)} уровень)` : ''}.
      ${p.workouts_count ? `На основе ${p.workouts_count} тренировок за 4 недели.` : ''}
    </p>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin:0 0 18px 0">
      <p style="margin:0;color:#0F172A;font-size:13px;line-height:1.6">
        <strong>Проблема static plans:</strong> через неделю реальная нагрузка отличается от планируемой.
        Recovery меняется. Mood меняется. План должен адаптироваться — иначе он становится фантазией на бумаге.
      </p>
    </div>

    <p style="margin:0 0 8px 0;color:#0F172A;font-size:14px;line-height:1.6;font-weight:600">Что даёт Sporteo:</p>

    <ul style="margin:0 0 18px 0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7">
      <li><strong>Garmin / Whoop / Apple Health integration</strong> — фактическая нагрузка логируется автоматически</li>
      <li><strong>AI обновляет план еженедельно</strong> — учёт реального ACWR + recovery + mood</li>
      <li><strong>Тренер видит ваши данные</strong> — может скорректировать вручную если нужно</li>
      <li><strong>Спортивный врач консультирует</strong> — рекомендации с привязкой к training load</li>
    </ul>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:15px;line-height:1.5;font-weight:600">
      Хотите свежий план каждую неделю автоматически?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=drip&utm_medium=email&utm_campaign=adaptive-plan" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Начать бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Free forever для индивидуальных атлетов. Pro tier — если хотите подключить тренера или sports doctor.
    </p>
  `
  return { subject, html: wrap(subject, `Adaptive Plan follow-up · ${escape(sport)}`, inner, '#2563EB') }
}

// ── Source: club-audit ─────────────────────────────────────────────────

export interface ClubAuditDripPayload {
  primary_sport?:    string
  total_athletes?:   number
  active_athletes?:  number
  coaches_count?:    number
  health_score?:     number
  health_label?:     string
  risk_area_count?:  number
}

export function renderClubAuditDrip(payload: ClubAuditDripPayload | null | undefined): { subject: string; html: string } {
  const p = payload ?? {}
  const subject = p.health_score !== undefined
    ? `Audit ${p.health_score}/100 — что делать дальше с клубом`
    : `От аудита к действию — как клубы используют Sporteo`
  const sport = p.primary_sport ?? 'клуба'
  const inner = `
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Спасибо за прохождение Club Audit
    </h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Вы получили аудит ${escape(sport)}${p.total_athletes ? ` (${p.total_athletes} атлет${p.total_athletes === 1 ? '' : 'ов'}, ${p.coaches_count ?? '?'} тренер${p.coaches_count === 1 ? '' : 'ов'})` : ''}.
      ${p.health_score !== undefined ? `Health score: <strong>${p.health_score}/100</strong>${p.health_label ? ` (${escape(p.health_label)})` : ''}.` : ''}
    </p>

    <p style="margin:0 0 8px 0;color:#0F172A;font-size:14px;line-height:1.6;font-weight:600">
      Audit дал список — но как его реализовать?
    </p>

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:0 0 18px 0">
      <strong style="color:#15803D;font-size:13px">📊 Sporteo Org Dashboard:</strong>
      <ul style="margin:8px 0 0 0;padding-left:20px;color:#0F172A;font-size:13px;line-height:1.7">
        <li>KPI tiles в реальном времени — retention, активные athletes, coach load</li>
        <li>Roster matrix с цветовым highlighting перегрузки тренеров</li>
        <li>Recommendations stream от спортивных врачей</li>
        <li>Bulk-invite athletes через CSV (W3 Day 16)</li>
        <li>Teams structure с drill-down по составу</li>
        <li>ЮKassa-биллинг автоматически (free 30 days trial для clubs)</li>
      </ul>
    </div>

    <p style="margin:0 0 16px 0;color:#475569;font-size:13px;line-height:1.6">
      Подключение — 30 минут с CSV-импорта существующего ростера. Athletes получают invite по email,
      coaches видят свои teams в первый же день.
    </p>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:15px;line-height:1.5;font-weight:600">
      Хотите от audit к workflow?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=drip&utm_medium=email&utm_campaign=club-audit" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#10B981,#0F766E);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      30-day trial для клубов — без credit card. Если не подойдёт, ничего не теряете.
    </p>
  `
  return { subject, html: wrap(subject, `Club Audit follow-up · ${escape(sport)}`, inner, '#0F766E') }
}

// ── Source: medical-summary ────────────────────────────────────────────

export interface MedicalSummaryDripPayload {
  sport?:           string
  age?:             number
  triage?:          string
  confidence?:      string
  red_flags_count?: number
}

export function renderMedicalSummaryDrip(payload: MedicalSummaryDripPayload | null | undefined): { subject: string; html: string } {
  const p = payload ?? {}
  const subject = `Структурированная медицинская документация спортивных кейсов`
  const sport = p.sport ?? 'спорт'
  const inner = `
    <!-- ⚠ Persistent disclaimer at top -->
    <div style="background:#FFFBEB;border:2px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:#92400E;line-height:1.5">
        ⚠ Reminder: Medical Summary Demo создаёт draft, НЕ диагноз.
      </div>
      <div style="font-size:11px;color:#78350F;margin-top:6px;line-height:1.5">
        Все clinical decisions всегда требуют review licensed practitioner.
      </div>
    </div>

    <h1 style="margin:0 0 12px 0;font-size:22px;color:#0F172A;line-height:1.3">
      Спасибо что попробовали Medical Summary Demo
    </h1>
    <p style="margin:0 0 16px 0;color:#475569;font-size:14px;line-height:1.6">
      Вы получили draft для случая ${escape(sport)}${p.age ? `, ${p.age} лет` : ''}${p.triage ? ` (triage: ${escape(p.triage.replace('_', ' '))})` : ''}.
    </p>

    <p style="margin:0 0 8px 0;color:#0F172A;font-size:14px;line-height:1.6;font-weight:600">
      Sporteo для спортивных врачей — больше чем разовый AI-draft:
    </p>

    <ul style="margin:0 0 18px 0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7">
      <li><strong>Structured recommendations</strong> с visibility levels — athlete only / coach + athlete / org_full</li>
      <li><strong>Привязка к тренировочным данным</strong> — рекомендация знает контекст ACWR, recovery, recent injuries</li>
      <li><strong>Auto-dispatch уведомлений</strong> тренеру и атлету через Resend</li>
      <li><strong>Recommendations entity</strong> — full CRUD с lifecycle (active / acknowledged / expired)</li>
      <li><strong>Cron expire-stale</strong> — автоматическое закрытие неподтверждённых рекомендаций</li>
      <li><strong>152-ФЗ совместимо</strong> — RLS изолирует данные пациента</li>
    </ul>

    <p style="margin:24px 0 12px 0;color:#0F172A;font-size:15px;line-height:1.5;font-weight:600">
      Хотите вести медицинскую документацию атлетов в одной системе?
    </p>
    <p style="margin:0">
      <a href="${BASE_URL}/auth/register?utm_source=drip&utm_medium=email&utm_campaign=medical-summary" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#8B5CF6,#A21CAF);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Открыть Sporteo бесплатно →
      </a>
    </p>
    <p style="margin:18px 0 0 0;color:#94A3B8;font-size:11px;line-height:1.5">
      Free для индивидуальной практики. Pro tier — если работаете в клубе/команде.
    </p>
  `
  return { subject, html: wrap(subject, `Medical Summary follow-up`, inner, '#7C3AED') }
}

// ── Dispatcher ─────────────────────────────────────────────────────────

export type LeadDripSource = 'team-risk' | 'adaptive-plan' | 'club-audit' | 'medical-summary'
export type LeadDripVariant = 'a' | 'b'
export type LeadDripTouch = 1 | 2 | 3

export interface LeadDripInput {
  source:  LeadDripSource
  payload: Record<string, unknown> | null | undefined
  /** Sprint W6 Day 32: A/B test variant. Defaults to 'a' for back-compat. */
  variant?: LeadDripVariant
  /** Sprint W7 Day 35: drip cadence touch number. Defaults to 1. */
  touch?:  LeadDripTouch
}

/**
 * Subject prefix per touch — escalates urgency without changing the body.
 * Touch 1 = original (no prefix). Touch 2 = "Напоминание · …". Touch 3 =
 * "Последнее напоминание · …". Keeps subject the only A/B variable while
 * the cadence-prefix is additive.
 */
const TOUCH_SUBJECT_PREFIX: Record<LeadDripTouch, string> = {
  1: '',
  2: 'Напоминание · ',
  3: 'Последнее напоминание · ',
}

/**
 * Subject re-framings for variant B. Same source, slightly different
 * angle so we can A/B-test which subject pattern lands better.
 *   A: declarative — "5 способов автоматизировать risk monitoring..."
 *   B: question / curiosity hook — "Знаете ли вы где скрытые риски..."
 *
 * Keep variants directionally different but not so different that
 * results become uninterpretable. Subject is the highest-leverage
 * difference (drives open rate); body stays identical.
 */
const VARIANT_B_SUBJECTS: Record<LeadDripSource, string> = {
  'team-risk':       'Знаете ли вы где скрытые риски в вашей команде?',
  'adaptive-plan':   'Что если ваш тренировочный план перестроится сам?',
  'club-audit':      'Готов ли ваш клуб к национальному уровню?',
  'medical-summary': 'Хотите single-source-of-truth для медицинской документации?',
}

/**
 * Single dispatcher по source. Cron iterates leads и вызывает эту функцию.
 * Возвращает null если source не имеет drip template (acwr / overtraining /
 * templates / other — старые W1 sources, для них drip не подготовлен).
 *
 * Sprint W6 Day 32: variant param swaps the subject line only (body
 * identical). Tracked via tool_leads.payload.ab_variant for /admin/ab-tests.
 */
export function renderLeadDrip(input: LeadDripInput): { subject: string; html: string } | null {
  const out = (() => {
    switch (input.source) {
      case 'team-risk':       return renderTeamRiskDrip(input.payload as TeamRiskDripPayload)
      case 'adaptive-plan':   return renderAdaptivePlanDrip(input.payload as AdaptivePlanDripPayload)
      case 'club-audit':      return renderClubAuditDrip(input.payload as ClubAuditDripPayload)
      case 'medical-summary': return renderMedicalSummaryDrip(input.payload as MedicalSummaryDripPayload)
    }
  })()
  if (!out) return null
  if (input.variant === 'b') {
    out.subject = VARIANT_B_SUBJECTS[input.source]
  }
  // Sprint W7 Day 35: cadence prefix (touch 2/3 only).
  const touch = input.touch ?? 1
  if (touch > 1) {
    out.subject = TOUCH_SUBJECT_PREFIX[touch] + out.subject
  }
  return out
}
