/**
 * Типы AI Gateway ролевых ассистентов Sporteo (server + shared).
 *
 * Архитектура: Frontend → /api/assistant/* → Gateway → Role Policy →
 * Context Builder → Provider Adapter. Роль/организация/доступ к сущностям
 * определяются ТОЛЬКО на сервере; клиентские идентификаторы всегда
 * перепроверяются object-level проверками.
 */

/** Роли с включённым ассистентом. Остальные (admin, parent-связи) — выключен. */
export type AssistantRole = 'athlete' | 'coach' | 'doctor' | 'organization'

export type AssistantContextType = 'athlete' | 'patient' | 'organization'

export interface RoleProfile {
  role: AssistantRole
  /** Ролевое название в интерфейсе. */
  displayName: string
  /** Короткое описание возможностей под заголовком. */
  tagline: string
  /** 3–5 стартовых подсказок. */
  starterPrompts: string[]
  /** Какие контекстные сущности роль может выбирать. */
  allowedContextTypes: AssistantContextType[]
}

/** Конфиг AI из tariffs.ai_config (источник истины — БД, это дефолты-фоллбек). */
export interface AiTariffConfig {
  enabled: boolean
  monthly_requests: number
  max_output_tokens: number
  history_enabled: boolean
  context_depth: 'basic' | 'role' | 'role_extended' | 'org_rbac'
  streaming: boolean
  org_pool?: boolean
  per_user_soft_limit?: number
}

export interface UsageState {
  limit: number
  used: number
  remaining: number
  /** ISO-дата следующего сброса (начало следующего месяца). */
  resetsAt: string
  scope: 'user' | 'org'
  /** Для орг-пула: персональный soft-limit и личный расход. */
  softLimit?: number
  usedByMe?: number
}

export interface AssistantCapabilities {
  available: boolean
  /** Причина недоступности (человекочитаемая), если available=false. */
  unavailableReason?: string
  role?: AssistantRole
  assistantName?: string
  tagline?: string
  starterPrompts?: string[]
  allowedContextTypes?: AssistantContextType[]
  historyEnabled?: boolean
  streaming?: boolean
  maxMessageLength: number
  usage?: UsageState
  upgrade?: { cta: string; href: string }
}

export interface ConversationSummary {
  id: string
  title: string | null
  context_type: AssistantContextType | null
  context_entity_id: string | null
  updated_at: string
}

export interface AssistantMessage {
  id: string
  sender_type: 'user' | 'assistant'
  content: string
  status: 'ok' | 'stopped' | 'error'
  created_at: string
}
