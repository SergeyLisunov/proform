'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── Types ──────────────────────────────────────────────────────────────────────
type ChatUser = {
  id: string
  name: string
  email: string
  role: string
}

type Chat = {
  id: string
  athlete_id: string
  coach_id: string
  created_at: string
  updated_at: string
  other_user: ChatUser
  last_message?: string
  unread_count: number
}

type Message = {
  id: string
  chat_id: string
  sender_id: string
  body: string
  is_read: boolean
  created_at: string
}

// ── Supabase ───────────────────────────────────────────────────────────────────
function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  const colors = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0284C7']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color + '20', border: `1.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color,
    }}>
      {initials}
    </div>
  )
}

// ── Format time ────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// ── New Chat Modal ─────────────────────────────────────────────────────────────
function NewChatModal({ currentUser, onClose, onCreated }: {
  currentUser: ChatUser
  onClose: () => void
  onCreated: (chat: Chat) => void
}) {
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    const sb = getSB()
    const targetRole = currentUser.role === 'athlete' ? 'coach' : 'athlete'
    sb.from('users').select('id, name, email, role').eq('role', targetRole).then(({ data }) => {
      setUsers(data ?? [])
      setLoading(false)
    })
  }, [currentUser.role])

  async function startChat(other: ChatUser) {
    setCreating(other.id)
    const sb = getSB()
    const athleteId = currentUser.role === 'athlete' ? currentUser.id : other.id
    const coachId   = currentUser.role === 'coach'   ? currentUser.id : other.id

    // Upsert chat
    const { data, error } = await sb
      .from('chats')
      .upsert({ athlete_id: athleteId, coach_id: coachId }, { onConflict: 'athlete_id,coach_id' })
      .select()
      .single()

    if (!error && data) {
      onCreated({ ...data, other_user: other, unread_count: 0 })
    }
    setCreating(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 0, width: 420, maxWidth: '95vw', zIndex: 1, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Новый чат</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
              {currentUser.role === 'athlete' ? 'Выбери тренера' : 'Выбери атлета'}
            </div>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              Нет доступных пользователей
            </div>
          ) : users.map(u => (
            <button key={u.id} onClick={() => startChat(u)} disabled={!!creating}
              style={{ width: '100%', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' }}
              className="hover:bg-accent/50">
              <Avatar name={u.name || u.email} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{u.name || u.email}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{u.role === 'coach' ? 'Тренер' : 'Атлет'}</div>
              </div>
              {creating === u.id ? (
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <i className="ki-filled ki-right text-muted-foreground text-xs" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Chat Window ────────────────────────────────────────────────────────────────
function ChatWindow({ chat, currentUserId, onBack }: {
  chat: Chat
  currentUserId: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Load messages
  useEffect(() => {
    const sb = getSB()
    sb.from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
      })

    // Mark as read
    sb.from('messages')
      .update({ is_read: true })
      .eq('chat_id', chat.id)
      .neq('sender_id', currentUserId)
      .eq('is_read', false)

    // Realtime subscription
    const channel = sb
      .channel(`chat:${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chat.id}`,
      }, payload => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        // Mark as read if from other user
        if (newMsg.sender_id !== currentUserId) {
          sb.from('messages').update({ is_read: true }).eq('id', newMsg.id)
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [chat.id, currentUserId])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    const sb = getSB()
    await sb.from('messages').insert({
      chat_id: chat.id,
      sender_id: currentUserId,
      body,
    })
    // Also update chat updated_at
    await sb.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id)
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = []
  messages.forEach(m => {
    const date = new Date(m.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const last = grouped[grouped.length - 1]
    if (last && last.date === date) last.msgs.push(m)
    else grouped.push({ date, msgs: [m] })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', flexShrink: 0 }}>
        <button onClick={onBack} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost md:hidden">
          <i className="ki-filled ki-left text-sm" />
        </button>
        <Avatar name={chat.other_user.name || chat.other_user.email} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{chat.other_user.name || chat.other_user.email}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {chat.other_user.role === 'coach' ? 'Тренер' : 'Атлет'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
            <div style={{ fontSize: 32 }}>👋</div>
            <div style={{ fontSize: 14, color: 'var(--muted-foreground)', textAlign: 'center' }}>
              Начните диалог с {chat.other_user.name?.split(' ')[0] || 'собеседником'}
            </div>
          </div>
        ) : (
          grouped.map(g => (
            <div key={g.date}>
              {/* Date divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{g.date}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {g.msgs.map((m, i) => {
                const isMe = m.sender_id === currentUserId
                const prevMsg = g.msgs[i - 1]
                const isSameAuthor = prevMsg && prevMsg.sender_id === m.sender_id
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: isSameAuthor ? 2 : 8 }}>
                    {!isMe && !isSameAuthor && <Avatar name={chat.other_user.name || chat.other_user.email} size={28} />}
                    {!isMe && isSameAuthor && <div style={{ width: 28, flexShrink: 0 }} />}
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? '#f97316' : 'var(--accent)',
                      color: isMe ? 'white' : 'var(--foreground)',
                      fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                    }}>
                      {m.body}
                      <div style={{ fontSize: 10, opacity: 0.7, textAlign: 'right', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        {fmtTime(m.created_at)}
                        {isMe && (
                          <i className={`ki-filled ${m.is_read ? 'ki-double-check text-blue-200' : 'ki-check'} text-[10px]`} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--card)', flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение… (Enter — отправить, Shift+Enter — новая строка)"
          rows={1}
          style={{
            flex: 1, border: '1px solid var(--border)', borderRadius: 12,
            padding: '10px 14px', fontSize: 13, outline: 'none', resize: 'none',
            background: 'var(--background)', color: 'var(--foreground)',
            lineHeight: 1.5, maxHeight: 120, overflow: 'auto',
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: text.trim() ? '#f97316' : 'var(--accent)',
            border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
          {sending
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <i className="ki-filled ki-send text-sm" style={{ color: text.trim() ? 'white' : 'var(--muted-foreground)' }} />
          }
        </button>
      </div>
    </div>
  )
}

// ── Main Messenger ─────────────────────────────────────────────────────────────
export default function MessengerPage() {
  const { user, loading: userLoading } = useUser()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [search, setSearch] = useState('')

  const loadChats = useCallback(async () => {
    if (!user) return
    const sb = getSB()

    const { data } = await sb
      .from('chats')
      .select('*')
      .or(`athlete_id.eq.${user.id},coach_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Fetch other users info
    const enriched: Chat[] = await Promise.all(data.map(async (c) => {
      const otherId = c.athlete_id === user.id ? c.coach_id : c.athlete_id
      const { data: otherUser } = await sb.from('users').select('id, name, email, role').eq('id', otherId).single()
      const { data: lastMsg } = await sb.from('messages').select('body').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1).single()
      const { count } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', c.id).eq('is_read', false).neq('sender_id', user.id)
      return {
        ...c,
        other_user: otherUser ?? { id: otherId, name: 'Пользователь', email: '', role: '' },
        last_message: lastMsg?.body ?? null,
        unread_count: count ?? 0,
      }
    }))

    setChats(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { loadChats() }, [loadChats])

  // Realtime — обновляем список чатов при новых сообщениях
  useEffect(() => {
    if (!user) return
    const sb = getSB()
    const channel = sb
      .channel('chats-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadChats())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [user, loadChats])

  if (userLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return null

  const filteredChats = chats.filter(c =>
    (c.other_user.name || c.other_user.email).toLowerCase().includes(search.toLowerCase())
  )

  const currentUser: ChatUser = { id: user.id, name: user.name ?? user.email ?? '', email: user.email ?? '', role: user.role ?? '' }
  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Общение</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h2 className="pf-num text-[36px] text-foreground leading-none">
            Мессенджер
            {totalUnread > 0 && (
              <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 10, padding: '2px 8px', borderRadius: 20, background: '#f97316', color: 'white' }}>
                {totalUnread}
              </span>
            )}
          </h2>
          <button onClick={() => setShowNewChat(true)} className="kt-btn kt-btn-primary gap-2">
            <i className="ki-filled ki-plus text-sm" />
            Новый чат
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 500, display: 'flex' }}>

        {/* Sidebar — список чатов */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: activeChat ? 'none' : 'flex', flexDirection: 'column',
        }} className="md:flex md:flex-col">

          {/* Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <i className="ki-filled ki-magnifier text-muted-foreground text-sm" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full rounded-xl border border-input pl-8 pr-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* Chats list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  {search ? 'Ничего не найдено' : 'Нет чатов. Создайте первый!'}
                </div>
              </div>
            ) : filteredChats.map(c => (
              <button key={c.id} onClick={() => setActiveChat(c)}
                style={{
                  width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  background: activeChat?.id === c.id ? 'var(--accent)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                className="hover:bg-accent/50">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar name={c.other_user.name || c.other_user.email} size={42} />
                  {c.unread_count > 0 && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18,
                      background: '#f97316', borderRadius: 9, fontSize: 10, fontWeight: 700,
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px', border: '2px solid var(--card)',
                    }}>{c.unread_count}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: c.unread_count > 0 ? 700 : 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                      {c.other_user.name || c.other_user.email}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      {fmtTime(c.updated_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread_count > 0 ? 600 : 400 }}>
                    {c.last_message ?? 'Нет сообщений'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {activeChat ? (
            <ChatWindow
              chat={activeChat}
              currentUserId={user.id}
              onBack={() => setActiveChat(null)}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 48 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Выберите чат</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>или создайте новый</div>
              <button onClick={() => setShowNewChat(true)} className="kt-btn kt-btn-primary gap-2 mt-2">
                <i className="ki-filled ki-plus text-sm" />Новый чат
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          currentUser={currentUser}
          onClose={() => setShowNewChat(false)}
          onCreated={chat => {
            setChats(prev => {
              const exists = prev.find(c => c.id === chat.id)
              if (exists) return prev
              return [chat, ...prev]
            })
            setActiveChat(chat)
            setShowNewChat(false)
          }}
        />
      )}
    </div>
  )
}
