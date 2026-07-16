/**
 * Club channels service (P2) — клубные каналы.
 *
 * Внутренний коммуникационный периметр клуба поверх схемы 097:
 * видимость каналов ДЕРИВИРУЕТСЯ RLS-предикатом can_read_channel из
 * org_members / org_group_members / parent_links — здесь только чтение
 * под RLS и простые вставки. Права на пост проверяет can_post_channel
 * (RPC + WITH CHECK на INSERT).
 */
import { createClient } from '@/lib/supabase/client'

export type ChannelKey =
  | 'club_announcements' | 'club_achievements' | 'team_news'
  | 'team_parents_chat' | 'staff_room' | 'club_media'
  | 'club_events' | 'club_general_chat'

export interface MyChannel {
  id: string
  org_id: string
  group_id: string | null
  key: ChannelKey
  title: string
  kind: 'broadcast' | 'discussion'
  unread: number
}

export interface ChannelPost {
  id: string
  channel_id: string
  author_id: string | null
  author_name: string | null
  kind: 'post' | 'system_record' | 'system_schedule' | 'system_event' | 'system_digest'
  body: string
  is_pinned: boolean
  created_at: string
  /** Моя реакция «поздравить» на этом посте. */
  reacted_by_me: boolean
  /** Число поздравлений — заполняется ТОЛЬКО для моих постов (приватные метрики). */
  my_post_congrats: number | null
}

export const CHANNEL_ICON: Record<ChannelKey, string> = {
  club_announcements: 'ki-notification-on',
  club_achievements:  'ki-medal-star',
  team_news:          'ki-flag',
  team_parents_chat:  'ki-people',
  staff_room:         'ki-security-user',
  club_media:         'ki-picture',
  club_events:        'ki-calendar-2',
  club_general_chat:  'ki-messages',
}

/** Каналы, видимые мне (RLS), с числом непрочитанных. */
export async function listMyChannels(myUserId: string): Promise<MyChannel[]> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any

  const [{ data: channels }, { data: reads }] = await Promise.all([
    sbAny.from('channels')
      .select('id, org_id, group_id, key, title, kind')
      .order('group_id', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true }),
    sbAny.from('channel_reads')
      .select('channel_id, last_read_at')
      .eq('user_id', myUserId),
  ])
  const list = (channels ?? []) as Array<Omit<MyChannel, 'unread'>>
  if (list.length === 0) return []

  const readMap = new Map<string, string>(
    ((reads ?? []) as Array<{ channel_id: string; last_read_at: string }>)
      .map(r => [r.channel_id, r.last_read_at]),
  )

  // ≤ ~10 каналов на пользователя — параллельные head-count'ы приемлемы.
  const counts = await Promise.all(list.map(async ch => {
    let q = sbAny.from('channel_posts')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .is('deleted_at', null)
    const lastRead = readMap.get(ch.id)
    if (lastRead) q = q.gt('created_at', lastRead)
    const { count } = await q
    return (count as number | null) ?? 0
  }))

  return list.map((ch, i) => ({ ...ch, unread: counts[i] }))
}

/** Могу ли я постить в канал (UI-affordance; сервер enforce'ит WITH CHECK). */
export async function canPostToChannel(channelId: string): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc('can_post_channel', { p_channel: channelId })
  return data === true
}

/** Лента канала: закреплённые сверху, дальше новые → старые. */
export async function listChannelPosts(channelId: string, myUserId: string): Promise<ChannelPost[]> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any

  const { data: postsRaw, error } = await sbAny.from('channel_posts')
    .select('id, channel_id, author_id, kind, body, is_pinned, created_at, author:users!channel_posts_author_id_fkey(name)')
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.warn('[listChannelPosts]', error.message); return [] }

  const posts = (postsRaw ?? []) as Array<{
    id: string; channel_id: string; author_id: string | null
    kind: ChannelPost['kind']; body: string; is_pinned: boolean; created_at: string
    author: { name: string | null } | null
  }>
  if (posts.length === 0) return []

  // RLS возвращает МОИ реакции + все реакции на МОИ посты — одним запросом.
  const { data: reactionsRaw } = await sbAny.from('channel_post_reactions')
    .select('post_id, user_id')
    .in('post_id', posts.map(p => p.id))
  const reactions = (reactionsRaw ?? []) as Array<{ post_id: string; user_id: string }>

  const mine = new Set(reactions.filter(r => r.user_id === myUserId).map(r => r.post_id))
  const countByPost = new Map<string, number>()
  for (const r of reactions) {
    countByPost.set(r.post_id, (countByPost.get(r.post_id) ?? 0) + 1)
  }

  return posts.map(p => ({
    id: p.id,
    channel_id: p.channel_id,
    author_id: p.author_id,
    author_name: p.author?.name ?? null,
    kind: p.kind,
    body: p.body,
    is_pinned: p.is_pinned,
    created_at: p.created_at,
    reacted_by_me: mine.has(p.id),
    // Приватная метрика: счётчик виден только автору поста.
    my_post_congrats: p.author_id === myUserId ? (countByPost.get(p.id) ?? 0) : null,
  }))
}

export async function sendChannelPost(channelId: string, myUserId: string, body: string): Promise<boolean> {
  const trimmed = body.trim()
  if (!trimmed) return false
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('channel_posts').insert({
    channel_id: channelId,
    author_id:  myUserId,
    kind:       'post',
    body:       trimmed.slice(0, 8000),
  })
  if (error) { console.warn('[sendChannelPost]', error.message); return false }
  return true
}

export async function markChannelRead(channelId: string, myUserId: string): Promise<void> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('channel_reads').upsert(
    { channel_id: channelId, user_id: myUserId, last_read_at: new Date().toISOString() },
    { onConflict: 'channel_id,user_id' },
  )
}

/** Тумблер «поздравить» (без публичных счётчиков — см. RLS). */
export async function toggleCongrats(postId: string, myUserId: string, reacted: boolean): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  if (reacted) {
    const { error } = await sbAny.from('channel_post_reactions')
      .delete().eq('post_id', postId).eq('user_id', myUserId)
    return !error
  }
  const { error } = await sbAny.from('channel_post_reactions')
    .insert({ post_id: postId, user_id: myUserId })
  return !error || error.code === '23505'
}
