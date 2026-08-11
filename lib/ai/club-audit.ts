/**
 * Club Audit — Sprint W4 Day 20 (PR #36).
 *
 * Org-admin / club manager lead-magnet: "Где теряете управляемость".
 * Public flow без auth: org admin вводит structure клуба + текущие
 * процессы → AI генерирует health snapshot с risk areas, конкретными
 * recommendations и приоритетами.
 *
 * Параллельные lead-magnets:
 *   Day 18 lib/ai/team-risk.ts          (coach target)
 *   Day 19 lib/ai/adaptive-plan-preview (athlete target)
 *   Day 20 (this)                        (org-admin target)
 *
 * Heuristic stub fallback компьютит:
 *   - Churn rate (departed_90d / total_athletes)
 *   - Coach load (active_athletes / coaches_count) — target ~15
 *   - Session compliance (actual / target)
 *   - Tracking method risks (paper/whatsapp = высокий риск; app = низкий)
 *
 * Health score (0-100) = weighted combination этих факторов.
 */
import { z } from 'zod'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/gemma'

// ── Public input shape ─────────────────────────────────────────────────

export const TrackingMethodSchema = z.enum([
  'app',          // Какой-то полноценный sport SaaS
  'excel',        // Google Sheets / Excel
  'whatsapp',     // Чаты / messenger
  'paper',        // Бумага / тетради
  'none',         // Никак не трекают
  'other',
])

export const PainPointSchema = z.enum([
  'retention',           // Атлеты уходят без предупреждения
  'coach_overload',      // Тренеры перегружены
  'data_visibility',     // Нет видимости качества тренировок
  'schedule_chaos',      // Сложно координировать расписание
  'parent_communication',// Сложно общаться с родителями
  'medical_tracking',    // Медицинские допуски не отслеживаются
  'billing_chaos',       // Биллинг хаотичный
  'no_growth',           // Клуб не растёт
])

export const ClubAuditInputSchema = z.object({
  club_name:               z.string().max(120).optional(),
  primary_sport:           z.string().min(1).max(60),
  total_athletes:          z.number().int().min(1).max(10000),
  active_athletes:         z.number().int().min(0).max(10000),
  coaches_count:           z.number().int().min(1).max(500),
  departed_90d:            z.number().int().min(0).max(10000).optional(),
  avg_sessions_target:     z.number().min(0).max(20).optional(),  // sessions/week target
  avg_sessions_actual:     z.number().min(0).max(20).optional(),  // sessions/week actual
  training_tracking:       TrackingMethodSchema,
  billing_tracking:        TrackingMethodSchema,
  medical_tracking:        TrackingMethodSchema,
  pain_points:             z.array(PainPointSchema).max(8),
  monthly_revenue_rub:     z.number().min(0).max(100_000_000).optional(),
})

export type ClubAuditInput = z.infer<typeof ClubAuditInputSchema>
export type TrackingMethod = z.infer<typeof TrackingMethodSchema>
export type PainPoint      = z.infer<typeof PainPointSchema>

// ── AI output schema ───────────────────────────────────────────────────

const RiskAreaSchema = z.object({
  name:                z.string().max(60).describe('Название области риска (Retention, Coach load, Billing, ...)'),
  severity:            z.enum(['low', 'medium', 'high']),
  current_state:       z.string().max(220).describe('Что сейчас происходит (с цифрами если возможно)'),
  recommended_action:  z.string().max(220).describe('Что конкретно сделать (1-2 предложения)'),
  proform_helps_with:  z.string().max(180).optional().describe('Как Sporteo может помочь (опц., soft-sell)'),
})

export const ClubAuditReportSchema = z.object({
  health_score:               z.number().int().min(0).max(100).describe('Общий health score клуба, 0-100'),
  health_label:               z.enum(['critical', 'at-risk', 'stable', 'healthy']),
  summary:                    z.string().max(360).describe('1-2 фразы общего состояния клуба'),
  risk_areas:                 z.array(RiskAreaSchema).max(5).describe('До 5 главных областей риска'),
  top_3_priorities:           z.array(z.string().max(160)).max(3).describe('Top 3 действий на 30 дней'),
  estimated_revenue_at_risk:  z.string().max(200).optional().describe('Оценка потенциальной потери выручки (опц.)'),
  next_steps:                 z.string().max(280).describe('Конкретные next steps на 7-14 дней'),
})

export type ClubAuditReport = z.infer<typeof ClubAuditReportSchema>

// ── Heuristic computations ────────────────────────────────────────────

interface ClubMetrics {
  churn_rate_90d:           number | null   // 0..1
  coach_load:               number          // athletes per coach
  session_compliance:       number | null   // 0..1+ (actual/target)
  active_ratio:             number          // active/total
  tracking_risk_score:      number          // 0..3 (sum of 3 tracking methods)
  pain_density:             number          // pain_points / 8
  inferred_revenue_at_risk_rub: number | null
}

function computeMetrics(input: ClubAuditInput): ClubMetrics {
  const churn_rate_90d = input.departed_90d !== undefined && input.total_athletes > 0
    ? Math.min(1, input.departed_90d / input.total_athletes)
    : null

  const coach_load = input.active_athletes / Math.max(1, input.coaches_count)

  const session_compliance = (input.avg_sessions_target && input.avg_sessions_actual && input.avg_sessions_target > 0)
    ? input.avg_sessions_actual / input.avg_sessions_target
    : null

  const active_ratio = input.total_athletes > 0
    ? input.active_athletes / input.total_athletes
    : 0

  const trackingScore = (m: TrackingMethod): number => {
    switch (m) {
      case 'app':      return 0
      case 'excel':    return 1
      case 'whatsapp': return 2
      case 'paper':    return 2
      case 'none':     return 3
      case 'other':    return 1.5
    }
  }
  const tracking_risk_score =
    trackingScore(input.training_tracking) +
    trackingScore(input.billing_tracking) +
    trackingScore(input.medical_tracking)

  const pain_density = input.pain_points.length / 8

  // Очень грубая оценка — predicted churn × monthly_revenue × 12 months
  const inferred_revenue_at_risk_rub = (input.monthly_revenue_rub && churn_rate_90d !== null)
    ? Math.round(input.monthly_revenue_rub * 4 * churn_rate_90d) // ~4 quarters of churn
    : null

  return {
    churn_rate_90d,
    coach_load,
    session_compliance,
    active_ratio,
    tracking_risk_score,
    pain_density,
    inferred_revenue_at_risk_rub,
  }
}

// ── Health score (heuristic) ──────────────────────────────────────────

function computeHealthScore(m: ClubMetrics): { score: number; label: ClubAuditReport['health_label'] } {
  let score = 100

  // Churn penalty (max -30)
  if (m.churn_rate_90d !== null) {
    if (m.churn_rate_90d > 0.30)      score -= 30
    else if (m.churn_rate_90d > 0.15) score -= 18
    else if (m.churn_rate_90d > 0.08) score -= 8
  }

  // Coach load penalty (max -20)
  if (m.coach_load > 25)      score -= 20
  else if (m.coach_load > 18) score -= 12
  else if (m.coach_load < 5)  score -= 4   // under-utilized

  // Session compliance penalty (max -15)
  if (m.session_compliance !== null) {
    if (m.session_compliance < 0.6)      score -= 15
    else if (m.session_compliance < 0.8) score -= 8
  }

  // Tracking method penalty (max -20)
  // tracking_risk_score 0..9; >5 = красная зона
  if (m.tracking_risk_score > 6)      score -= 20
  else if (m.tracking_risk_score > 4) score -= 12
  else if (m.tracking_risk_score > 2) score -= 5

  // Pain density penalty (max -15)
  if (m.pain_density > 0.6)      score -= 15
  else if (m.pain_density > 0.4) score -= 9
  else if (m.pain_density > 0.2) score -= 4

  score = Math.max(0, Math.min(100, Math.round(score)))

  const label: ClubAuditReport['health_label'] =
    score < 40 ? 'critical'
    : score < 60 ? 'at-risk'
    : score < 80 ? 'stable'
    : 'healthy'

  return { score, label }
}

// ── Stub fallback (when AI not configured or fails) ───────────────────

const PAIN_LABELS: Record<PainPoint, string> = {
  retention:            'Уходящие атлеты',
  coach_overload:       'Перегруженность тренеров',
  data_visibility:      'Невидимость качества тренировок',
  schedule_chaos:       'Хаос в расписании',
  parent_communication: 'Коммуникация с родителями',
  medical_tracking:     'Медицинские допуски',
  billing_chaos:        'Хаос в биллинге',
  no_growth:            'Стагнация клуба',
}

const TRACKING_LABELS: Record<TrackingMethod, string> = {
  app:      'специализированное приложение',
  excel:    'Excel/Google Sheets',
  whatsapp: 'мессенджеры/WhatsApp',
  paper:    'бумажные документы',
  none:     'никак (полное отсутствие учёта)',
  other:    'смешанные/другие способы',
}

function ruleBased(input: ClubAuditInput): ClubAuditReport {
  const m       = computeMetrics(input)
  const { score, label } = computeHealthScore(m)
  const club    = input.club_name ?? `Клуб (${input.primary_sport})`

  const risk_areas: z.infer<typeof RiskAreaSchema>[] = []

  // Retention
  if (m.churn_rate_90d !== null && m.churn_rate_90d > 0.10) {
    risk_areas.push({
      name:               'Retention',
      severity:           m.churn_rate_90d > 0.20 ? 'high' : 'medium',
      current_state:      `${Math.round(m.churn_rate_90d * 100)}% атлетов ушло за последние 90 дней (${input.departed_90d} из ${input.total_athletes}).`,
      recommended_action: 'Запустить early-warning систему: атлет не пришёл 2 недели подряд → автоматическое уведомление администратору + триггер для разговора.',
      proform_helps_with: 'Sporteo Org Dashboard показывает at-risk атлетов через recovery + missed sessions trends.',
    })
  }

  // Coach load
  if (m.coach_load > 18 || m.coach_load < 5) {
    const heavy = m.coach_load > 18
    risk_areas.push({
      name:               'Coach load',
      severity:           m.coach_load > 25 ? 'high' : 'medium',
      current_state:      heavy
        ? `Каждый тренер ведёт ~${Math.round(m.coach_load)} атлетов. Sweet-spot для качества = 12-15.`
        : `Тренеры под-загружены (${Math.round(m.coach_load)} атлетов на тренера). Capacity не используется.`,
      recommended_action: heavy
        ? 'Нанять помощников или рассмотреть group-tier подход для базовой работы; senior coaches фокусируются на топ-атлетах.'
        : 'Запустить acquisition campaign для заполнения capacity; либо снизить число тренеров.',
      proform_helps_with: 'Sporteo roster matrix показывает athletes-per-coach ratio в реальном времени.',
    })
  }

  // Session compliance
  if (m.session_compliance !== null && m.session_compliance < 0.85) {
    risk_areas.push({
      name:               'Качество посещаемости',
      severity:           m.session_compliance < 0.65 ? 'high' : 'medium',
      current_state:      `Выполнение плана тренировок: ${Math.round(m.session_compliance * 100)}% от целевого. Атлеты пропускают 1-2 сессии в неделю.`,
      recommended_action: 'Внедрить трекинг посещаемости и автоматические follow-up уведомления при пропуске; еженедельный отчёт админу.',
      proform_helps_with: 'Sporteo logs все sessions с completion_status; cron уведомляет о тренде пропусков.',
    })
  }

  // Tracking methods
  if (m.tracking_risk_score > 4) {
    const methods = [
      `тренировки: ${TRACKING_LABELS[input.training_tracking]}`,
      `биллинг: ${TRACKING_LABELS[input.billing_tracking]}`,
      `мед.допуски: ${TRACKING_LABELS[input.medical_tracking]}`,
    ].join(' · ')
    risk_areas.push({
      name:               'Учёт операций',
      severity:           m.tracking_risk_score > 6 ? 'high' : 'medium',
      current_state:      `Текущий учёт: ${methods}. Данные распылены, риск потери информации, audit невозможен.`,
      recommended_action: 'Перейти на единую платформу: один источник истины для тренировок + биллинга + мед.допусков. Это снимает 70% операционного хаоса.',
      proform_helps_with: 'Sporteo объединяет тренировки, оплаты, и медданные в одной БД с RLS-политиками для приватности.',
    })
  }

  // Pain points
  if (input.pain_points.length > 0) {
    const top3Pains = input.pain_points.slice(0, 3).map(p => PAIN_LABELS[p]).join(', ')
    risk_areas.push({
      name:               'Заявленные боли',
      severity:           input.pain_points.length > 4 ? 'high' : 'medium',
      current_state:      `Вы отметили ${input.pain_points.length} болевые точки: ${top3Pains}${input.pain_points.length > 3 ? ' и др.' : ''}`,
      recommended_action: 'Сфокусироваться на top-2 болях квартала. Не пытаться решить всё одновременно — это требует фокуса.',
    })
  }

  // Top 3 priorities
  const priorities: string[] = []
  if (m.churn_rate_90d !== null && m.churn_rate_90d > 0.15) {
    priorities.push('Запустить retention loop: ежемесячный 1:1 с at-risk атлетами + автоматизированный outreach')
  }
  if (m.tracking_risk_score > 5) {
    priorities.push('Переход с paper/whatsapp на единый софт для tracking — даёт visibility и аудит')
  }
  if (m.coach_load > 20) {
    priorities.push('Раз грузка тренеров: либо нанять, либо ввести group-sessions для базовой работы')
  }
  if (priorities.length === 0) {
    priorities.push('Установить регулярный квартальный self-audit (как этот) для мониторинга')
    priorities.push('Сфокусироваться на data-driven решениях: проверять каждое решение через метрики')
    priorities.push('Документировать SOP-процессы (запись на тренировку, биллинг, мед.допуск)')
  }
  while (priorities.length < 3) priorities.push('Использовать Sporteo для централизованного управления операциями клуба')

  const summary = label === 'critical'
    ? `${club}: критическое состояние (score ${score}/100). ${risk_areas.length} области требуют немедленного внимания.`
    : label === 'at-risk'
      ? `${club}: уязвимое состояние (score ${score}/100). Несколько areas требуют действий в ближайшие 30 дней.`
      : label === 'stable'
        ? `${club}: стабильное состояние (score ${score}/100). Есть точки для оптимизации, но критичных проблем нет.`
        : `${club}: здоровое состояние (score ${score}/100). Большинство процессов в порядке, можно фокусироваться на росте.`

  const estimated_revenue_at_risk = m.inferred_revenue_at_risk_rub !== null
    ? `~${Math.round(m.inferred_revenue_at_risk_rub / 1000)}К руб/год от текущей churn rate (если не вмешаться).`
    : undefined

  const next_steps = label === 'critical' || label === 'at-risk'
    ? 'В ближайшие 7-14 дней: 1) Поднять precise данные по retention; 2) Один процесс перевести на структурированный учёт; 3) Согласовать с тренерами early-warning систему.'
    : 'В ближайшие 14-30 дней: 1) Проверить текущие метрики через self-audit; 2) Усилить top-1 risk area; 3) Документировать процессы для масштабирования.'

  return {
    health_score:              score,
    health_label:              label,
    summary,
    risk_areas:                risk_areas.slice(0, 5),
    top_3_priorities:          priorities.slice(0, 3),
    estimated_revenue_at_risk,
    next_steps,
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  stub?: boolean
}

export async function analyzeClubAudit(
  input: ClubAuditInput,
  opts: AnalyzeOptions = {},
): Promise<ClubAuditReport> {
  if (opts.stub || !isAiConfigured()) {
    return ruleBased(input)
  }

  const m = computeMetrics(input)
  const heuristicHealth = computeHealthScore(m)

  try {
    const report = await aiObject({
      schema: ClubAuditReportSchema,
      model:  AI_MODEL_SMART,
      system: 'Ты опытный ops-директор спортивного клуба. Делаешь короткий audit "Где теряете управляемость" — конкретные цифры, никаких общих фраз. Отвечай на русском.',
      prompt: [
        `Клуб: ${input.club_name ?? input.primary_sport}.`,
        `Спорт: ${input.primary_sport}.`,
        '',
        'Структура:',
        `- Атлетов всего: ${input.total_athletes}`,
        `- Активных (платящих): ${input.active_athletes} (${Math.round(m.active_ratio * 100)}%)`,
        `- Тренеров: ${input.coaches_count}`,
        `- Coach load: ${m.coach_load.toFixed(1)} атлетов на тренера`,
        input.departed_90d !== undefined
          ? `- Ушло за 90 дней: ${input.departed_90d} (${(m.churn_rate_90d! * 100).toFixed(1)}% churn)`
          : '- Churn data не предоставлено',
        m.session_compliance !== null
          ? `- Посещаемость: ${(m.session_compliance * 100).toFixed(0)}% от целевого`
          : '- Данные посещаемости не предоставлено',
        '',
        'Текущие методы учёта:',
        `- Тренировки: ${TRACKING_LABELS[input.training_tracking]}`,
        `- Биллинг: ${TRACKING_LABELS[input.billing_tracking]}`,
        `- Мед.допуски: ${TRACKING_LABELS[input.medical_tracking]}`,
        '',
        `Заявленные боли (${input.pain_points.length}):`,
        input.pain_points.map(p => `- ${PAIN_LABELS[p]}`).join('\n') || '(не указаны)',
        '',
        input.monthly_revenue_rub
          ? `Месячный доход (примерно): ${input.monthly_revenue_rub.toLocaleString('ru-RU')} руб.`
          : '',
        '',
        `Heuristic health score (для калибровки): ${heuristicHealth.score}/100 (${heuristicHealth.label}).`,
        '',
        'Сделай audit:',
        '- health_score: 0-100 на основе churn + coach load + tracking методов + pain points',
        '- health_label: critical (<40) / at-risk (<60) / stable (<80) / healthy (80+)',
        '- summary: 1-2 фразы общего состояния',
        '- risk_areas: 3-5 областей с severity / current_state (с цифрами!) / recommended_action / proform_helps_with (опц., деликатно)',
        '- top_3_priorities: 3 действия на ближайшие 30 дней (приоритет от 1 к 3)',
        '- estimated_revenue_at_risk: оценка потенциальной потери выручки (опц.)',
        '- next_steps: что делать в первые 7-14 дней',
        '',
        'Не пиши общих фраз ("улучшить процессы"). Пиши КОНКРЕТНЫЕ действия с цифрами.',
      ].join('\n'),
      maxTokens: 2000,
    })
    return report
  } catch (e) {
    console.warn('[club-audit] AI call failed, falling back to rule-based:', e instanceof Error ? e.message : e)
    return ruleBased(input)
  }
}
