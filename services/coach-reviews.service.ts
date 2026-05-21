/**
 * Coach reviews service — Sprint W9 Day 44 (PR #65).
 *
 * CRUD around `coach_reviews` table + aggregate fetch via
 * `coach_review_summary` view.
 *
 * RLS layer (migration 071):
 *   - read: everyone authenticated
 *   - insert: athlete_id = get_my_user_id() AND coach_id != self
 *   - update/delete: only own row (UNIQUE per coach,athlete pair)
 *
 * UI binding:
 *   - components inside /profile/[id] (CoachProfile section)
 *   - rating badge on /marketplace cards (via getReviewSummaries batch)
 */
import { createClient } from '@/lib/supabase/client'

export interface CoachReview {
  id:                string
  coach_id:          string
  athlete_id:        string
  rating:            number
  comment:           string | null
  // W10 Day 48: coach can reply to review (1:1, see migration 073)
  coach_response:    string | null
  coach_response_at: string | null
  created_at:        string
  updated_at:        string
}

export interface CoachReviewWithAuthor extends CoachReview {
  athlete_name:       string | null
  athlete_avatar_url: string | null
  athlete_nickname:   string | null
}

export interface ReviewSummary {
  coach_id:     string
  avg_rating:   number   // 1..5, rounded to 2 decimals server-side
  review_count: number
}

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * Returns all reviews for a coach with author info, newest-first.
 * Public read — no auth required (any authenticated user).
 */
export async function listReviewsForCoach(coachId: string): Promise<CoachReviewWithAuthor[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('coach_reviews')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[coach-reviews.listReviewsForCoach]', error.message)
    return []
  }
  const reviews = (data ?? []) as CoachReview[]
  if (reviews.length === 0) return []

  const athleteIds = Array.from(new Set(reviews.map(r => r.athlete_id)))
  const { data: users } = await sb
    .from('users')
    .select('id, name, avatar_url, nickname')
    .in('id', athleteIds)
  const map = new Map<string, { name: string | null; avatar_url: string | null; nickname: string | null }>()
  for (const u of (users ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null; nickname: string | null }>) {
    map.set(u.id, { name: u.name, avatar_url: u.avatar_url, nickname: u.nickname })
  }
  return reviews.map(r => ({
    ...r,
    athlete_name:       map.get(r.athlete_id)?.name       ?? null,
    athlete_avatar_url: map.get(r.athlete_id)?.avatar_url ?? null,
    athlete_nickname:   map.get(r.athlete_id)?.nickname   ?? null,
  }))
}

/**
 * Batched variant of getMyReviewForCoach — returns a Map of coach_id
 * to (review|null) for the current user. Used by the athlete-passes
 * prompt (W10 Day 49) to filter "reviewable" coaches without N
 * round-trips.
 *
 * Coaches I HAVEN'T reviewed are absent from the map.
 */
export async function getMyReviewsByCoachIds(coachIds: string[]): Promise<Map<string, CoachReview>> {
  const map = new Map<string, CoachReview>()
  if (coachIds.length === 0) return map
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return map
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return map
  const uniq = Array.from(new Set(coachIds))
  const { data, error } = await sb
    .from('coach_reviews')
    .select('*')
    .eq('athlete_id', me.id)
    .in('coach_id', uniq)
  if (error) {
    console.warn('[coach-reviews.getMyReviewsByCoachIds]', error.message)
    return map
  }
  for (const row of (data ?? []) as CoachReview[]) {
    map.set(row.coach_id, row)
  }
  return map
}

/**
 * Returns the current authenticated athlete's review for this coach
 * (if any). Useful to pre-fill the edit form.
 */
export async function getMyReviewForCoach(coachId: string): Promise<CoachReview | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return null

  const { data, error } = await sb
    .from('coach_reviews')
    .select('*')
    .eq('coach_id', coachId)
    .eq('athlete_id', me.id)
    .maybeSingle()
  if (error) {
    console.warn('[coach-reviews.getMyReviewForCoach]', error.message)
    return null
  }
  return (data as CoachReview) ?? null
}

/**
 * Batched summary lookup for marketplace listing — fetches avg rating
 * and review count for a set of coach ids in one query against the
 * `coach_review_summary` view. Returns Map keyed by coach_id.
 *
 * Coaches with zero reviews are absent from the map (callers should
 * treat missing entries as "no rating yet").
 */
export async function getReviewSummaries(coachIds: string[]): Promise<Map<string, ReviewSummary>> {
  const map = new Map<string, ReviewSummary>()
  if (coachIds.length === 0) return map
  const sb = createClient()
  const uniq = Array.from(new Set(coachIds))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coach_review_summary')
    .select('coach_id, avg_rating, review_count')
    .in('coach_id', uniq)
  if (error) {
    console.warn('[coach-reviews.getReviewSummaries]', error.message)
    return map
  }
  for (const row of (data ?? []) as ReviewSummary[]) {
    map.set(row.coach_id, row)
  }
  return map
}

// ── Writes ─────────────────────────────────────────────────────────────────

export interface UpsertReviewInput {
  coach_id: string
  rating:   number     // 1..5
  comment?: string | null
}

/**
 * Creates or updates a review. Uses Postgres `ON CONFLICT` semantics
 * via Supabase upsert pattern keyed on the unique constraint
 * `coach_reviews_unique_per_pair`. RLS already enforces athlete_id =
 * current user.
 */
export async function upsertReview(input: UpsertReviewInput): Promise<{ ok: boolean; error: string | null }> {
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false, error: 'Рейтинг должен быть от 1 до 5' }
  }
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, error: 'Не авторизован' }
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return { ok: false, error: 'Профиль не найден' }
  if (me.id === input.coach_id) {
    return { ok: false, error: 'Нельзя оставить отзыв на самого себя' }
  }

  const payload = {
    coach_id:   input.coach_id,
    athlete_id: me.id,
    rating:     Math.round(input.rating),
    comment:    (input.comment?.trim() || null) as string | null,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('coach_reviews')
    .upsert(payload, { onConflict: 'coach_id,athlete_id' })
  if (error) {
    console.warn('[coach-reviews.upsertReview]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

/**
 * W11 Day 55: replyToReview — coach posts/updates/clears reply to a review.
 *
 * Routed through /api/coach-reviews/[id]/reply so the email side-effect
 * (Resend) runs server-side respecting notification_prefs.coach_reply_email.
 * Empty-trimmed response → backend clears the fields (delete-by-empty
 * pattern from W10 Day 48). When clearing, no email sent.
 */
export interface ReplyToReviewInput {
  reviewId: string
  response: string
}

export async function replyToReview(input: ReplyToReviewInput): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`/api/coach-reviews/${input.reviewId}/reply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ response: input.response }),
    })
    const data: { error?: string; ok?: boolean } = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMap: Record<string, string> = {
        coach_only:        'Только тренер может отвечать на отзывы',
        not_your_review:   'Можно отвечать только на свои отзывы',
        review_not_found:  'Отзыв не найден',
        invalid_id:        'Некорректный идентификатор',
        Unauthorized:      'Не авторизован',
      }
      return { ok: false, error: errMap[data?.error ?? ''] ?? data?.error ?? 'Не удалось сохранить ответ' }
    }
    return { ok: true, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network_error'
    console.warn('[coach-reviews.replyToReview]', msg)
    return { ok: false, error: msg }
  }
}

export async function deleteMyReview(coachId: string): Promise<{ ok: boolean; error: string | null }> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, error: 'Не авторизован' }
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return { ok: false, error: 'Профиль не найден' }

  const { error } = await sb
    .from('coach_reviews')
    .delete()
    .eq('coach_id', coachId)
    .eq('athlete_id', me.id)
  if (error) {
    console.warn('[coach-reviews.deleteMyReview]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

// ── Coach responses (W10 Day 48) ──────────────────────────────────────────

export interface ReplyInput {
  reviewId: string
  response: string   // empty/whitespace → treated as delete
}

/**
 * Coach (subject of the review) writes / edits / deletes their response.
 * RLS layer (migration 073) enforces coach_id = get_my_user_id().
 *
 * Empty trimmed response → clears the field (delete-by-empty pattern).
 * Sets coach_response_at to now() on update, null on clear.
 */
export async function replyToReview(input: ReplyInput): Promise<{ ok: boolean; error: string | null }> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, error: 'Не авторизован' }
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return { ok: false, error: 'Профиль не найден' }
  if (me.role !== 'coach') return { ok: false, error: 'Отвечать могут только тренеры' }

  const trimmed = input.response.trim()
  const payload = trimmed.length === 0
    ? { coach_response: null,    coach_response_at: null }
    : { coach_response: trimmed, coach_response_at: new Date().toISOString() }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('coach_reviews')
    .update(payload)
    .eq('id', input.reviewId)
    .eq('coach_id', me.id)   // belt-and-braces vs RLS
  if (error) {
    console.warn('[coach-reviews.replyToReview]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}
