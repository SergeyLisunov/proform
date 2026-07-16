/**
 * Club feed service (P1 соц-ядро) — лента клуба + «респект».
 *
 * Чтение ленты — через server-route /api/club/feed (admin client +
 * column allow-list, см. комментарий роута). Toggle реакции — прямой
 * клиентский INSERT/DELETE в workout_reactions: RLS (миграция 094)
 * энфорсит engage-предикат (владелец / тренер / родитель / одноклубник),
 * sensitive-колонок в таблице нет.
 */
import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

export interface ClubFeedItem {
  id: string
  athlete_id: string
  name: string | null
  activity_type: string | null
  event_date: string
  activity_duration_min: number | null
  athlete_name: string
  respects: number
  reacted_by_me: boolean
  coach_respect: boolean
  is_mine: boolean
}

export interface ClubFeed {
  org: { id: string; name: string | null } | null
  me?: string
  items: ClubFeedItem[]
}

export async function fetchClubFeed(): Promise<ClubFeed> {
  try {
    const res = await fetch('/api/club/feed')
    const json = await res.json()
    if (!res.ok || !json.ok) return { org: null, items: [] }
    return { org: json.org, me: json.me, items: json.items ?? [] }
  } catch {
    return { org: null, items: [] }
  }
}

/**
 * Toggle «респект». on=true → INSERT (+notify владельцу, если это не я),
 * on=false → DELETE своей реакции. Уведомление — silent-fail через
 * can_notify: реакция тренера/родителя доставится (care-team предикаты),
 * реакция одноклубника может не пройти гейт — это осознанно (шум ниже).
 */
export async function toggleRespect(item: ClubFeedItem, myUserId: string, myName: string | null): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  if (item.reacted_by_me) {
    const { error } = await sbAny
      .from('workout_reactions')
      .delete()
      .eq('workout_id', item.id)
      .eq('user_id', myUserId)
    return !error
  }
  const { error } = await sbAny
    .from('workout_reactions')
    .insert({ workout_id: item.id, user_id: myUserId })
  if (error) return false

  if (!item.is_mine) {
    await notify({
      user_id:     item.athlete_id,
      type:        'broadcast',
      title:       `${myName ?? 'Одноклубник'} отметил вашу тренировку`,
      body:        `Респект за «${item.name ?? 'Тренировка'}» · ${item.event_date}`,
      entity_type: 'workout',
      entity_id:   item.id,
      action_url:  '/dashboard',
    })
  }
  return true
}
