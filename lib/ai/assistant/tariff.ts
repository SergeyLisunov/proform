/**
 * AISubscriptionGuard — резолв AI-конфига по подписке пользователя.
 *
 * Источник истины лимитов — tariffs.ai_config (правится в БД без кода);
 * DEFAULT_* здесь — только фоллбек для тарифов без конфига. Активность
 * подписки считается через lib/plans.isSubscriptionActive (включая
 * trialing/past_due-грейс) — единый источник с остальными гейтами.
 */
import { isSubscriptionActive } from '@/lib/plans'
import type { AiTariffConfig } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

export const DEFAULT_FREE_CONFIG: AiTariffConfig = {
  enabled: true,
  monthly_requests: 20,
  max_output_tokens: 400,
  history_enabled: false,
  context_depth: 'basic',
  streaming: true,
}

const DEFAULT_PAID_CONFIG: AiTariffConfig = {
  enabled: true,
  monthly_requests: 100,
  max_output_tokens: 500,
  history_enabled: true,
  context_depth: 'role',
  streaming: true,
}

export function normalizeAiConfig(raw: unknown, paidFallback: boolean): AiTariffConfig {
  const base = paidFallback ? DEFAULT_PAID_CONFIG : DEFAULT_FREE_CONFIG
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AiTariffConfig>
  return {
    enabled:            typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    monthly_requests:   Number.isFinite(r.monthly_requests) ? Math.max(0, Number(r.monthly_requests)) : base.monthly_requests,
    max_output_tokens:  Number.isFinite(r.max_output_tokens) ? Math.max(100, Number(r.max_output_tokens)) : base.max_output_tokens,
    history_enabled:    typeof r.history_enabled === 'boolean' ? r.history_enabled : base.history_enabled,
    context_depth:      r.context_depth ?? base.context_depth,
    streaming:          typeof r.streaming === 'boolean' ? r.streaming : base.streaming,
    org_pool:           r.org_pool === true,
    per_user_soft_limit: Number.isFinite(r.per_user_soft_limit) ? Number(r.per_user_soft_limit) : undefined,
  }
}

export interface ResolvedAiAccess {
  config: AiTariffConfig
  tariffCode: string
}

/**
 * Подписка пользователя → действующий AI-конфиг. Нет подписки/неактивна →
 * free-конфиг (без создания параллельной тарифной системы).
 */
export async function resolveAiAccess(sb: Sb, userId: string): Promise<ResolvedAiAccess> {
  const { data: subRaw } = await sb
    .from('subscriptions')
    .select('tariff_code, plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  const sub = subRaw as { tariff_code: string | null; plan: string | null; status: string | null } | null

  const active = !!sub && isSubscriptionActive(sub.status)
  const tariffCode = (active && (sub?.tariff_code ?? sub?.plan)) || 'free'

  const { data: tariffRaw } = await sb
    .from('tariffs')
    .select('code, ai_config')
    .eq('code', tariffCode)
    .maybeSingle()
  const tariff = tariffRaw as { code: string; ai_config: unknown } | null

  return {
    config: normalizeAiConfig(tariff?.ai_config, tariffCode !== 'free'),
    tariffCode: tariff?.code ?? 'free',
  }
}
