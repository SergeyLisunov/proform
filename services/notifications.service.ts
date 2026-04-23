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
  const { error } = await (sb as any).from('notifications').insert(rows)
  if (error) console.warn('[notifyMany] failed:', error.message)
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
