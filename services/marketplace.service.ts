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

export type OfferingSort = 'newest' | 'price_asc' | 'price_desc'

export interface ListOfferingsFilter {
  sellerRole?:  SellerRole
  serviceType?: ServiceType
  specialty?:   SellerSpecialty
  /** Sprint W6 Day 32: case-insensitive substring match on title/description. */
  q?:           string
  /** Sprint W6 Day 32: 'newest' (default) | 'price_asc' | 'price_desc'. */
  sort?:        OfferingSort
  /** Sprint W8 Day 42: filter by delivery format (online/offline/hybrid).
   *  Only `coach_services` has a `format` column — when this filter is set,
   *  pass_plans are excluded entirely (they have no format concept). */
  format?:      'online' | 'offline' | 'hybrid'
  /** Sprint W8 Day 42: maximum price in whole RUB. Kind-aware comparison:
   *  pass_plans store cents (divide by 100); services store whole RUB (use as-is). */
  priceMaxRub?: number
  /** Limit results; default 100 */
  limit?:       number
}

/**
 * Returns a unified list of active offerings across both tables. Filters
 * apply to BOTH tables consistently; sort happens after the merge.
 */
export async function listOfferings(filter: ListOfferingsFilter = {}): Promise<Offering[]> {
  const sb = createClient()
  const limit = filter.limit ?? 100
  const sort  = filter.sort ?? 'newest'

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
  // W6 Day 32: text search via ilike on title OR description.
  if (filter.q && filter.q.trim().length > 0) {
    const needle = `%${filter.q.trim().replace(/[%_]/g, m => `\\${m}`)}%`
    pq = pq.or(`title.ilike.${needle},description.ilike.${needle}`)
    sq = sq.or(`title.ilike.${needle},description.ilike.${needle}`)
  }

  // W8 Day 42: format filter only narrows services (pass_plans have no format column).
  // When format is set we exclude pass_plans entirely — they have no format concept.
  const skipPasses = !!filter.format
  if (filter.format) {
    sq = sq.eq('format', filter.format)
  }

  const [{ data: passes }, { data: services }] = await Promise.all([
    skipPasses ? Promise.resolve({ data: [] as CoachPassPlanRow[] }) : pq,
    sq,
  ])

  let all: Offering[] = [
    ...((passes  ?? []) as CoachPassPlanRow[]).map(passPlanToOffering),
    ...((services ?? []) as CoachServiceRow[]).map(serviceToOffering),
  ]

  // W8 Day 42: post-merge price filter with kind-aware semantics.
  // pass_plans.price_cents stores cents → /100 = RUB
  // coach_services.price_amount stores whole RUB (normalized into Offering.price_cents)
  if (typeof filter.priceMaxRub === 'number' && filter.priceMaxRub >= 0) {
    const cap = filter.priceMaxRub
    all = all.filter(o => {
      const rub = o.kind === 'pass_plan' ? Math.round(o.price_cents / 100) : o.price_cents
      return rub <= cap
    })
  }

  if (sort === 'price_asc')  all.sort((a, b) => a.price_cents - b.price_cents)
  else if (sort === 'price_desc') all.sort((a, b) => b.price_cents - a.price_cents)
  else                       all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all.slice(0, limit)
}

/**
 * Sprint W6 Day 32: returns offerings whose seller has is_featured=true.
 * Used by the /marketplace featured-carousel above the main catalog.
 * Hard cap: 6 cards (2 sellers × ~3 offerings, but typically each has 2).
 */
export async function listFeaturedOfferings(): Promise<Offering[]> {
  const sb = createClient()
  // Step 1: find featured sellers (small set, fast query).
  const { data: featuredSellers } = await sb
    .from('users')
    .select('id')
    .eq('is_featured', true)
    .limit(10)
  const featuredIds = ((featuredSellers ?? []) as Array<{ id: string }>).map(s => s.id)
  if (featuredIds.length === 0) return []

  // Step 2: fetch their active offerings.
  const [{ data: passes }, { data: services }] = await Promise.all([
    sb.from('coach_pass_plans').select('*').eq('is_active', true).in('coach_id', featuredIds).limit(6),
    sb.from('coach_services').select('*').eq('is_active', true).in('coach_id', featuredIds).limit(6),
  ])

  const all: Offering[] = [
    ...((passes  ?? []) as CoachPassPlanRow[]).map(passPlanToOffering),
    ...((services ?? []) as CoachServiceRow[]).map(serviceToOffering),
  ]
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all.slice(0, 6)
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

/** Resolve seller user info (name, avatar, demo + featured flags) for a list of offerings. */
export async function resolveSellers(
  offerings: Offering[],
): Promise<Map<string, { id: string; name: string | null; avatar_url: string | null; role: string | null; is_demo: boolean; is_featured: boolean }>> {
  if (offerings.length === 0) return new Map()
  const sb = createClient()
  const ids = Array.from(new Set(offerings.map(o => o.seller_id)))
  const { data } = await sb
    .from('users')
    .select('id, name, avatar_url, role, is_demo, is_featured')
    .in('id', ids)
  return new Map(((data ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null; role: string | null; is_demo: boolean | null; is_featured: boolean | null }>)
    .map(u => [u.id, { ...u, is_demo: u.is_demo ?? false, is_featured: u.is_featured ?? false }]))
}
