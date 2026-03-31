'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── Types ──────────────────────────────────────────────────────────────────────
type ChatUser = { id: string; name: string; email: string; role: string }
type Chat = {
  id: string; athlete_id: string; coach_id: string
  created_at: string; updated_at: string
  other_user: ChatUser; last_message?: string; unread_count: number
}
type Message = {
  id: string; chat_id: string; sender_id: string
  body: string; is_read: boolean; created_at: string
}

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function getColor(name: string) {
  const colors = ['#f97316','#2563eb','#16a34a','#9333ea','#0284c7','#dc2626']
  return colors[name.charCodeAt(0) % colors.length]
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, online }: { name: string; size?: number; online?: boolean }) {
  const color = getColor(name)
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}22, ${color}44)`,
        border: `2px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, color, userSelect: 'none',
      }}>
        {getInitials(name)}
      </div>
      {online !== undefined && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28, borderRadius: '50%',
          background: online ? '#22c55e' : '#94a3b8',
          border: '2px solid var(--card)',
        }} />
      )}
    </div>
  )
}

// ── New Chat Modal ─────────────────────────────────────────────────────────────
function NewChatModal({ currentUser, onClose, onCreated }: {
  currentUser: ChatUser; onClose: () => void; onCreated: (chat: Chat) => void
}) {
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    const sb = getSB()
    const targetRole = currentUser.role === 'athlete' ? 'coach' : 'athlete'
    sb.from('users').select('id, name, email, role').eq('role', targetRole)
      .then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }, [currentUser.role])

  async function startChat(other: ChatUser) {
    setCreating(other.id)
    const sb = getSB()
    const athleteId = currentUser.role === 'athlete' ? currentUser.id : other.id
    const coachId   = currentUser.role === 'coach'   ? currentUser.id : other.id
    const { data, error } = await sb
      .from('chats')
      .upsert({ athlete_id: athleteId, coach_id: coachId }, { onConflict: 'athlete_id,coach_id' })
      .select().single()
    if (!error && data) onCreated({ ...data, other_user: other, unread_count: 0 })
    setCreating(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, width: 400, maxWidth: '95vw', overflow: 'hidden', zIndex: 1, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Новый диалог</p>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: '2px 0 0' }}>
              {currentUser.role === 'athlete' ? 'Выберите тренера' : 'Выберите атлета'}
            </h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Нет доступных пользователей</div>
          ) : users.map(u => (
            <button key={u.id} onClick={() => startChat(u)} disabled={!!creating}
              style={{ width: '100%', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
              className="hover:bg-accent/50">
              <Avatar name={u.name || u.email} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{u.name || u.email}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{u.role === 'coach' ? 'Тренер' : 'Атлет'}</div>
              </div>
              {creating === u.id
                ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                : <i className="ki-filled ki-arrow-right text-muted-foreground text-xs" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Chat Modal (centered) ──────────────────────────────────────────────────────
function ChatModal({ chat, currentUserId, onClose, onUnreadChange }: {
  chat: Chat; currentUserId: string; onClose: () => void; onUnreadChange: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const sb = getSB()
    sb.from('messages').select('*').eq('chat_id', chat.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages(data ?? []); setLoading(false) })

    // Mark as read
    sb.from('messages').update({ is_read: true })
      .eq('chat_id', chat.id).neq('sender_id', currentUserId).eq('is_read', false)
      .then(() => onUnreadChange())

    const channel = sb.channel(`chat:${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` },
        payload => {
          const msg = payload.new as Message
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.sender_id !== currentUserId) {
            sb.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => onUnreadChange())
          }
        })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [chat.id, currentUserId, onUnreadChange])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setText('')
    const sb = getSB()
    await sb.from('messages').insert({ chat_id: chat.id, sender_id: currentUserId, body })
    await sb.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id)
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Group by date
  const grouped: { date: string; msgs: Message[] }[] = []
  messages.forEach(m => {
    const date = new Date(m.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const last = grouped[grouped.length - 1]
    if (last && last.date === date) last.msgs.push(m)
    else grouped.push({ date, msgs: [m] })
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24,
        width: '100%', maxWidth: 560, height: '80vh', maxHeight: 700,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--card)' }}>
          <Avatar name={chat.other_user.name || chat.other_user.email} size={42} online={true} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{chat.other_user.name || chat.other_user.email}</div>
            <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginTop: 1 }}>● Онлайн</div>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>Начните разговор</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                Напишите первое сообщение {chat.other_user.name?.split(' ')[0] || 'собеседнику'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {grouped.map(g => (
                <div key={g.date}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{g.date}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {g.msgs.map((m, i) => {
                    const isMe = m.sender_id === currentUserId
                    const prev = g.msgs[i - 1]
                    const sameAuthor = prev?.sender_id === m.sender_id
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: sameAuthor ? 3 : 10 }}>
                        {!isMe && (
                          <div style={{ width: 30, flexShrink: 0 }}>
                            {!sameAuthor && <Avatar name={chat.other_user.name || chat.other_user.email} size={30} />}
                          </div>
                        )}
                        <div style={{
                          maxWidth: '72%', padding: '9px 13px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMe
                            ? 'linear-gradient(135deg, #f97316, #ea580c)'
                            : 'var(--accent)',
                          color: isMe ? 'white' : 'var(--foreground)',
                          fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word',
                          boxShadow: isMe ? '0 2px 12px rgba(249,115,22,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                        }}>
                          {m.body}
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                            {fmtTime(m.created_at)}
                            {isMe && <i className={`ki-filled ${m.is_read ? 'ki-check-circle' : 'ki-check'} text-[10px]`} style={{ opacity: m.is_read ? 1 : 0.6 }} />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--card)', flexShrink: 0 }}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение… (Enter — отправить)"
            rows={1}
            style={{
              flex: 1, border: '1.5px solid var(--border)', borderRadius: 14,
              padding: '10px 14px', fontSize: 13.5, outline: 'none', resize: 'none',
              background: 'var(--background)', color: 'var(--foreground)',
              lineHeight: 1.5, maxHeight: 120, transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
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
              width: 42, height: 42, borderRadius: 14, flexShrink: 0, border: 'none',
              background: text.trim() ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'var(--accent)',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: text.trim() ? '0 4px 14px rgba(249,115,22,0.35)' : 'none',
            }}>
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <i className="ki-filled ki-send text-sm" style={{ color: text.trim() ? 'white' : 'var(--muted-foreground)' }} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Messenger Page ────────────────────────────────────────────────────────
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
      .from('chats').select('*')
      .or(`athlete_id.eq.${user.id},coach_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const enriched: Chat[] = await Promise.all(data.map(async c => {
      const otherId = c.athlete_id === user.id ? c.coach_id : c.athlete_id
      const { data: ou } = await sb.from('users').select('id, name, email, role').eq('id', otherId).single()
      const { data: lm } = await sb.from('messages').select('body').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1).single()
      const { count } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', c.id).eq('is_read', false).neq('sender_id', user.id)
      return { ...c, other_user: ou ?? { id: otherId, name: 'Пользователь', email: '', role: '' }, last_message: lm?.body ?? null, unread_count: count ?? 0 }
    }))
    setChats(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { loadChats() }, [loadChats])

  useEffect(() => {
    if (!user) return
    const sb = getSB()
    const ch = sb.channel('chats-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadChats())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [user, loadChats])

  if (userLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return null

  const filtered = chats.filter(c => (c.other_user.name || c.other_user.email).toLowerCase().includes(search.toLowerCase()))
  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0)
  const currentUser: ChatUser = { id: user.id, name: user.name ?? user.email ?? '', email: user.email ?? '', role: user.role ?? '' }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Общение</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none flex items-center gap-3">
            Сообщения
            {totalUnread > 0 && (
              <span style={{ fontSize: 15, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', boxShadow: '0 2px 10px rgba(249,115,22,0.35)' }}>
                {totalUnread}
              </span>
            )}
          </h2>
        </div>
        <button onClick={() => setShowNewChat(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-message-add text-sm" />Новый чат
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <i className="ki-filled ki-magnifier text-muted-foreground text-sm" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени…"
          className="w-full rounded-xl border border-input pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400 bg-card" />
      </div>

      {/* Chats grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-5 py-20 text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <p className="text-foreground font-semibold text-base mb-1">{search ? 'Ничего не найдено' : 'Нет сообщений'}</p>
          <p className="text-muted-foreground text-sm mb-5">{search ? 'Попробуйте другой запрос' : 'Начните диалог с тренером или атлетом'}</p>
          {!search && (
            <button onClick={() => setShowNewChat(true)} className="kt-btn kt-btn-primary gap-2 mx-auto">
              <i className="ki-filled ki-plus text-sm" />Создать чат
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setActiveChat(c)}
              className="bg-card border border-border rounded-2xl p-5 text-left hover:border-orange-300 hover:shadow-md transition-all group"
              style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={c.other_user.name || c.other_user.email} size={48} />
                  {c.unread_count > 0 && (
                    <span style={{
                      position: 'absolute', top: -3, right: -3,
                      minWidth: 20, height: 20, borderRadius: 10,
                      background: 'linear-gradient(135deg,#f97316,#ea580c)',
                      color: 'white', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', border: '2px solid var(--card)',
                      boxShadow: '0 2px 8px rgba(249,115,22,0.4)',
                    }}>
                      {c.unread_count > 99 ? '99+' : c.unread_count}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.other_user.name || c.other_user.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
                    {c.other_user.role === 'coach' ? '🏋️ Тренер' : '🏃 Атлет'}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{fmtTime(c.updated_at)}</span>
              </div>
              <div style={{
                fontSize: 12.5, color: c.unread_count > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: c.unread_count > 0 ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                padding: '8px 12px', background: 'var(--accent)', borderRadius: 10,
              }}>
                {c.last_message ?? 'Нет сообщений — начните диалог'}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>Открыть чат</span>
                <i className="ki-filled ki-arrow-right text-orange-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat Modal — centered */}
      {activeChat && (
        <ChatModal
          chat={activeChat}
          currentUserId={user.id}
          onClose={() => setActiveChat(null)}
          onUnreadChange={loadChats}
        />
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          currentUser={currentUser}
          onClose={() => setShowNewChat(false)}
          onCreated={chat => {
            setChats(prev => prev.find(c => c.id === chat.id) ? prev : [chat, ...prev])
            setActiveChat(chat)
            setShowNewChat(false)
          }}
        />
      )}
    </div>
  )
}
