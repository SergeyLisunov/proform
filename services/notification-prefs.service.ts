/**
 * Notification Preferences service — Sprint W5 Day 27 (PR #44).
 *
 * Wraps users.notification_prefs JSONB (Migration 065). Provides typed
 * getter/setter + channel registry for UI.
 *
 * Default = opt-in. Если pref missing — should_send_notification() RPC
 * returns TRUE (fail-open). Users must explicitly disable channels.
 *
 * Backend cron routes will читать через `should_send_notification(user_id,
 * channel)` RPC — это incremental migration, не все routes ещё
 * проверяют prefs (W6 polish).
 */
import { createClient } from '@/lib/supabase/client'

export type NotificationChannel =
  | 'daily_digest_email'
  | 'coach_weekly_email'
  | 'recommendations_email'
  | 'inquiry_email'
  | 'drip_marketing_email'
  | 'marketplace_email'
  /** Sprint W8 Day 40: gentle reminders when athlete misses prescribed
   *  workouts OR has a pass expiring within 7 days. Dispatched daily. */
  | 'adherence_email'
  /** Sprint W8 Day 41: Sunday digest of cross-cutting events for org admins. */
  | 'org_digest_email'
  /** Sprint W11 Day 55: athlete receives email when coach replies to their review. */
  | 'coach_reply_email'

export interface ChannelMeta {
  key:          NotificationChannel
  label:        string
  description:  string
  icon:         string
  category:     'core' | 'collaboration' | 'marketing'
  default:      boolean
}

export const CHANNELS: ChannelMeta[] = [
  {
    key:         'daily_digest_email',
    label:       'Ежедневная сводка',
    description: 'Утренний email с сегодняшними тренировками + recovery. Атлеты + тренеры.',
    icon:        'ki-sun',
    category:    'core',
    default:     true,
  },
  {
    key:         'coach_weekly_email',
    label:       'Еженедельная сводка тренера',
    description: 'Понедельничный обзор атлетов: пропуски, expiring abonements, recovery trend.',
    icon:        'ki-calendar-2',
    category:    'core',
    default:     true,
  },
  {
    key:         'recommendations_email',
    label:       'Рекомендации врача/тренера',
    description: 'Email когда doctor создаёт medical recommendation OR coach assigns plan.',
    icon:        'ki-message-text',
    category:    'collaboration',
    default:     true,
  },
  {
    key:         'inquiry_email',
    label:       'Doctor inquiry уведомления',
    description: 'Coach получает email когда doctor ответил на inquiry; doctor — когда coach создаёт.',
    icon:        'ki-message-question',
    category:    'collaboration',
    default:     true,
  },
  {
    key:         'drip_marketing_email',
    label:       'Drip кампании ProForm',
    description: 'Еженедельные подсказки: как использовать platform features. Можно отписаться без affect на core.',
    icon:        'ki-rocket',
    category:    'marketing',
    default:     true,
  },
  {
    key:         'marketplace_email',
    label:       'Marketplace новости',
    description: 'Новые offerings от тренеров/специалистов в категориях, на которые вы подписаны.',
    icon:        'ki-shop',
    category:    'marketing',
    default:     true,
  },
  {
    key:         'adherence_email',
    label:       'Напоминания о тренировках',
    description: 'Мягкое напоминание если пропускаете несколько prescribed тренировок подряд или абонемент скоро истекает. Раз в 7 дней максимум.',
    icon:        'ki-bell',
    category:    'core',
    default:     true,
  },
  {
    key:         'org_digest_email',
    label:       'Еженедельная сводка организации',
    description: 'Воскресный email с обзором событий в команде: новые члены, запросы врачам, рекомендации. Не приходит если за неделю ничего не было.',
    icon:        'ki-element-11',
    category:    'core',
    default:     true,
  },
  {
    key:         'coach_reply_email',
    label:       'Ответы тренера на ваши отзывы',
    description: 'Email когда тренер отвечает на ваш отзыв. Помогает не пропустить ответ и продолжить диалог. Disable если не хотите получать такие уведомления.',
    icon:        'ki-message-text',
    category:    'collaboration',
    default:     true,
  },
]

export type NotificationPrefs = Partial<Record<NotificationChannel, boolean>>

/** Loads current user's prefs (returns empty object если row missing). */
export async function loadMyPrefs(): Promise<NotificationPrefs> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return {}
  const { data: meRow } = await sb
    .from('users')
    .select('notification_prefs')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const me = meRow as { notification_prefs: NotificationPrefs | null } | null
  return (me?.notification_prefs ?? {}) as NotificationPrefs
}

/** Merges incoming patch into existing prefs and persists. */
export async function updateMyPrefs(patch: NotificationPrefs): Promise<boolean> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return false

  // Load current to merge (avoid clobbering channels not in patch)
  const current = await loadMyPrefs()
  const next: NotificationPrefs = { ...current, ...patch }

  const { error } = await sb
    .from('users')
    .update({ notification_prefs: next })
    .eq('auth_id', auth.user.id)
  if (error) {
    console.warn('[notification-prefs.updateMyPrefs]', error.message)
    return false
  }
  return true
}

/**
 * Resolves effective value (with default fallback). Use в UI для render
 * toggle state.
 */
export function effective(prefs: NotificationPrefs, channel: NotificationChannel): boolean {
  if (channel in prefs) return prefs[channel] === true
  const meta = CHANNELS.find(c => c.key === channel)
  return meta?.default ?? true
}
