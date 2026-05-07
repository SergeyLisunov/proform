/**
 * Recommendations service — Sprint W2 Day 9.
 *
 * Provider-agnostic CRUD over the `recommendations` table (migration
 * 052). All RLS enforcement lives in the DB; this service just shapes
 * inputs/outputs and dispatches notifications.
 *
 * Privacy by design:
 *   - Doctor creates → notify athlete + addressed coach (or all coaches
 *     of athlete via `trainer_athletes` if no specific coach_id).
 *   - Acknowledgement workflows are append-only timestamps; the trigger
 *     in migration 052 auto-bumps status when both required parties ack.
 *
 * App-layer redaction (org_admin view): when listing org-wide
 * recommendations, we strip body/title for entries with
 * visibility_level != 'org_full'. RLS lets org_admin SEE the row, but
 * the redacted projection returned to UI hides medical text.
 */
import { createClient } from '@/lib/supabase/client'
import { notify, notifyMany, type NotifyInput } from './notifications.service'
import type { Database } from '@/types/database'

type RecommendationRow = Database['public']['Tables']['recommendations']['Row']
type RecommendationInsert = Database['public']['Tables']['recommendations']['Insert']

// ── Types ──────────────────────────────────────────────────────────────────

export type RecommendationCategory =
  | 'load_restriction'
  | 'activity_restriction'
  | 'recovery'
  | 'observation'
  | 'consultation_request'
  | 'clearance'
  | 'nutrition'
  | 'general'
  | 'referral'

export type RecommendationSeverity = 'low' | 'moderate' | 'high' | 'critical'

export type RecommendationVisibility =
  | 'athlete_only'
  | 'coach_only'
  | 'coach_and_athlete'
  | 'org_full'

export type RecommendationStatus =
  | 'draft'
  | 'sent'
  | 'active'
  | 'acknowledged'
  | 'resolved'
  | 'expired'
  | 'cancelled'

export interface Recommendation {
  id: string
  organization_id: string | null
  athlete_id: string
  doctor_id: string
  coach_id: string | null
  title: string
  body: string | null
  category: RecommendationCategory
  severity: RecommendationSeverity
  visibility_level: RecommendationVisibility
  status: RecommendationStatus
  valid_from: string                 // YYYY-MM-DD
  valid_until: string | null
  acknowledged_by_coach_at: string | null
  acknowledged_by_athlete_at: string | null
  organization_seen_at: string | null
  attachments: unknown
  referred_to_specialty: string | null
  referred_to_user_id: string | null
  created_at: string
  updated_at: string
}

function rowToRec(r: RecommendationRow): Recommendation {
  return {
    id:                          r.id,
    organization_id:             r.organization_id,
    athlete_id:                  r.athlete_id,
    doctor_id:                   r.doctor_id,
    coach_id:                    r.coach_id,
    title:                       r.title,
    body:                        r.body,
    category:                    r.category as RecommendationCategory,
    severity:                    r.severity as RecommendationSeverity,
    visibility_level:            r.visibility_level as RecommendationVisibility,
    status:                      r.status as RecommendationStatus,
    valid_from:                  r.valid_from,
    valid_until:                 r.valid_until,
    acknowledged_by_coach_at:    r.acknowledged_by_coach_at,
    acknowledged_by_athlete_at:  r.acknowledged_by_athlete_at,
    organization_seen_at:        r.organization_seen_at,
    attachments:                 r.attachments,
    referred_to_specialty:       r.referred_to_specialty,
    referred_to_user_id:         r.referred_to_user_id,
    created_at:                  r.created_at,
    updated_at:                  r.updated_at,
  }
}

// ── UI metadata ────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<RecommendationCategory, { label: string; icon: string; color: string }> = {
  load_restriction:     { label: 'Ограничение нагрузки',  icon: 'ki-flash',          color: '#B91C1C' },
  activity_restriction: { label: 'Ограничение активности', icon: 'ki-shield-cross',   color: '#B91C1C' },
  recovery:             { label: 'Восстановление',         icon: 'ki-heart-circle',   color: '#EA580C' },
  observation:          { label: 'Наблюдение',             icon: 'ki-eye',            color: '#64748B' },
  consultation_request: { label: 'Запрос консультации',    icon: 'ki-message-question', color: '#2563EB' },
  clearance:            { label: 'Допуск',                 icon: 'ki-check-circle',   color: '#15803D' },
  nutrition:            { label: 'Питание / режим',        icon: 'ki-cup',            color: '#16A34A' },
  general:              { label: 'Общая рекомендация',     icon: 'ki-information-2',  color: '#64748B' },
  referral:             { label: 'Направление',            icon: 'ki-arrow-right',    color: '#7C3AED' },
}

export const SEVERITY_META: Record<RecommendationSeverity, { label: string; color: string; bg: string; border: string }> = {
  low:      { label: 'Низкая',      color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  moderate: { label: 'Умеренная',   color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  high:     { label: 'Высокая',     color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  critical: { label: 'Критическая', color: '#7F1D1D', bg: '#FEE2E2', border: '#FCA5A5' },
}

export const VISIBILITY_META: Record<RecommendationVisibility, { label: string; hint: string }> = {
  athlete_only:     { label: 'Только пациент',      hint: 'Только спортсмен увидит рекомендацию.' },
  coach_only:       { label: 'Только тренер',       hint: 'Тренер увидит ограничение, спортсмен не знает.' },
  coach_and_athlete:{ label: 'Тренер + спортсмен',  hint: 'Стандартная видимость: оба видят.' },
  org_full:         { label: 'Полная видимость',    hint: 'Включая администрацию организации (compliance).' },
}

export const STATUS_META: Record<RecommendationStatus, { label: string; color: string }> = {
  draft:        { label: 'Черновик',     color: '#64748B' },
  sent:         { label: 'Отправлено',   color: '#2563EB' },
  active:       { label: 'Активно',      color: '#15803D' },
  acknowledged: { label: 'Учтено',       color: '#0891B2' },
  resolved:     { label: 'Закрыто',      color: '#64748B' },
  expired:      { label: 'Истекло',      color: '#94A3B8' },
  cancelled:    { label: 'Отменено',     color: '#94A3B8' },
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreateRecommendationInput {
  doctor_id: string
  athlete_id: string
  organization_id?: string | null
  coach_id?: string | null
  title: string
  body?: string | null
  category: RecommendationCategory
  severity?: RecommendationSeverity
  visibility_level?: RecommendationVisibility
  valid_from?: string                    // YYYY-MM-DD, defaults to today
  valid_until?: string | null
  attachments?: unknown
  referred_to_specialty?: string | null
  referred_to_user_id?: string | null
  /** When 'sent', notifications go out. 'draft' stores silently. */
  send?: boolean
}

/**
 * Create a recommendation. RLS enforces doctor_id = me at INSERT time.
 * If `send`, dispatch notifications to athlete + coach(es) per
 * visibility_level. Returns null on failure.
 */
export async function createRecommendation(
  input: CreateRecommendationInput,
): Promise<Recommendation | null> {
  const sb = createClient()
  const status: RecommendationStatus = input.send === false ? 'draft' : 'sent'
  const payload: RecommendationInsert = {
    doctor_id:             input.doctor_id,
    athlete_id:            input.athlete_id,
    organization_id:       input.organization_id ?? null,
    coach_id:              input.coach_id ?? null,
    title:                 input.title.trim(),
    body:                  input.body?.trim() || null,
    category:              input.category,
    severity:              input.severity ?? 'moderate',
    visibility_level:      input.visibility_level ?? 'coach_and_athlete',
    status,
    valid_from:            input.valid_from ?? new Date().toISOString().slice(0, 10),
    valid_until:           input.valid_until ?? null,
    attachments:           (input.attachments as never) ?? null,
    referred_to_specialty: input.referred_to_specialty ?? null,
    referred_to_user_id:   input.referred_to_user_id ?? null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('recommendations')
    .insert(payload)
    .select()
    .single()
  if (error) {
    console.warn('[createRecommendation]', error.message)
    return null
  }
  const row = rowToRec(data as RecommendationRow)

  // Side-effect: notifications. Silent fail (notifications are best-effort).
  if (status === 'sent') {
    await dispatchRecommendationNotifications(row).catch(() => undefined)
  }

  return row
}

async function dispatchRecommendationNotifications(rec: Recommendation): Promise<void> {
  const sb = createClient()
  const targets: NotifyInput[] = []
  const meta = CATEGORY_META[rec.category]
  const titleForCoach = `Медотметка для тренера: ${meta.label.toLowerCase()}`
  const titleForAthlete = `Рекомендация от врача: ${meta.label.toLowerCase()}`
  const body = rec.title

  // Athlete: only if visibility allows
  if (rec.visibility_level === 'athlete_only' || rec.visibility_level === 'coach_and_athlete' || rec.visibility_level === 'org_full') {
    targets.push({
      user_id: rec.athlete_id,
      type: 'broadcast',
      title: titleForAthlete,
      body,
      entity_type: 'recommendation',
      entity_id: rec.id,
      action_url: '/dashboard',
    })
  }

  // Coach: explicit coach_id, or fan-out via trainer_athletes
  if (rec.visibility_level === 'coach_only' || rec.visibility_level === 'coach_and_athlete' || rec.visibility_level === 'org_full') {
    if (rec.coach_id) {
      targets.push({
        user_id: rec.coach_id,
        type: 'broadcast',
        title: titleForCoach,
        body,
        entity_type: 'recommendation',
        entity_id: rec.id,
        action_url: `/athletes/${rec.athlete_id}`,
      })
    } else {
      const { data: links } = await sb
        .from('trainer_athletes')
        .select('trainer_id')
        .eq('athlete_id', rec.athlete_id)
        .eq('status', 'accepted')
      const coachIds = ((links ?? []) as Array<{ trainer_id: string }>).map(l => l.trainer_id)
      for (const cid of coachIds) {
        targets.push({
          user_id: cid,
          type: 'broadcast',
          title: titleForCoach,
          body,
          entity_type: 'recommendation',
          entity_id: rec.id,
          action_url: `/athletes/${rec.athlete_id}`,
        })
      }
    }
  }

  // Specialist (referral): notify referred_to_user_id
  if (rec.referred_to_user_id) {
    targets.push({
      user_id: rec.referred_to_user_id,
      type: 'broadcast',
      title: 'Направление к специалисту',
      body: rec.title,
      entity_type: 'recommendation',
      entity_id: rec.id,
      action_url: '/dashboard',
    })
  }

  if (targets.length > 0) await notifyMany(targets)
}

// ── Acknowledgements ───────────────────────────────────────────────────────

/** Coach marks recommendation as understood. RLS allows only linked coach. */
export async function acknowledgeAsCoach(id: string): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('recommendations')
    .update({ acknowledged_by_coach_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.warn('[acknowledgeAsCoach]', error.message)
    return false
  }
  // Notify doctor that coach acknowledged
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).from('recommendations').select('doctor_id, title').eq('id', id).maybeSingle()
  if (data) {
    await notify({
      user_id: data.doctor_id,
      type: 'broadcast',
      title: 'Тренер ознакомился с рекомендацией',
      body: data.title,
      entity_type: 'recommendation',
      entity_id: id,
    }).catch(() => undefined)
  }
  return true
}

/** Athlete marks recommendation as understood. */
export async function acknowledgeAsAthlete(id: string): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('recommendations')
    .update({ acknowledged_by_athlete_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.warn('[acknowledgeAsAthlete]', error.message)
    return false
  }
  return true
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** All recommendations addressed to me as athlete (visibility allows). */
export async function listMyRecommendationsAsAthlete(athleteId: string): Promise<Recommendation[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('recommendations')
    .select('*')
    .eq('athlete_id', athleteId)
    .in('status', ['sent', 'active', 'acknowledged'])
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[listMyRecommendationsAsAthlete]', error.message)
    return []
  }
  return ((data ?? []) as RecommendationRow[]).map(rowToRec)
}

/**
 * All active recommendations affecting athletes I coach. RLS does the
 * heavy lifting — we just SELECT and present.
 */
export async function listRecommendationsForMyAthletes(): Promise<Recommendation[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('recommendations')
    .select('*')
    .in('status', ['sent', 'active', 'acknowledged'])
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[listRecommendationsForMyAthletes]', error.message)
    return []
  }
  return ((data ?? []) as RecommendationRow[]).map(rowToRec)
}

/** Coach view: recommendations for a specific athlete I'm linked to. */
export async function listRecommendationsForAthlete(athleteId: string): Promise<Recommendation[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('recommendations')
    .select('*')
    .eq('athlete_id', athleteId)
    .in('status', ['sent', 'active', 'acknowledged'])
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[listRecommendationsForAthlete]', error.message)
    return []
  }
  return ((data ?? []) as RecommendationRow[]).map(rowToRec)
}

/**
 * Org admin view — list all org recommendations. Body/title are
 * REDACTED for visibility_level != 'org_full' (privacy by design).
 * Org admin sees agg meta only unless doctor explicitly opted into
 * org_full visibility.
 */
export interface OrgRecommendationView {
  id: string
  athlete_id: string
  doctor_id: string
  coach_id: string | null
  category: RecommendationCategory
  severity: RecommendationSeverity
  status: RecommendationStatus
  visibility_level: RecommendationVisibility
  valid_from: string
  valid_until: string | null
  acknowledged_by_coach_at: string | null
  acknowledged_by_athlete_at: string | null
  created_at: string
  /** REDACTED unless org_full */
  title: string | null
  /** REDACTED unless org_full */
  body: string | null
}

export async function listOrgRecommendations(orgId: string): Promise<OrgRecommendationView[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('recommendations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.warn('[listOrgRecommendations]', error.message)
    return []
  }
  return ((data ?? []) as RecommendationRow[]).map(r => {
    const isOrgFull = r.visibility_level === 'org_full'
    return {
      id:                          r.id,
      athlete_id:                  r.athlete_id,
      doctor_id:                   r.doctor_id,
      coach_id:                    r.coach_id,
      category:                    r.category as RecommendationCategory,
      severity:                    r.severity as RecommendationSeverity,
      status:                      r.status as RecommendationStatus,
      visibility_level:            r.visibility_level as RecommendationVisibility,
      valid_from:                  r.valid_from,
      valid_until:                 r.valid_until,
      acknowledged_by_coach_at:    r.acknowledged_by_coach_at,
      acknowledged_by_athlete_at:  r.acknowledged_by_athlete_at,
      created_at:                  r.created_at,
      // App-layer redaction:
      title:                       isOrgFull ? r.title : null,
      body:                        isOrgFull ? r.body  : null,
    }
  })
}
