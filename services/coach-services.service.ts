/**
 * Coach services service — Sprint W7 Day 34 (PR #52).
 *
 * CRUD wrapper around the `coach_services` table. Lets real coaches
 * create marketplace offerings without a migration (W6 Day 32 seeded
 * 5 demo coaches via Migration 067; W7 Day 34 onramp lets actual users
 * grow the catalog organically).
 *
 * RLS (already applied in production):
 *   - coach_services_read_active: SELECT anyone where is_active=true,
 *     OR own coach reads regardless.
 *   - coach_services_write_own: ALL ops require coach_id = get_my_user_id().
 *
 * Price is stored in WHOLE RUB units (NOT cents) — matches existing
 * seed data + admin/commerce UI. Convert only at payment-provider boundary.
 */
import { createClient } from '@/lib/supabase/client'

export type ServiceType =
  | 'general'
  | 'consultation'
  | 'training_pack'
  | 'assessment'
  | 'nutrition_plan'
  | 'rehab'
  | 'group_training'

export type ServiceFormat = 'online' | 'offline' | 'hybrid'

export interface CoachService {
  id:                string
  coach_id:          string
  title:             string
  description:       string | null
  price_amount:      number          // RUB whole units
  currency:          string          // 'RUB' default
  duration_days:     number | null
  format:            ServiceFormat | null
  is_active:         boolean
  seller_specialty:  string | null
  service_type:      ServiceType
  created_at:        string
  updated_at:        string
}

// ── Display metadata (UI strings + icons) ──────────────────────────────────

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; emoji: string; hint: string }> = {
  general:         { label: 'Общая услуга',        emoji: '⭐', hint: 'Произвольный формат' },
  consultation:    { label: 'Консультация',        emoji: '🗣️', hint: 'Разовый разбор / Q&A' },
  training_pack:   { label: 'План тренировок',     emoji: '📋', hint: 'Программа на N недель / месяцев' },
  assessment:      { label: 'Оценка / тест',       emoji: '📊', hint: 'Performance test, ACWR, восстановление' },
  nutrition_plan:  { label: 'План питания',        emoji: '🍎', hint: 'Питание + добавки + режим' },
  rehab:           { label: 'Реабилитация',        emoji: '🩹', hint: 'После травмы / нагрузки' },
  group_training:  { label: 'Групповая тренировка',emoji: '👥', hint: 'На 2-10 человек' },
}

export const FORMAT_META: Record<ServiceFormat, { label: string; emoji: string }> = {
  online:  { label: 'Онлайн',         emoji: '💻' },
  offline: { label: 'Очно',           emoji: '🏟️' },
  hybrid:  { label: 'Гибрид',         emoji: '🔀' },
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Lists coach's own services (active + archived) sorted by created_at desc. */
export async function listMyServices(): Promise<CoachService[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const { data, error } = await sb
    .from('coach_services')
    .select('*')
    .eq('coach_id', me.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[coach-services.listMyServices]', error.message)
    return []
  }
  return ((data ?? []) as CoachService[])
}

/** Get a single service (RLS enforces ownership for non-active). */
export async function getService(id: string): Promise<CoachService | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('coach_services')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn('[coach-services.getService]', error.message)
    return null
  }
  return (data as CoachService | null) ?? null
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreateServiceInput {
  title:             string
  description?:      string | null
  price_amount:      number
  currency?:         string
  duration_days?:    number | null
  format?:           ServiceFormat | null
  service_type?:     ServiceType
  seller_specialty?: string | null
}

/**
 * Create a new offering. Coach role + ownership enforced by RLS
 * (coach_id auto-set via get_my_user_id() trigger? no — we set
 * explicitly here; RLS only checks the value matches).
 */
export async function createService(input: CreateServiceInput): Promise<CoachService | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return null
  if (me.role !== 'coach') return null

  if (input.title.trim().length < 3 || input.title.trim().length > 120) return null
  if (!Number.isInteger(input.price_amount) || input.price_amount < 0 || input.price_amount > 10_000_000) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coach_services')
    .insert({
      coach_id:         me.id,
      title:            input.title.trim(),
      description:      input.description?.trim() || null,
      price_amount:     input.price_amount,
      currency:         input.currency ?? 'RUB',
      duration_days:    input.duration_days ?? null,
      format:           input.format ?? null,
      service_type:     input.service_type ?? 'general',
      seller_specialty: input.seller_specialty?.trim() || null,
      seller_role:      'coach',
      is_active:        true,
    })
    .select()
    .single()
  if (error) {
    console.warn('[coach-services.createService]', error.message)
    return null
  }
  return data as CoachService
}

export interface UpdateServiceInput {
  title?:            string
  description?:      string | null
  price_amount?:     number
  currency?:         string
  duration_days?:    number | null
  format?:           ServiceFormat | null
  service_type?:     ServiceType
  seller_specialty?: string | null
  is_active?:        boolean
}

/** Update an existing service. RLS enforces ownership. */
export async function updateService(id: string, patch: UpdateServiceInput): Promise<CoachService | null> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {}
  if (patch.title             !== undefined) payload.title            = patch.title.trim()
  if (patch.description       !== undefined) payload.description      = patch.description?.trim() || null
  if (patch.price_amount      !== undefined) payload.price_amount     = patch.price_amount
  if (patch.currency          !== undefined) payload.currency         = patch.currency
  if (patch.duration_days     !== undefined) payload.duration_days    = patch.duration_days
  if (patch.format            !== undefined) payload.format           = patch.format
  if (patch.service_type      !== undefined) payload.service_type     = patch.service_type
  if (patch.seller_specialty  !== undefined) payload.seller_specialty = patch.seller_specialty?.trim() || null
  if (patch.is_active         !== undefined) payload.is_active        = patch.is_active
  payload.updated_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coach_services')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.warn('[coach-services.updateService]', error.message)
    return null
  }
  return data as CoachService
}

/** Soft delete by toggling is_active=false. Reversible via reactivate. */
export async function archiveService(id: string): Promise<boolean> {
  const updated = await updateService(id, { is_active: false })
  return !!updated
}

/** Bring an archived service back to the catalog. */
export async function reactivateService(id: string): Promise<boolean> {
  const updated = await updateService(id, { is_active: true })
  return !!updated
}

/** Permanent delete. RLS enforces ownership. */
export async function deleteService(id: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('coach_services').delete().eq('id', id)
  if (error) {
    console.warn('[coach-services.deleteService]', error.message)
    return false
  }
  return true
}
