/**
 * Coach pass-plans service — Sprint W8 Day 38 (PR #56).
 *
 * CRUD wrapper around `coach_pass_plans` (multi-session subscription/
 * package offerings). Parallel surface to W7 Day 34 coach_services
 * (one-off services). Marketplace already lists both via
 * marketplace.service.ts::listOfferings.
 *
 * Schema notes (differs from coach_services!):
 *   - price_cents INTEGER (CENTS, not whole RUB — convert at UI boundary)
 *   - total_sessions + period_days (sessions over a fixed window)
 *   - No updated_at column (don't include in UPDATE payload)
 *   - service_type defaults to 'training_pack'; UI exposes a small enum.
 *
 * RLS: coach_pass_plans_coach_all — coach owns ALL ops on own rows.
 * Marketplace browse (public anon) reads via separate path; not this
 * service's concern.
 */
import { createClient } from '@/lib/supabase/client'

export type PassServiceType =
  | 'training_pack'   // default — N personal sessions over M days
  | 'monthly_access'  // unlimited within period
  | 'group_pass'      // group sessions
  | 'rehab_pack'      // rehab program block

export interface CoachPassPlan {
  id:                string
  coach_id:          string
  title:             string
  description:       string | null
  total_sessions:    number          // smallint in DB
  period_days:       number          // smallint in DB
  price_cents:       number          // CENTS — convert ÷100 for display
  currency:          string          // 'RUB' default
  is_active:         boolean
  seller_specialty:  string | null
  service_type:      PassServiceType
  created_at:        string
}

// ── Display metadata ───────────────────────────────────────────────────────

export const PASS_SERVICE_TYPE_META: Record<PassServiceType, { label: string; emoji: string; hint: string }> = {
  training_pack:  { label: 'Пакет тренировок',       emoji: '📋', hint: 'N сессий за фиксированный период' },
  monthly_access: { label: 'Безлимит на месяц',      emoji: '♾️', hint: 'Без счёта сессий в течение периода' },
  group_pass:     { label: 'Групповой абонемент',     emoji: '👥', hint: 'Доступ к групповым тренировкам' },
  rehab_pack:     { label: 'Пакет реабилитации',      emoji: '🩹', hint: 'Программа восстановления после травмы' },
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Lists coach's own pass-plans (active + archived) sorted by created_at desc. */
export async function listMyPassPlans(): Promise<CoachPassPlan[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const { data, error } = await sb
    .from('coach_pass_plans')
    .select('*')
    .eq('coach_id', me.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[coach-pass-plans.listMyPassPlans]', error.message)
    return []
  }
  return ((data ?? []) as CoachPassPlan[])
}

/** Get a single pass-plan (RLS enforces ownership). */
export async function getPassPlan(id: string): Promise<CoachPassPlan | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('coach_pass_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn('[coach-pass-plans.getPassPlan]', error.message)
    return null
  }
  return (data as CoachPassPlan | null) ?? null
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreatePassPlanInput {
  title:             string
  description?:      string | null
  total_sessions:    number
  period_days:       number
  /** Whole-RUB price; service multiplies by 100 to store cents. */
  price_rub:         number
  currency?:         string
  service_type?:     PassServiceType
  seller_specialty?: string | null
}

/**
 * Create a pass-plan. Coach role + ownership enforced by RLS.
 * Price entered in whole RUB at UI layer; we convert to cents on insert.
 */
export async function createPassPlan(input: CreatePassPlanInput): Promise<CoachPassPlan | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return null
  if (me.role !== 'coach') return null

  // Validation
  if (input.title.trim().length < 3 || input.title.trim().length > 120) return null
  if (!Number.isInteger(input.total_sessions) || input.total_sessions < 1 || input.total_sessions > 365) return null
  if (!Number.isInteger(input.period_days)    || input.period_days < 1    || input.period_days < input.total_sessions) return null
  if (!Number.isFinite(input.price_rub)       || input.price_rub < 0       || input.price_rub > 1_000_000) return null

  const price_cents = Math.round(input.price_rub * 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coach_pass_plans')
    .insert({
      coach_id:         me.id,
      title:            input.title.trim(),
      description:      input.description?.trim() || null,
      total_sessions:   input.total_sessions,
      period_days:      input.period_days,
      price_cents,
      currency:         input.currency ?? 'RUB',
      service_type:     input.service_type ?? 'training_pack',
      seller_specialty: input.seller_specialty?.trim() || null,
      seller_role:      'coach',
      is_active:        true,
    })
    .select()
    .single()
  if (error) {
    console.warn('[coach-pass-plans.createPassPlan]', error.message)
    return null
  }
  return data as CoachPassPlan
}

export interface UpdatePassPlanInput {
  title?:            string
  description?:      string | null
  total_sessions?:   number
  period_days?:      number
  /** Whole-RUB. Will be converted to cents. */
  price_rub?:        number
  currency?:         string
  service_type?:     PassServiceType
  seller_specialty?: string | null
  is_active?:        boolean
}

/** Update an existing pass-plan. RLS enforces ownership. No updated_at column. */
export async function updatePassPlan(id: string, patch: UpdatePassPlanInput): Promise<CoachPassPlan | null> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {}
  if (patch.title             !== undefined) payload.title            = patch.title.trim()
  if (patch.description       !== undefined) payload.description      = patch.description?.trim() || null
  if (patch.total_sessions    !== undefined) payload.total_sessions   = patch.total_sessions
  if (patch.period_days       !== undefined) payload.period_days      = patch.period_days
  if (patch.price_rub         !== undefined) payload.price_cents      = Math.round(patch.price_rub * 100)
  if (patch.currency          !== undefined) payload.currency         = patch.currency
  if (patch.service_type      !== undefined) payload.service_type     = patch.service_type
  if (patch.seller_specialty  !== undefined) payload.seller_specialty = patch.seller_specialty?.trim() || null
  if (patch.is_active         !== undefined) payload.is_active        = patch.is_active
  // NB: no updated_at — table doesn't have it.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coach_pass_plans')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.warn('[coach-pass-plans.updatePassPlan]', error.message)
    return null
  }
  return data as CoachPassPlan
}

/** Soft delete by toggling is_active=false. */
export async function archivePassPlan(id: string): Promise<boolean> {
  const updated = await updatePassPlan(id, { is_active: false })
  return !!updated
}

/** Bring archived pass-plan back to catalog. */
export async function reactivatePassPlan(id: string): Promise<boolean> {
  const updated = await updatePassPlan(id, { is_active: true })
  return !!updated
}

/** Permanent delete. RLS enforces ownership. */
export async function deletePassPlan(id: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('coach_pass_plans').delete().eq('id', id)
  if (error) {
    console.warn('[coach-pass-plans.deletePassPlan]', error.message)
    return false
  }
  return true
}
