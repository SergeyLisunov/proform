/**
 * AIUsageService — месячные периоды и списание AI-запросов.
 *
 * Инварианты (продуктовые, неизменяемые):
 *   * один запрос = успешная пара «сообщение → ответ»; списание ТОЛЬКО
 *     после успешного завершения ответа;
 *   * ошибка провайдера / отказ политики / отмена до ответа — НЕ списывают;
 *   * идемпотентность: unique idempotency_key в ai_usage_events — повторная
 *     доставка одного запроса не списывает дважды;
 *   * период = календарный месяц (UTC); остаток и дата сброса видны в UI;
 *   * орг-пул (club): общий месячный лимит организации + персональный
 *     soft-limit, чтобы один пользователь не выел весь пул.
 *
 * Все записи — admin-клиентом (RLS служебных таблиц = deny all).
 */
import type { AiTariffConfig, UsageState } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

/** Границы календарного месяца (UTC) для даты. Чистая функция — тестируема. */
export function monthPeriod(now: Date): { start: string; end: string; resetsAt: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1))
  const next  = new Date(Date.UTC(y, m + 1, 1))
  const end   = new Date(Date.UTC(y, m + 1, 0))
  return {
    start:    start.toISOString().slice(0, 10),
    end:      end.toISOString().slice(0, 10),
    resetsAt: next.toISOString(),
  }
}

export interface UsageScope {
  scope: 'user' | 'org'
  userId: string
  organizationId: string | null
}

async function ensurePeriod(
  admin: Admin,
  scope: UsageScope,
  limit: number,
  now: Date,
): Promise<{ id: string; requests_used: number; request_limit: number }> {
  const p = monthPeriod(now)
  const match = scope.scope === 'user'
    ? { scope: 'user', user_id: scope.userId, period_start: p.start }
    : { scope: 'org', organization_id: scope.organizationId, period_start: p.start }

  const { data: existing } = await admin.from('ai_usage_periods')
    .select('id, requests_used, request_limit')
    .match(match)
    .maybeSingle()
  if (existing) {
    // Лимит тарифа мог измениться (upgrade/правка конфига) — обновляем
    // потолок текущего периода, расход сохраняется.
    if ((existing as { request_limit: number }).request_limit !== limit) {
      await admin.from('ai_usage_periods')
        .update({ request_limit: limit, updated_at: now.toISOString() })
        .eq('id', (existing as { id: string }).id)
    }
    return { ...(existing as { id: string; requests_used: number }), request_limit: limit }
  }

  const { data: created, error } = await admin.from('ai_usage_periods')
    .insert({
      ...match,
      period_end:    p.end,
      request_limit: limit,
      requests_used: 0,
    })
    .select('id, requests_used, request_limit')
    .single()
  if (error) {
    // Гонка двух запросов: перечитываем по unique-ключу.
    const { data: raced } = await admin.from('ai_usage_periods')
      .select('id, requests_used, request_limit')
      .match(match)
      .maybeSingle()
    if (raced) return raced as { id: string; requests_used: number; request_limit: number }
    throw new Error(`[ai-usage] period ensure failed: ${error.message}`)
  }
  return created as { id: string; requests_used: number; request_limit: number }
}

/**
 * Личный расход пользователя внутри ИМЕННО ЭТОГО орг-пула за период
 * (для soft-limit). Скоуп по organization_id обязателен: события личного
 * скоупа несут NULL, чужие пулы — другой id (ревью-находка: без фильтра
 * считались все скоупы разом).
 */
async function usedByUserThisPeriod(
  admin: Admin, userId: string, organizationId: string, periodStart: string,
): Promise<number> {
  const { count } = await admin.from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('event_type', 'request_charged')
    .gte('created_at', `${periodStart}T00:00:00Z`)
  return count ?? 0
}

export async function getUsageState(
  admin: Admin,
  scope: UsageScope,
  config: AiTariffConfig,
  now: Date = new Date(),
): Promise<UsageState> {
  const p = monthPeriod(now)
  const period = await ensurePeriod(admin, scope, config.monthly_requests, now)
  const state: UsageState = {
    limit:     period.request_limit,
    used:      period.requests_used,
    remaining: Math.max(0, period.request_limit - period.requests_used),
    resetsAt:  p.resetsAt,
    scope:     scope.scope,
  }
  if (scope.scope === 'org' && config.per_user_soft_limit && scope.organizationId) {
    state.softLimit = config.per_user_soft_limit
    state.usedByMe  = await usedByUserThisPeriod(admin, scope.userId, scope.organizationId, p.start)
  }
  return state
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: 'quota_exhausted' | 'soft_limit_exhausted' }

/** Проверка ДО запроса (ничего не списывает). */
export async function checkQuota(
  admin: Admin,
  scope: UsageScope,
  config: AiTariffConfig,
  now: Date = new Date(),
): Promise<QuotaDecision> {
  const state = await getUsageState(admin, scope, config, now)
  if (state.remaining <= 0) return { allowed: false, reason: 'quota_exhausted' }
  if (state.softLimit && (state.usedByMe ?? 0) >= state.softLimit) {
    return { allowed: false, reason: 'soft_limit_exhausted' }
  }
  return { allowed: true }
}

/**
 * Списание ПОСЛЕ успешного ответа. Идемпотентно: unique idempotency_key —
 * дубль (ретрай доставки) молча не списывает второй раз.
 */
export async function chargeRequest(
  admin: Admin,
  opts: {
    scope: UsageScope
    config: AiTariffConfig
    conversationId: string
    messageId: string
    idempotencyKey: string
    outputTokens?: number
  },
  now: Date = new Date(),
): Promise<void> {
  const { error: evErr } = await admin.from('ai_usage_events').insert({
    user_id:         opts.scope.userId,
    organization_id: opts.scope.organizationId,
    conversation_id: opts.conversationId,
    message_id:      opts.messageId,
    event_type:      'request_charged',
    units:           1,
    idempotency_key: opts.idempotencyKey,
  })
  if (evErr) {
    if (evErr.code === '23505') return // уже списано этим же ключом
    throw new Error(`[ai-usage] charge event failed: ${evErr.message}`)
  }

  const period = await ensurePeriod(admin, opts.scope, opts.config.monthly_requests, now)
  // Атомарный инкремент на стороне Postgres (миграция 101): конкурентные
  // успешные ответы не теряют обновления (ревью-находка: read-then-write
  // давал permanent undercount).
  const { error: updErr } = await admin.rpc('increment_ai_usage', { p_period_id: period.id })
  if (updErr) {
    // Событие уже записано (идемпотентный якорь) — расход восстановим
    // пересчётом событий; не роняем ответ пользователю.
    console.warn('[ai-usage] period increment failed:', updErr.message)
  }
}

/** Отказ/ошибка — журналируем БЕЗ списания (наблюдаемость + анти-abuse). */
export async function logUsageEvent(
  admin: Admin,
  opts: {
    userId: string
    organizationId: string | null
    conversationId?: string | null
    eventType: 'denied_quota' | 'denied_policy' | 'provider_error'
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.from('ai_usage_events').insert({
      user_id:         opts.userId,
      organization_id: opts.organizationId,
      conversation_id: opts.conversationId ?? null,
      event_type:      opts.eventType,
      units:           0,
      metadata:        opts.metadata ?? null,
    })
  } catch { /* наблюдаемость не должна ломать основной поток */ }
}
