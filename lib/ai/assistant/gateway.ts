/**
 * AI Gateway — общий серверный слой роутов /api/assistant/*.
 *
 * Каждый запрос проходит одну и ту же цепочку:
 *   сессия → users-строка → Role Policy → тариф (AISubscriptionGuard) →
 *   [объектные проверки контекста] → [квота] → Context Builder →
 *   Provider Adapter → персист → списание ТОЛЬКО после успеха → аудит.
 *
 * SERVER-ONLY. Роль/организация/доступ — только отсюда, клиенту не верим.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAssistantProfile } from './policy'
import { resolveAiAccess } from './tariff'
import { resolveMyOrganization } from './context'
import { getUsageState } from './usage'
import type { AssistantCapabilities, RoleProfile, AiTariffConfig } from './types'
import type { UsageScope } from './usage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

export const MAX_MESSAGE_LENGTH = 2000

export interface AssistantActor {
  sb: Sb
  admin: Sb
  userId: string
  userName: string | null
  role: string | null
  profile: RoleProfile | null
  config: AiTariffConfig
  tariffCode: string
  /** Скоуп списания: орг-пул для club-тарифа владельца/админа организации. */
  usageScope: UsageScope
}

export type ActorResult =
  | { ok: true; actor: AssistantActor }
  | { ok: false; status: number; error: string }

/** Аутентификация + роль + тариф + скоуп квоты. Общий вход всех роутов. */
export async function resolveActor(): Promise<ActorResult> {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, status: 401, error: 'Войдите в аккаунт.' }

  const { data: meRaw } = await sb
    .from('users')
    .select('id, name, role')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRaw as { id: string; name: string | null; role: string | null } | null
  if (!me) return { ok: false, status: 404, error: 'Профиль не найден.' }

  const admin = createAdminClient()
  const profile = resolveAssistantProfile(me.role)
  const { config, tariffCode } = await resolveAiAccess(sb, me.id)

  // Орг-пул: тариф с org_pool + пользователь принадлежит организации →
  // расход идёт из общего пула организации.
  let usageScope: UsageScope = { scope: 'user', userId: me.id, organizationId: null }
  if (config.org_pool) {
    const orgId = await resolveMyOrganization(sb, me.id)
    if (orgId) usageScope = { scope: 'org', userId: me.id, organizationId: orgId }
  }

  return {
    ok: true,
    actor: {
      sb, admin,
      userId: me.id, userName: me.name, role: me.role,
      profile, config, tariffCode, usageScope,
    },
  }
}

/** Сборка ответа GET /api/assistant/capabilities. */
export async function buildCapabilities(actor: AssistantActor): Promise<AssistantCapabilities> {
  if (!actor.profile) {
    return {
      available: false,
      unavailableReason: 'AI-помощник недоступен для вашей роли.',
      maxMessageLength: MAX_MESSAGE_LENGTH,
    }
  }
  if (!actor.config.enabled) {
    return {
      available: false,
      unavailableReason: 'AI-помощник не входит в ваш тариф.',
      maxMessageLength: MAX_MESSAGE_LENGTH,
      upgrade: { cta: 'Подключить тариф с AI', href: '/pricing' },
    }
  }
  const usage = await getUsageState(actor.admin, actor.usageScope, actor.config)
  return {
    available: true,
    role: actor.profile.role,
    assistantName: actor.profile.displayName,
    tagline: actor.profile.tagline,
    starterPrompts: actor.profile.starterPrompts,
    allowedContextTypes: actor.profile.allowedContextTypes,
    historyEnabled: actor.config.history_enabled,
    streaming: actor.config.streaming,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    usage,
    upgrade: actor.tariffCode === 'free'
      ? { cta: 'Больше запросов — в Pro', href: '/pricing' }
      : undefined,
  }
}

/** Аудит доступа — fire-and-forget, без чувствительного текста. */
export function auditEvent(
  admin: Sb,
  e: {
    userId: string
    organizationId?: string | null
    role: string
    action: string
    contextType?: string | null
    contextEntityId?: string | null
    result: 'allowed' | 'denied' | 'error'
    riskFlags?: Record<string, unknown>
  },
): void {
  void admin.from('ai_audit_events').insert({
    user_id:           e.userId,
    organization_id:   e.organizationId ?? null,
    role:              e.role,
    action:            e.action,
    context_type:      e.contextType ?? null,
    context_entity_id: e.contextEntityId ?? null,
    result:            e.result,
    risk_flags:        e.riskFlags ?? null,
  }).then(({ error }: { error: { message: string } | null }) => {
    if (error) console.warn('[ai-audit]', error.message)
  })
}
