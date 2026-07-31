import { createClient } from '@/lib/supabase/client'

export type NotificationType =
  | 'session_scheduled'      // тренер создал занятие → атлету
  | 'session_cancelled'      // тренер отменил занятие → атлету
  | 'checkup_scheduled'      // врач назначил осмотр → атлету
  | 'checkup_cancelled'      // врач отменил осмотр → атлету
  | 'invited_to_event'       // организация добавила в событие → участнику
  | 'event_cancelled'        // организация отменила событие → участнику
  | 'pass_issued'            // тренер выдал абонемент → атлету
  | 'rsvp_received'          // атлет подтвердил/отказался → тренеру/орг
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'invitation_cancelled'
  | 'connection_terminated'
  | 'broadcast'
  | 'system'
  // W12 Day 60: review-system + pass-system in-app surface
  | 'coach_replied_to_review' // coach reply → notify athlete
  | 'new_review_for_coach'    // athlete review → notify coach
  | 'pass_session_used'       // coach decremented → notify athlete

export interface NotificationRow {
  id:          string
  user_id:     string
  type:        NotificationType
  title:       string
  body:        string | null
  entity_type: string | null
  entity_id:   string | null
  action_url:  string | null
  is_read:     boolean
  is_archived: boolean
  created_at:  string
}

export interface NotifyInput {
  user_id: string
  type: NotificationType
  title: string
  body?: string | null
  entity_type?: string | null
  entity_id?: string | null
  action_url?: string | null
}

/**
 * Создаёт уведомление. Silent-fail: если вставка не прошла (например, RLS),
 * мы не валим бизнес-поток, а только логируем.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const sb = createClient()
  const { error } = await (sb as any).from('notifications').insert({
    user_id:     input.user_id,
    type:        input.type,
    title:       input.title,
    body:        input.body ?? null,
    entity_type: input.entity_type ?? null,
    entity_id:   input.entity_id ?? null,
    action_url:  input.action_url ?? null,
  })
  if (error) console.warn('[notify] failed:', error.message)
}

/**
 * Батч уведомлений. Silent-fail, как и notify().
 *
 * ВАЖНО про частичный отказ: INSERT политика notifications (миграция 082)
 * зовёт can_notify(actor, user_id) в WITH CHECK, а Postgres откатывает
 * statement ЦЕЛИКОМ, если хоть одна строка не прошла проверку. Из-за этого
 * один «неразрешённый» адресат убивал весь батч: например, празднование
 * личного рекорда не доходило ни до атлета, ни до тренеров, если в списке
 * был родитель (can_notify не знал про parent_links — чиним в миграции 108).
 *
 * Поэтому: быстрый путь — одна вставка (1 round-trip, как раньше); если она
 * отвергнута — повторяем построчно, чтобы потерялись только реально
 * запрещённые адресаты. Дубли исключены: при ошибке батча не вставилось
 * ничего (statement-level rollback).
 */
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return
  const sb = createClient()
  const rows = inputs.map(i => ({
    user_id:     i.user_id,
    type:        i.type,
    title:       i.title,
    body:        i.body ?? null,
    entity_type: i.entity_type ?? null,
    entity_id:   i.entity_id ?? null,
    action_url:  i.action_url ?? null,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('notifications').insert(rows)
  if (!error) return

  console.warn('[notifyMany] batch rejected, retrying row-by-row:', error.message)

  const results = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.map(row => (sb as any).from('notifications').insert(row)),
  )
  const failed = results.filter((r: { error: { message: string } | null }) => r.error)
  if (failed.length > 0) {
    console.warn(
      `[notifyMany] ${failed.length}/${rows.length} rows rejected:`,
      failed.map((r: { error: { message: string } | null }) => r.error?.message).join('; '),
    )
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const sb = createClient()
  const { count } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('is_archived', false)
  return count ?? 0
}

/**
 * W12 Day 60: List the current authenticated user's notifications,
 * newest first. RLS gates: notifications_user_select policy already
 * restricts to user_id = get_my_user_id().
 */
export async function listMyNotifications(opts?: {
  limit?: number
  includeArchived?: boolean
}): Promise<NotificationRow[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []
  let q = sb
    .from('notifications')
    .select('*')
    .eq('user_id', me.id)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50)
  if (!opts?.includeArchived) {
    q = q.eq('is_archived', false)
  }
  const { data, error } = await q
  if (error) {
    console.warn('[listMyNotifications]', error.message)
    return []
  }
  return (data ?? []) as NotificationRow[]
}

/**
 * Marks given notification ids as read (idempotent — already-read rows
 * untouched). Returns the count of rows that flipped state.
 */
export async function markNotificationsRead(ids: string[]): Promise<{ ok: boolean }> {
  if (ids.length === 0) return { ok: true }
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('notifications')
    .update({ is_read: true })
    .in('id', ids)
    .eq('is_read', false)
  if (error) {
    console.warn('[markNotificationsRead]', error.message)
    return { ok: false }
  }
  return { ok: true }
}

/**
 * Marks ALL unread notifications of the current user as read.
 */
export async function markAllNotificationsRead(): Promise<{ ok: boolean; affected: number }> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, affected: 0 }
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return { ok: false, affected: 0 }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (sb as any)
    .from('notifications')
    .update({ is_read: true }, { count: 'exact' })
    .eq('user_id', me.id)
    .eq('is_read', false)
  if (error) {
    console.warn('[markAllNotificationsRead]', error.message)
    return { ok: false, affected: 0 }
  }
  return { ok: true, affected: count ?? 0 }
}
