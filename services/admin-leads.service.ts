/**
 * Admin Leads service — Sprint W4 Day 22 (PR #38).
 *
 * Server-side helpers для /admin/leads dashboard и /api/cron/leads-digest:
 *   - listLeads({ source?, dispatched? }) — paginated table
 *   - getFunnelStats() — aggregated counts by source × dispatched
 *   - listPendingForDispatch({ limit, maxAttempts, since }) — cron iterator
 *   - markDispatched(leadId) / markFailed(leadId, error)
 *
 * Использует createAdminClient (service role) — этот service вызывается
 * только из server-side routes, которые сами проверяют admin role.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type LeadSource =
  | 'acwr' | 'overtraining' | 'templates'
  | 'team-risk' | 'adaptive-plan' | 'club-audit' | 'medical-summary'
  | 'other'

export interface LeadRow {
  id:                  string
  email:               string
  source:              LeadSource
  payload:             Record<string, unknown> | null
  ip_hash:             string | null
  user_agent:          string | null
  created_at:          string
  email_dispatched_at: string | null
  email_attempts:      number
  email_last_error:    string | null
  // Sprint W5 Day 23 — conversion linking (migration 061)
  user_id:             string | null
  converted_at:        string | null
}

export interface ListLeadsFilter {
  source?:     LeadSource
  dispatched?: 'all' | 'pending' | 'dispatched'
  limit?:      number
  offset?:     number
}

export async function listLeads(filter: ListLeadsFilter = {}): Promise<{ rows: LeadRow[]; total: number }> {
  const admin = createAdminClient()
  const limit  = Math.min(200, Math.max(1, filter.limit  ?? 50))
  const offset = Math.max(0, filter.offset ?? 0)

  let query = admin.from('tool_leads').select('*', { count: 'exact' })
  if (filter.source) query = query.eq('source', filter.source)
  if (filter.dispatched === 'pending')    query = query.is('email_dispatched_at', null)
  if (filter.dispatched === 'dispatched') query = query.not('email_dispatched_at', 'is', null)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.warn('[admin-leads.listLeads]', error.message)
    return { rows: [], total: 0 }
  }
  return { rows: (data ?? []) as LeadRow[], total: count ?? 0 }
}

// ── Sprint W5 Day 23 — Conversion funnel ────────────────────────────

export interface ConversionFunnelStat {
  source:                  LeadSource
  total_leads:             number
  /** Leads where email_dispatched_at IS NOT NULL */
  dispatched:              number
  /** Leads where tool_leads.user_id IS NOT NULL (matched to users via trigger). */
  converted_to_users:      number
  /** Conversion rate: converted / total, в процентах */
  conversion_rate_percent: number
  /** Leads that converted AND user is on a paid subscription */
  converted_to_paid:       number
}

/**
 * Per-source funnel: total → dispatched → converted to user → converted to paid.
 * Single-roundtrip aggregation client-side. Acceptable while tool_leads < 100K.
 */
export async function getConversionFunnel(): Promise<ConversionFunnelStat[]> {
  const admin = createAdminClient()

  // 1. Pull tool_leads с user_id + converted_at
  const { data: leadsRaw, error: leadsErr } = await admin
    .from('tool_leads')
    .select('source, email_dispatched_at, converted_at, user_id')
  if (leadsErr) {
    console.warn('[admin-leads.getConversionFunnel] leads:', leadsErr.message)
    return []
  }

  const leads = (leadsRaw ?? []) as Array<{
    source:              string
    email_dispatched_at: string | null
    converted_at:        string | null
    user_id:             string | null
  }>

  // 2. Pull subscriptions для converted users (active OR trialing = "paid")
  const convertedUserIds = Array.from(new Set(
    leads.map(l => l.user_id).filter((id): id is string => !!id),
  ))
  const paidUserIds = new Set<string>()
  if (convertedUserIds.length > 0) {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', convertedUserIds)
      .in('status', ['active', 'trialing'])
    for (const s of ((subs ?? []) as Array<{ user_id: string; status: string }>)) {
      paidUserIds.add(s.user_id)
    }
  }

  // 3. Aggregate per source
  const bySource = new Map<LeadSource, ConversionFunnelStat>()
  for (const l of leads) {
    const src  = l.source as LeadSource
    const stat = bySource.get(src) ?? {
      source: src, total_leads: 0, dispatched: 0,
      converted_to_users: 0, conversion_rate_percent: 0, converted_to_paid: 0,
    }
    stat.total_leads++
    if (l.email_dispatched_at) stat.dispatched++
    if (l.user_id) {
      stat.converted_to_users++
      if (paidUserIds.has(l.user_id)) stat.converted_to_paid++
    }
    bySource.set(src, stat)
  }

  // Compute conversion rate
  for (const stat of bySource.values()) {
    stat.conversion_rate_percent = stat.total_leads > 0
      ? Math.round((stat.converted_to_users / stat.total_leads) * 1000) / 10
      : 0
  }

  return Array.from(bySource.values()).sort((a, b) => b.total_leads - a.total_leads)
}

/**
 * Lead row enriched with linked user info (when converted).
 * Used in admin/leads table to show conversion status + signup date.
 */
export interface LeadWithUserInfo extends LeadRow {
  user_name:        string | null
  user_role:        string | null
  user_created_at:  string | null
}

export async function listLeadsWithUserInfo(filter: ListLeadsFilter = {}): Promise<{ rows: LeadWithUserInfo[]; total: number }> {
  const { rows, total } = await listLeads(filter)
  if (rows.length === 0) return { rows: [], total: 0 }

  const userIds = Array.from(new Set(
    rows.map(r => r.user_id).filter((id): id is string => !!id),
  ))
  if (userIds.length === 0) {
    return {
      rows: rows.map(r => ({ ...r, user_name: null, user_role: null, user_created_at: null })),
      total,
    }
  }

  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id, name, role, created_at')
    .in('id', userIds)
  const userMap = new Map<string, { name: string | null; role: string | null; created_at: string | null }>()
  for (const u of ((users ?? []) as Array<{ id: string; name: string | null; role: string | null; created_at: string | null }>)) {
    userMap.set(u.id, { name: u.name, role: u.role, created_at: u.created_at })
  }

  return {
    rows: rows.map(r => {
      const u = r.user_id ? userMap.get(r.user_id) : null
      return {
        ...r,
        user_name:       u?.name ?? null,
        user_role:       u?.role ?? null,
        user_created_at: u?.created_at ?? null,
      }
    }),
    total,
  }
}

export interface FunnelStat {
  source:           LeadSource
  total:            number
  dispatched:       number
  pending:          number
  failed:           number
  most_recent_at:   string | null
}

/**
 * Aggregated stats per source. Single roundtrip — fetches all rows, aggregates
 * client-side. Acceptable пока tool_leads < 100K rows; иначе нужен SQL view
 * с GROUP BY. Текущий cap (Sprint W4): expecting < 1K rows total.
 */
export async function getFunnelStats(): Promise<FunnelStat[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tool_leads')
    .select('source, email_dispatched_at, email_attempts, created_at')
  if (error) {
    console.warn('[admin-leads.getFunnelStats]', error.message)
    return []
  }
  const rows = (data ?? []) as Array<{
    source:              string
    email_dispatched_at: string | null
    email_attempts:      number
    created_at:          string
  }>

  const bySource = new Map<LeadSource, FunnelStat>()
  for (const r of rows) {
    const src = r.source as LeadSource
    const stat = bySource.get(src) ?? {
      source: src, total: 0, dispatched: 0, pending: 0, failed: 0, most_recent_at: null,
    }
    stat.total++
    if (r.email_dispatched_at)        stat.dispatched++
    else if (r.email_attempts >= 3)   stat.failed++
    else                              stat.pending++
    if (!stat.most_recent_at || r.created_at > stat.most_recent_at) {
      stat.most_recent_at = r.created_at
    }
    bySource.set(src, stat)
  }

  return Array.from(bySource.values()).sort((a, b) => b.total - a.total)
}

export type DripTouch = 1 | 2 | 3

/** Sprint W7 Day 35: cadence gaps between touches (days). */
const TOUCH_GAP_DAYS: Record<2 | 3, number> = {
  2: 7,
  3: 14,
}

export interface PendingLead {
  id:       string
  email:    string
  source:   LeadSource
  payload:  Record<string, unknown> | null
  attempts: number
  /** Sprint W6 Day 29: present if lead was matched to a user via
   * `match_leads_to_user` (W5 Day 23). Used by leads-digest cron to
   * gate dispatch on users.notification_prefs.drip_marketing_email. */
  user_id:  string | null
  /** Sprint W7 Day 35: which touch is this — 1 (first), 2 (+7d), or 3 (+14d). */
  touch:    DripTouch
}

export interface PendingFilter {
  /** Max leads to return per cron run (Resend free tier limit safety). */
  limit?:       number
  /** Max attempts before giving up. Default 3. */
  maxAttempts?: number
  /** Skip leads older than this (default 30 days). */
  sinceDate?:   Date
}

interface LeadQueryRow {
  id:                  string
  email:               string
  source:              string
  payload:             Record<string, unknown> | null
  email_attempts:      number
  user_id:             string | null
  dispatched_touches:  number
  last_touch_at:       string | null
}

/**
 * Iterator для cron: leads ready for next drip touch.
 *
 * Sprint W7 Day 35 — supports 3-touch cadence:
 *   - Touch 1: never dispatched (dispatched_touches = 0)
 *   - Touch 2: one touch sent, ≥7 days ago, not yet converted
 *   - Touch 3: two touches sent, ≥14 days ago since last, not converted
 *
 * Issues 3 parallel queries (cheap thanks to partial index
 * idx_tool_leads_cadence_active), merges, sorts by created_at ASC,
 * slices to limit. Always returns the `touch` number per lead so the
 * cron renderer knows which template variant to send.
 */
export async function listPendingForDispatch(filter: PendingFilter = {}): Promise<PendingLead[]> {
  const admin = createAdminClient()
  const limit       = Math.min(100, Math.max(1, filter.limit ?? 50))
  const maxAttempts = Math.max(1, filter.maxAttempts ?? 3)
  const sinceDate   = filter.sinceDate ?? new Date(Date.now() - 30 * 24 * 3600_000)

  const dripSources: LeadSource[] = ['team-risk', 'adaptive-plan', 'club-audit', 'medical-summary']
  const cutoff2 = new Date(Date.now() - TOUCH_GAP_DAYS[2] * 24 * 3600_000).toISOString()
  const cutoff3 = new Date(Date.now() - TOUCH_GAP_DAYS[3] * 24 * 3600_000).toISOString()

  const baseSelect = 'id, email, source, payload, email_attempts, user_id, dispatched_touches, last_touch_at'

  // Touch 1: never dispatched. Filter on email_dispatched_at IS NULL preserves
  // the original semantics (lead never received anything).
  const q1 = admin
    .from('tool_leads')
    .select(baseSelect)
    .is('email_dispatched_at', null)
    .eq('dispatched_touches', 0)
    .lt('email_attempts', maxAttempts)
    .is('converted_at', null)
    .gte('created_at', sinceDate.toISOString())
    .in('source', dripSources)
    .order('created_at', { ascending: true })
    .limit(limit)

  // Touch 2: first email sent ≥7 days ago, not converted.
  const q2 = admin
    .from('tool_leads')
    .select(baseSelect)
    .eq('dispatched_touches', 1)
    .lte('last_touch_at', cutoff2)
    .is('converted_at', null)
    .lt('email_attempts', maxAttempts + 1)   // allow 1 more retry for cadence stage
    .gte('created_at', sinceDate.toISOString())
    .in('source', dripSources)
    .order('last_touch_at', { ascending: true })
    .limit(limit)

  // Touch 3: second email sent ≥14 days ago, not converted.
  const q3 = admin
    .from('tool_leads')
    .select(baseSelect)
    .eq('dispatched_touches', 2)
    .lte('last_touch_at', cutoff3)
    .is('converted_at', null)
    .lt('email_attempts', maxAttempts + 2)
    .gte('created_at', sinceDate.toISOString())
    .in('source', dripSources)
    .order('last_touch_at', { ascending: true })
    .limit(limit)

  const [r1, r2, r3] = await Promise.all([q1, q2, q3])
  if (r1.error) console.warn('[admin-leads.listPendingForDispatch touch1]', r1.error.message)
  if (r2.error) console.warn('[admin-leads.listPendingForDispatch touch2]', r2.error.message)
  if (r3.error) console.warn('[admin-leads.listPendingForDispatch touch3]', r3.error.message)

  const rows: Array<{ row: LeadQueryRow; touch: DripTouch }> = [
    ...((r1.data ?? []) as LeadQueryRow[]).map(row => ({ row, touch: 1 as DripTouch })),
    ...((r2.data ?? []) as LeadQueryRow[]).map(row => ({ row, touch: 2 as DripTouch })),
    ...((r3.data ?? []) as LeadQueryRow[]).map(row => ({ row, touch: 3 as DripTouch })),
  ]
  // Fairness: touch 2/3 leads cut to front (longer waiting); within same touch,
  // older leads first. We approximate by sorting by (touch DESC, key ASC) so
  // touches 3 and 2 don't get crowded out by a flood of touch-1 inserts.
  rows.sort((a, b) => {
    if (a.touch !== b.touch) return b.touch - a.touch  // higher touch first
    const akey = a.row.last_touch_at ?? a.row.email   // stable fallback
    const bkey = b.row.last_touch_at ?? b.row.email
    return akey < bkey ? -1 : akey > bkey ? 1 : 0
  })

  return rows.slice(0, limit).map(({ row, touch }) => ({
    id:       row.id,
    email:    row.email,
    source:   row.source as LeadSource,
    payload:  row.payload,
    attempts: row.email_attempts,
    user_id:  row.user_id ?? null,
    touch,
  }))
}

/**
 * Mark a lead as dispatched (atomically increments touch counter
 * + updates last_touch_at). Sprint W7 Day 35.
 *
 * Touch 1 also writes email_dispatched_at for backward compat with
 * legacy code that filters on that column (e.g. admin lead list).
 */
export async function markDispatched(leadId: string, touch: DripTouch = 1): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    dispatched_touches: touch,
    last_touch_at:      now,
    email_last_error:   null,
  }
  if (touch === 1) {
    payload.email_dispatched_at = now
  }

  const { error } = await admin
    .from('tool_leads')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq('id', leadId)
  if (error) {
    console.warn('[admin-leads.markDispatched]', error.message)
    return false
  }
  return true
}

export async function markFailed(leadId: string, errorMessage: string, currentAttempts: number): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tool_leads')
    .update({
      email_attempts:   currentAttempts + 1,
      email_last_error: errorMessage.slice(0, 500),
    })
    .eq('id', leadId)
  if (error) {
    console.warn('[admin-leads.markFailed]', error.message)
    return false
  }
  return true
}
