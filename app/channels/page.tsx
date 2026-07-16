'use client'

/**
 * /channels — клубные каналы (P2).
 *
 * Внутренний периметр клуба: объявления, достижения (автопосты личных
 * рекордов), тренерская, per-группа новости и чат родителей. Замена
 * Telegram-канала и родительских WhatsApp-чатов. Видимость каналов
 * целиком решает RLS (can_read_channel из 097): страница просто
 * показывает то, что вернулось.
 *
 * Child-safety: детям RLS не отдаёт team_parents_chat/adults-каналы;
 * счётчики «поздравить» приватны (видит только автор поста).
 */
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'
import {
  listMyChannels, listChannelPosts, sendChannelPost,
  markChannelRead, canPostToChannel, toggleCongrats,
  CHANNEL_ICON, type MyChannel, type ChannelPost,
} from '@/services/club-channels.service'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function ChannelsPage() {
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<MyChannel[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [posts, setPosts] = useState<ChannelPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [canPost, setCanPost] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data: auth } = await sb.auth.getUser()
      if (!auth?.user) { if (!cancelled) setLoading(false); return }
      const { data: meRow } = await sb.from('users')
        .select('id, name').eq('auth_id', auth.user.id).maybeSingle()
      if (!meRow || cancelled) { if (!cancelled) setLoading(false); return }
      const meTyped = meRow as { id: string; name: string | null }
      setMe(meTyped)
      const list = await listMyChannels(meTyped.id)
      if (cancelled) return
      setChannels(list)
      setActiveId(prev => prev ?? list[0]?.id ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const openChannel = useCallback(async (channelId: string, myId: string) => {
    setPostsLoading(true)
    setDraft('')
    const [list, postable] = await Promise.all([
      listChannelPosts(channelId, myId),
      canPostToChannel(channelId),
    ])
    setPosts(list)
    setCanPost(postable)
    setPostsLoading(false)
    void markChannelRead(channelId, myId)
    setChannels(prev => prev.map(c => (c.id === channelId ? { ...c, unread: 0 } : c)))
  }, [])

  useEffect(() => {
    if (activeId && me) void openChannel(activeId, me.id)
  }, [activeId, me, openChannel])

  async function send() {
    if (!me || !activeId || sending) return
    const body = draft.trim()
    if (!body) return
    setSending(true)
    const ok = await sendChannelPost(activeId, me.id, body)
    if (ok) {
      setDraft('')
      setPosts(await listChannelPosts(activeId, me.id))
    }
    setSending(false)
  }

  async function congrats(post: ChannelPost) {
    if (!me) return
    // Optimistic toggle с откатом
    setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, reacted_by_me: !p.reacted_by_me } : p)))
    const ok = await toggleCongrats(post.id, me.id, post.reacted_by_me)
    if (!ok) {
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, reacted_by_me: post.reacted_by_me } : p)))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  if (!me || channels.length === 0) {
    return (
      <div className="pf-enter mx-auto max-w-3xl px-4 py-12 text-center">
        <i className="ki-filled ki-messages mb-3 block text-3xl text-muted-foreground" />
        <h1 className="text-lg font-bold text-navy-500">Каналы клуба</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Каналы появятся, когда вы состоите в клубе (или ваш ребёнок занимается в секции).
        </p>
      </div>
    )
  }

  const active = channels.find(c => c.id === activeId) ?? null
  const clubChannels = channels.filter(c => !c.group_id)
  const teamChannels = channels.filter(c => c.group_id)

  return (
    <div className="pf-enter mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-navy-500">Каналы клуба</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Список каналов */}
        <Card className="h-fit overflow-hidden">
          <ChannelGroup title="Клуб" items={clubChannels} activeId={activeId} onSelect={setActiveId} />
          {teamChannels.length > 0 && (
            <ChannelGroup title="Команды" items={teamChannels} activeId={activeId} onSelect={setActiveId} />
          )}
        </Card>

        {/* Лента выбранного канала */}
        <Card className="flex min-h-[480px] flex-col overflow-hidden">
          {active && (
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
              <i className={`ki-filled ${CHANNEL_ICON[active.key]} text-base text-orange-500`} />
              <h2 className="text-sm font-bold text-navy-500">{active.title}</h2>
              <span className="ml-auto text-2xs text-muted-foreground">
                {active.kind === 'broadcast' ? 'объявления' : 'обсуждение'}
              </span>
            </div>
          )}

          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {postsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="pf-spin h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : posts.length === 0 ? (
              <p className="px-5 py-16 text-center text-sm text-muted-foreground">
                Пока пусто. {canPost ? 'Напишите первым.' : 'Записи появятся здесь.'}
              </p>
            ) : posts.map(p => (
              <div key={p.id} className={`px-5 py-3.5 ${p.is_pinned ? 'bg-warning/5' : ''}`}>
                <div className="mb-1 flex items-center gap-2 text-2xs text-muted-foreground">
                  {p.is_pinned && <i className="ki-filled ki-pin text-[10px] text-warning" />}
                  <span className="font-semibold text-foreground">
                    {p.kind === 'system_record' ? 'Sporteo' : p.author_name ?? 'Участник'}
                  </span>
                  <span>{fmtWhen(p.created_at)}</span>
                  {p.kind === 'system_record' && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-600">
                      рекорд
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm text-foreground">{p.body}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => congrats(p)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors ${
                      p.reacted_by_me
                        ? 'border-orange-300 bg-orange-50 text-orange-600'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <i className="ki-filled ki-like text-[11px]" />
                    {p.reacted_by_me ? 'Поздравили' : 'Поздравить'}
                  </button>
                  {p.my_post_congrats !== null && p.my_post_congrats > 0 && (
                    <span className="text-2xs text-muted-foreground">
                      {p.my_post_congrats} поздр. — видно только вам
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canPost && (
            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                placeholder="Написать в канал…"
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                Отправить
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ChannelGroup({ title, items, activeId, onSelect }: {
  title: string
  items: MyChannel[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.map(ch => (
        <button
          key={ch.id}
          onClick={() => onSelect(ch.id)}
          className={`flex w-full items-center gap-2.5 border-b border-border px-4 py-3 text-left text-sm transition-colors ${
            ch.id === activeId ? 'bg-orange-50 font-semibold text-orange-700' : 'hover:bg-muted/50'
          }`}
        >
          <i className={`ki-filled ${CHANNEL_ICON[ch.key]} text-sm ${ch.id === activeId ? 'text-orange-500' : 'text-muted-foreground'}`} />
          <span className="min-w-0 flex-1 truncate">{ch.title}</span>
          {ch.unread > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {ch.unread > 99 ? '99+' : ch.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
