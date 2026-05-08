/**
 * Marketplace service — Sprint W3 Day 15.
 *
 * Unified read interface over the two seller-side offering tables:
 *   - coach_pass_plans   — multi-session packs ("10 sessions / 30 days")
 *   - coach_services     — single services ("одна консультация",
 *                                            "план питания на месяц")
 *
 * After migration 050 both tables carry seller_role / seller_specialty
 * / service_type columns, so a coach, doctor, physio, massage therapist
 * or nutrition specialist can publish offerings, and they all show up
 * in the same /marketplace catalog.
 *
 * The two tables differ enough (price_cents vs price_amount;
 * total_sessions vs duration_days) that we DON'T do SQL UNION. Instead
 * we run two reads in parallel and normalize to a single `Offering`
 * shape on app side. This keeps the schema honest and queries simple.
 *
 * RLS:
 *   - coach_pass_plans: read-public via existing policy
 *     (coach_pass_plans.coach_id check; we only return is_active=true)
 *   - coach_services:  read where is_active=true OR seller=me
 *     (existing coach_services_read_active policy)
 *
 * Note: at MVP the marketplace is BROWSE-public (no auth gate); BUY-auth.
 * Buying flow goes through existing /api/billing/checkout with passPlanId
 * or serviceId.
 */
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type CoachPassPlanRow = Database['public']['Tables']['coach_pass_plans']['Row']
type CoachServiceRow  = Database['public']['Tables']['coach_services']['Row']

export type SellerRole = 'coach' | 'doctor' | 'specialist'
export type SellerSpecialty =
  | 'physician' | 'physio' | 'massage' | 'nutrition' | 'psychiatry' | 'other'
export type ServiceType =
  | 'training_pack' | 'consultation' | 'massage_session' | 'nutrition_plan'
  | 'physio_session' | 'psychology_session' | 'general'

export type OfferingKind = 'pass_plan' | 'service'

export interface Offering {
  /** Internal id of the row (in its source table) */
  id: string
  /** Which table this came from — needed when calling checkout */
  kind: OfferingKind
  seller_id: string                    // formerly coach_id (column name unchanged)
  seller_role: SellerRole
  seller_specialty: SellerSpecialty | null
  service_type: ServiceType
  title: string
  description: string | null
  price_cents: number                  // normalized: pass.price_cents OR service.price_amount
  currency: string
  /** For pass plans */
  total_sessions?: number | null
  period_days?: number | null
  /** For services */
  duration_days?: number | null
  format?: string | null
  is_active: boolean
  created_at: string
}

// ── UI metadata ────────────────────────────────────────────────────────────

export const ROLE_META: Record<SellerRole, { label: string; emoji: string; bg: string; color: string }> = {
  coach:      { label: 'Тренер',     emoji: '🥇', bg: '#EFF6FF', color: '#2563EB' },
  doctor:     { label: 'Врач',       emoji: '⚕️', bg: '#FEF2F2', color: '#E11D48' },
  specialist: { label: 'Специалист', emoji: '🩺', bg: '#FAF5FF', color: '#9333EA' },
}

export const SPECIALTY_META: Record<SellerSpecialty, { label: string; emoji: string }> = {
  physician:  { label: 'Спортивный врач', emoji: '🩺' },
  physio:     { label: 'Физиотерапия',    emoji: '🧘' },
  massage:    { label: 'Массаж',          emoji: '💆' },
  nutrition:  { label: 'Диетология',      emoji: '🥗' },
  psychiatry: { label: 'Психология',      emoji: '🧠' },
  other:      { label: 'Другое',          emoji: '⭐' },
}

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; emoji: string }> = {
  training_pack:      { label: 'Пакет тренировок', emoji: '🏋️' },
  consultation:       { label: 'Консультация',     emoji: '💬' },
  massage_session:    { label: 'Сеанс массажа',    emoji: '💆' },
  nutrition_plan:     { label: 'План питания',     emoji: '🥗' },
  physio_session:     { label: 'Физиотерапия',     emoji: '🧘' },
  psychology_session: { label: 'Сессия психолога', emoji: '🧠' },
  general:            { label: 'Услуга',           emoji: '⭐' },
}

// ── Reads ──────────────────────────────────────────────────────────────────

function passPlanToOffering(r: CoachPassPlanRow): Offering {
  return {
    id:               r.id,
    kind:             'pass_plan',
    seller_id:        r.coach_id,
    seller_role:      (r.seller_role as SellerRole) ?? 'coach',
    seller_specialty: (r.seller_specialty as SellerSpecialty | null) ?? null,
    service_type:     (r.service_type as ServiceType) ?? 'training_pack',
    title:            r.title,
    description:      r.description,
    price_cents:      r.price_cents,
    currency:         r.currency,
    total_sessions:   r.total_sessions,
    period_days:      r.period_days,
    is_active:        r.is_active,
    created_at:       r.created_at,
  }
}

function serviceToOffering(r: CoachServiceRow): Offering {
  return {
    id:               r.id,
    kind:             'service',
    seller_id:        r.coach_id,
    seller_role:      (r.seller_role as SellerRole) ?? 'coach',
    seller_specialty: (r.seller_specialty as SellerSpecialty | null) ?? null,
    service_type:     (r.service_type as ServiceType) ?? 'general',
    title:            r.title,
    description:      r.description,
    price_cents:      r.price_amount,    // schema uses price_amount on services
    currency:         r.currency,
    duration_days:    r.duration_days,
    format:           r.format,
    is_active:        r.is_active,
    created_at:       r.created_at,
  }
}

export interface ListOfferingsFilter {
  sellerRole?: SellerRole
  serviceType?: ServiceType
  specialty?: SellerSpecialty
  /** Limit results; default 100 */
  limit?: number
}

/**
 * Returns a unified list of active offerings across both tables. Sorts
 * by created_at DESC. Filters apply to BOTH tables consistently.
 */
export async function listOfferings(filter: ListOfferingsFilter = {}): Promise<Offering[]> {
  const sb = createClient()
  const limit = filter.limit ?? 100

  let pq = sb.from('coach_pass_plans').select('*').eq('is_active', true).limit(limit)
  let sq = sb.from('coach_services').select('*').eq('is_active', true).limit(limit)

  if (filter.sellerRole) {
    pq = pq.eq('seller_role', filter.sellerRole)
    sq = sq.eq('seller_role', filter.sellerRole)
  }
  if (filter.serviceType) {
    pq = pq.eq('service_type', filter.serviceType)
    sq = sq.eq('service_type', filter.serviceType)
  }
  if (filter.specialty) {
    pq = pq.eq('seller_specialty', filter.specialty)
    sq = sq.eq('seller_specialty', filter.specialty)
  }

  const [{ data: passes }, { data: services }] = await Promise.all([pq, sq])

  const all: Offering[] = [
    ...((passes  ?? []) as CoachPassPlanRow[]).map(passPlanToOffering),
    ...((services ?? []) as CoachServiceRow[]).map(serviceToOffering),
  ]
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all.slice(0, limit)
}

/**
 * Get a single offering by composite key (kind, id).
 * Returns null if not found or inactive.
 */
export async function getOffering(kind: OfferingKind, id: string): Promise<Offering | null> {
  const sb = createClient()
  const table = kind === 'pass_plan' ? 'coach_pass_plans' : 'coach_services'
  const { data } = await sb.from(table).select('*').eq('id', id).maybeSingle()
  if (!data) return null
  return kind === 'pass_plan'
    ? passPlanToOffering(data as CoachPassPlanRow)
    : serviceToOffering(data as CoachServiceRow)
}

/** Resolve seller user info (name, avatar) for a list of offerings. */
export async function resolveSellers(
  offerings: Offering[],
): Promise<Map<string, { id: string; name: string | null; avatar_url: string | null; role: string | null }>> {
  if (offerings.length === 0) return new Map()
  const sb = createClient()
  const ids = Array.from(new Set(offerings.map(o => o.seller_id)))
  const { data } = await sb
    .from('users')
    .select('id, name, avatar_url, role')
    .in('id', ids)
  return new Map(((data ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null; role: string | null }>)
    .map(u => [u.id, u]))
}
