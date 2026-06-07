/**
 * lib/plans.ts — централизованная tariff/plan model (sidebar этап 12).
 *
 * До этого PR'а tier-логика жила в трёх изолированных местах:
 *   - `lib/ai/plan-gate.ts` — серверный AI gate (HTTP 402 + paywall payload)
 *   - `services/billing.service.ts` — формат заказа в YooKassa
 *   - inline в API routes — `subscriptions.plan` lookup без типа
 *
 * Этот файл — единый источник правды для проверок «может ли user
 * использовать фичу X». Каждая UI gate (sidebar/MobileBottomNav)
 * и каждая server gate (API route) должна идти через него.
 *
 * Иерархия (rank возрастает с tier):
 *   free → pro → team → club → federation → enterprise
 *
 * Любой не-free plan считается paid. Это backward-compat с
 * `lib/ai/plan-gate.ts`, где префиксная проверка `pro|team|club|federation|enterprise`
 * жила раньше. Добавление нового tier'а — одно изменение в PLAN_RANK.
 */

/** Все возможные plans в системе. NULL/unknown в БД маппится в 'free'. */
export type Plan =
  | 'free'
  | 'pro'
  | 'team'
  | 'club'
  | 'federation'
  | 'enterprise'

/** Только платные plans (subset Plan). */
export type PaidPlan = Exclude<Plan, 'free'>

/**
 * Иерархия tier'ов. Чем больше число, тем выше plan. Используется в
 * `meetsRequiredPlan` для лесенки «pro покрывает требование 'pro', team
 * покрывает 'pro' И 'team', и т.д.».
 */
const PLAN_RANK: Record<Plan, number> = {
  free:       0,
  pro:        1,
  team:       2,
  club:       3,
  federation: 4,
  enterprise: 5,
}

/**
 * Парсит сырое строковое значение из `subscriptions.plan` в типизированный Plan.
 * NULL / undefined / неизвестное значение → 'free' (безопасный default).
 *
 * Полезно как раз потому что генерируемые supabase-types возвращают
 * `plan: string | null` без сужения.
 */
export function parsePlan(raw: string | null | undefined): Plan {
  if (!raw) return 'free'
  const lc = raw.toLowerCase().trim()
  // Префиксная проверка для совместимости с историческими вариантами
  // (pro_athlete, pro_trainer, team_trainer и т.д. — см. lib/ai/plan-gate.ts).
  if (lc === 'free') return 'free'
  if (lc === 'pro' || lc.startsWith('pro_'))                 return 'pro'
  if (lc === 'team' || lc.startsWith('team_'))               return 'team'
  if (lc === 'club' || lc.startsWith('club_'))               return 'club'
  if (lc === 'federation' || lc.startsWith('federation_'))   return 'federation'
  if (lc === 'enterprise' || lc.startsWith('enterprise_'))   return 'enterprise'
  return 'free'
}

/** True если plan не free. */
export function isPaidPlan(plan: Plan): boolean {
  return plan !== 'free'
}

/**
 * Удовлетворяет ли текущий plan требованию. team удовлетворяет 'pro',
 * club удовлетворяет 'team' и т.д.
 */
export function meetsRequiredPlan(current: Plan, required: PaidPlan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required]
}

/**
 * subscriptions.status считается «активным» когда:
 *   - NULL (legacy строки без status — считаем активными для не-ломания)
 *   - 'active'
 *   - 'trial' (триал не должен закрывать доступ — иначе trial бесполезен)
 *
 * Истёкшие/отменённые статусы (expired, cancelled, paused) → false,
 * даже если plan выглядит платным.
 */
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status == null || status === 'active' || status === 'trial'
}

/**
 * High-level helper для UI gates. Берёт сырые данные из subscriptions row
 * (plan + status) и возвращает effective Plan: free если status неактивный,
 * иначе как есть.
 */
export function resolveEffectivePlan(opts: {
  plan:   string | null | undefined
  status: string | null | undefined
}): Plan {
  if (!isSubscriptionActive(opts.status)) return 'free'
  return parsePlan(opts.plan)
}
