'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageMode = 'connections' | 'search'
type ConnTab  = 'active' | 'incoming' | 'outgoing' | 'history'
type RoleFilter = 'all' | 'athlete' | 'coach' | 'organization'

type ConnUser = {
  id: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
  role: string
  avatar_url: string | null
  city: string | null
}

type Connection = {
  id: string
  status: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
  connection_type: string
  initiated_at: string
  responded_at: string | null
  message: string | null
  initiator: ConnUser
  recipient: ConnUser
}

type SearchUser = {
  id: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
  role: string
  avatar_url: string | null
  city: string | null
  sport: string | null
  connection_status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'active'
  connection_id: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  athlete:      { label: 'Атлет',      color: '#F97316', bg: '#FFF7ED' },
  coach:        { label: 'Тренер',     color: '#16A34A', bg: '#F0FDF4' },
  organization: { label: 'Организация', color: '#2563EB', bg: '#EFF6FF' },
}

const CONN_TYPE_LABEL: Record<string, string> = {
  coach_athlete: 'Тренер — Атлет',
  org_coach:     'Организация — Тренер',
  org_athlete:   'Организация — Атлет',
}

function getConnectionType(myRole: string, theirRole: string): string | null {
  if ((myRole === 'coach' && theirRole === 'athlete') || (myRole === 'athlete' && theirRole === 'coach'))
    return 'coach_athlete'
  if ((myRole === 'organization' && theirRole === 'coach') || (myRole === 'coach' && theirRole === 'organization'))
    return 'org_coach'
  if ((myRole === 'organization' && theirRole === 'athlete') || (myRole === 'athlete' && theirRole === 'organization'))
    return 'org_athlete'
  return null
}

function displayName(u: ConnUser | SearchUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ')
    || (u.nickname ? `@${u.nickname}` : 'Пользователь')
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ user, size = 46 }: { user: ConnUser | SearchUser; size?: number }) {
  const rm = ROLE_META[user.role] ?? { color: '#64748B', bg: '#F8FAFC' }
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: user.avatar_url ? 'transparent' : `${rm.color}20`,
      border: `1.5px solid ${rm.color}30`, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.4, fontWeight: 800, color: rm.color }}>
            {displayName(user)[0]?.toUpperCase() ?? '?'}
          </span>
      }
    </div>
  )
}

// ── Role badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const rm = ROLE_META[role] ?? { label: role, color: '#64748B', bg: '#F8FAFC' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: rm.bg, color: rm.color, border: `1px solid ${rm.color}22`,
    }}>{rm.label}</span>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '12px 18px', borderRadius: 14,
      background: ok ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`,
      color: ok ? '#15803D' : '#DC2626',
      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      animation: 'fadeInUp 0.2s ease',
    }}>
      <i className={`ki-filled ${ok ? 'ki-check-circle' : 'ki-information-5'} text-sm`} />
      {msg}
    </div>
  )
}

// ── Invite modal ───────────────────────────────────────────────────────────────

function InviteModal({
  target, myRole, onClose, onSent,
}: {
  target: SearchUser
  myRole: string
  onClose: () => void
  onSent: (userId: string, connId: string) => void
}) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const connType = getConnectionType(myRole, target.role)

  async function send() {
    if (!connType) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/connections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: target.id, connection_type: connType, message: message.trim() || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSent(target.id, d.connection.id)
      onClose()
    } catch (e: any) {
      setError(e.message === 'already_connected' ? 'Уже есть активная связь'
        : e.message === 'already_pending' ? 'Приглашение уже отправлено'
        : e.message ?? 'Ошибка')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
        background: 'var(--card)', borderRadius: 24, overflow: 'hidden',
        border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Приглашение</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '2px 0 0' }}>
                {displayName(target)}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted-foreground)' }}>
              <i className="ki-filled ki-cross text-sm" />
            </button>
          </div>
          {connType && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>
              Тип связи: <strong>{CONN_TYPE_LABEL[connType]}</strong>
            </p>
          )}
        </div>
        <div style={{ padding: '18px 24px 22px' }}>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Сообщение (необязательно)…"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 12,
              border: '1.5px solid var(--border)', background: 'var(--background)',
              color: 'var(--foreground)', fontSize: 13, resize: 'none', outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          {error && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={send} disabled={loading || !connType}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white',
                fontSize: 13, fontWeight: 700,
                opacity: (loading || !connType) ? 0.6 : 1,
              }}
            >
              {loading ? 'Отправляется…' : 'Отправить'}
            </button>
            <button onClick={onClose} style={{
              padding: '10px 18px', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13, cursor: 'pointer',
            }}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Search result card ─────────────────────────────────────────────────────────

function SearchCard({
  u, myRole, acting, onInvite, onAction,
}: {
  u: SearchUser
  myRole: string
  acting: string | null
  onInvite: (u: SearchUser) => void
  onAction: (connId: string, action: 'accept' | 'decline' | 'cancel') => void
}) {
  const rm = ROLE_META[u.role] ?? { color: '#64748B', bg: '#F8FAFC' }
  const busy = acting === u.id || acting === u.connection_id

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 18, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <Link href={`/profile/${u.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
        <Avatar user={u} />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/profile/${u.id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', textDecoration: 'none' }}>
            {displayName(u)}
          </Link>
          <RoleBadge role={u.role} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {u.nickname && <span style={{ color: rm.color, fontWeight: 600 }}>@{u.nickname}</span>}
          {u.sport && <span>{u.sport}</span>}
          {u.city && <span>{u.city}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
        {u.connection_status === 'none' && getConnectionType(myRole, u.role) && (
          <button disabled={busy} onClick={() => onInvite(u)} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <i className="ki-filled ki-user-plus text-xs mr-1" />Пригласить
          </button>
        )}

        {u.connection_status === 'pending_outgoing' && (
          <>
            <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
              Ожидает ответа
            </span>
            <button disabled={busy} onClick={() => onAction(u.connection_id!, 'cancel')} style={{
              padding: '5px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              {busy ? '…' : 'Отозвать'}
            </button>
          </>
        )}

        {u.connection_status === 'pending_incoming' && (
          <>
            <button disabled={busy} onClick={() => onAction(u.connection_id!, 'accept')} style={{
              padding: '7px 14px', borderRadius: 10, border: 'none',
              background: '#16A34A', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {busy ? '…' : 'Принять'}
            </button>
            <button disabled={busy} onClick={() => onAction(u.connection_id!, 'decline')} style={{
              padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Отклонить
            </button>
          </>
        )}

        {u.connection_status === 'active' && (
          <>
            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ki-filled ki-check-circle text-xs" />Связь активна
            </span>
            <Link href="/messages" style={{
              padding: '5px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <i className="ki-filled ki-message-text-2 text-xs" />Сообщение
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Connection card ────────────────────────────────────────────────────────────

function ConnCard({
  c, tab, myId, acting, onAct, onTerminate,
}: {
  c: Connection
  tab: ConnTab
  myId: string
  acting: string | null
  onAct: (id: string, action: 'accept' | 'decline' | 'cancel') => void
  onTerminate: (id: string) => void
}) {
  const other = c.initiator.id === myId ? c.recipient : c.initiator
  const rm    = ROLE_META[other.role] ?? { label: other.role, color: '#64748B', bg: '#F8FAFC' }
  const busy  = acting === c.id

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 18, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <Link href={`/profile/${other.id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
        <Avatar user={other} />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/profile/${other.id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', textDecoration: 'none' }}>
            {displayName(other)}
          </Link>
          <RoleBadge role={other.role} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', gap: 8 }}>
          <span>{CONN_TYPE_LABEL[c.connection_type] ?? c.connection_type}</span>
          <span>·</span>
          <span>{timeAgo(c.initiated_at)}</span>
        </div>
        {c.message && (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, fontStyle: 'italic' }}>
            "{c.message}"
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {tab === 'incoming' && (
          <>
            <button disabled={busy} onClick={() => onAct(c.id, 'accept')} style={{
              padding: '7px 14px', borderRadius: 10, border: 'none',
              background: '#16A34A', color: 'white', fontSize: 12, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>
              {busy ? '…' : 'Принять'}
            </button>
            <button disabled={busy} onClick={() => onAct(c.id, 'decline')} style={{
              padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Отклонить
            </button>
          </>
        )}
        {tab === 'outgoing' && (
          <button disabled={busy} onClick={() => onAct(c.id, 'cancel')} style={{
            padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}>
            {busy ? '…' : 'Отозвать'}
          </button>
        )}
        {tab === 'active' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href="/messages" style={{
              padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <i className="ki-filled ki-message-text-2 text-xs" />Сообщение
            </Link>
            <button disabled={busy} onClick={() => onTerminate(c.id)} style={{
              padding: '7px 12px', borderRadius: 10, border: '1.5px solid #FECACA',
              background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>
              {busy ? '…' : 'Завершить'}
            </button>
          </div>
        )}
        {tab === 'history' && (
          <span style={{
            padding: '5px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: 'var(--muted)', color: 'var(--muted-foreground)',
          }}>
            {c.status === 'declined' ? 'Отклонено' : c.status === 'cancelled' ? 'Отозвано' : 'Завершено'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { user }  = useUser()
  const myId      = user?.id ?? ''
  const myRole    = user?.role ?? ''

  // Mode
  const [mode, setMode]   = useState<PageMode>('connections')
  const [connTab, setConnTab] = useState<ConnTab>('active')

  // Connections
  const [conns, setConns]       = useState<Connection[]>([])
  const [connsLoading, setConnsLoading] = useState(true)
  const [counts, setCounts]     = useState({ active: 0, incoming: 0, outgoing: 0 })

  // Search
  const [query, setQuery]       = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [results, setResults]   = useState<SearchUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Actions
  const [acting, setActing]     = useState<string | null>(null)
  const [inviteTarget, setInviteTarget] = useState<SearchUser | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  // Search input ref for focus
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load connections ──
  const loadConns = useCallback(async () => {
    setConnsLoading(true)
    try {
      const res  = await fetch('/api/connections?status=all')
      const data = await res.json()
      setConns(data.connections ?? [])
      const rows = data.connections ?? []
      setCounts({
        active:   rows.filter((c: Connection) => c.status === 'active').length,
        incoming: rows.filter((c: Connection) => c.status === 'pending' && c.recipient.id === myId).length,
        outgoing: rows.filter((c: Connection) => c.status === 'pending' && c.initiator.id === myId).length,
      })
    } finally { setConnsLoading(false) }
  }, [myId])

  useEffect(() => { if (myId) loadConns() }, [myId, loadConns])

  // ── Search ──
  useEffect(() => {
    if (mode !== 'search' || debouncedQuery.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    setSearchLoading(true)
    const params = new URLSearchParams({ q: debouncedQuery })
    if (roleFilter !== 'all') params.set('role', roleFilter)
    fetch(`/api/search/users?${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setResults(d.users ?? []) })
      .finally(() => { if (!cancelled) setSearchLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, roleFilter, mode])

  // ── Toast helper ──
  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Enter search mode ──
  function enterSearch() {
    setMode('search')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function exitSearch() {
    setMode('connections')
    setQuery('')
    setResults([])
  }

  // ── Connection actions ──
  async function handleAct(id: string, action: 'accept' | 'decline' | 'cancel') {
    setActing(id)
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await loadConns()
      // If accepted, re-fetch search results to update status
      if (action === 'accept' && mode === 'search') setResults([])
      showToast(action === 'accept' ? 'Связь установлена' : 'Готово', true)
    } catch (e: any) { showToast(e.message, false) }
    finally { setActing(null) }
  }

  async function handleTerminate(id: string) {
    setActing(id)
    try {
      await fetch(`/api/connections/${id}`, { method: 'DELETE' })
      await loadConns()
      showToast('Связь завершена', true)
    } catch { showToast('Ошибка', false) }
    finally { setActing(null) }
  }

  // ── After invite sent — optimistic update in search results ──
  function handleInviteSent(userId: string, connId: string) {
    setResults(prev => prev.map(u =>
      u.id === userId
        ? { ...u, connection_status: 'pending_outgoing', connection_id: connId }
        : u
    ))
    showToast('Приглашение отправлено', true)
    loadConns()
  }

  // ── After cancel from search — optimistic update ──
  async function handleSearchAction(connId: string, action: 'accept' | 'decline' | 'cancel') {
    setActing(connId)
    try {
      const res = await fetch(`/api/connections/${connId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      // Refresh search results and connections
      setResults([])
      await loadConns()
      // Re-trigger search
      if (debouncedQuery.length >= 1) {
        const params = new URLSearchParams({ q: debouncedQuery })
        if (roleFilter !== 'all') params.set('role', roleFilter)
        const d = await fetch(`/api/search/users?${params}`).then(r => r.json())
        setResults(d.users ?? [])
      }
      showToast(action === 'accept' ? 'Связь установлена' : 'Готово', true)
    } catch (e: any) { showToast(e.message, false) }
    finally { setActing(null) }
  }

  // ── Filtered connections ──
  const active   = conns.filter(c => c.status === 'active')
  const incoming = conns.filter(c => c.status === 'pending' && c.recipient.id === myId)
  const outgoing = conns.filter(c => c.status === 'pending' && c.initiator.id === myId)
  const history  = conns.filter(c => ['declined', 'cancelled', 'terminated'].includes(c.status))
  const displayed = connTab === 'active' ? active
    : connTab === 'incoming' ? incoming
    : connTab === 'outgoing' ? outgoing
    : history

  // ── Search role tabs — show only roles relevant to myRole ──
  const roleTabs: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'Все' },
    ...(myRole !== 'athlete'      ? [{ id: 'athlete' as RoleFilter,      label: 'Атлеты' }]       : []),
    ...(myRole !== 'coach'        ? [{ id: 'coach' as RoleFilter,        label: 'Тренеры' }]       : []),
    ...(myRole !== 'organization' ? [{ id: 'organization' as RoleFilter, label: 'Организации' }]   : []),
  ]

  const CONN_TABS: { id: ConnTab; label: string; count?: number }[] = [
    { id: 'active',   label: 'Активные',  count: counts.active   || undefined },
    { id: 'incoming', label: 'Входящие',  count: counts.incoming || undefined },
    { id: 'outgoing', label: 'Исходящие', count: counts.outgoing || undefined },
    { id: 'history',  label: 'История' },
  ]

  // ── Render ──
  return (
    <div className="flex flex-col gap-6 pf-enter" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 14,
          }}>
            <i className="ki-filled ki-left" style={{ fontSize: 13 }} />
          </Link>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Сеть</p>
          <h1 className="pf-num" style={{ fontSize: 34, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Мои связи
          </h1>
        </div>

        {mode === 'connections' ? (
          <button onClick={enterSearch} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 14,
            background: 'linear-gradient(135deg,#F97316,#EA580C)',
            color: 'white', fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(249,115,22,0.3)',
          }}>
            <i className="ki-filled ki-magnifier text-sm" />Найти людей
          </button>
        ) : (
          <button onClick={exitSearch} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 14,
            border: '1.5px solid var(--border)', background: 'var(--card)',
            color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <i className="ki-filled ki-left text-sm" />К моим связям
          </button>
        )}
      </div>

      {/* Search bar — always visible */}
      <div style={{ position: 'relative' }}>
        <i className="ki-filled ki-magnifier" style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--muted-foreground)', fontSize: 14, pointerEvents: 'none',
        }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); if (mode !== 'search') setMode('search') }}
          onFocus={() => { if (mode !== 'search') setMode('search') }}
          placeholder="Поиск по имени или @никнейму…"
          style={{
            width: '100%', padding: '12px 40px 12px 40px',
            borderRadius: 14, border: '1.5px solid var(--border)',
            background: 'var(--card)', color: 'var(--foreground)',
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#f97316'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted-foreground)', padding: 4,
            }}>
            <i className="ki-filled ki-cross text-xs" />
          </button>
        )}
      </div>

      {/* ── SEARCH MODE ── */}
      {mode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Role filter tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--accent)', borderRadius: 14, border: '1px solid var(--border)', overflowX: 'auto' }}>
            {roleTabs.map(t => (
              <button key={t.id} onClick={() => setRoleFilter(t.id)} style={{
                flex: '0 0 auto', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: roleFilter === t.id ? 700 : 600,
                background: roleFilter === t.id ? 'var(--card)' : 'transparent',
                color: roleFilter === t.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: roleFilter === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {query.length < 1 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted-foreground)' }}>
              <i className="ki-filled ki-magnifier text-4xl block mb-3" style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Начни вводить имя или @никнейм</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Найди тренеров, атлетов и организации</p>
            </div>
          ) : searchLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted-foreground)' }}>
              <i className="ki-filled ki-people text-4xl block mb-3" style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>По запросу «{query}» ничего не найдено</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Проверь написание или попробуй @никнейм</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map(u => (
                <SearchCard
                  key={u.id}
                  u={u}
                  myRole={myRole}
                  acting={acting}
                  onInvite={setInviteTarget}
                  onAction={handleSearchAction}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONNECTIONS MODE ── */}
      {mode === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--accent)', borderRadius: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
            {CONN_TABS.map(t => (
              <button key={t.id} onClick={() => setConnTab(t.id)} style={{
                flex: '0 0 auto', padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: connTab === t.id ? 700 : 600,
                background: connTab === t.id ? 'var(--card)' : 'transparent',
                color: connTab === t.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: connTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                {t.count !== undefined && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 99, padding: '0 5px',
                    background: connTab === t.id
                      ? (t.id === 'incoming' ? '#F97316' : '#64748B')
                      : '#E2E8F0',
                    color: connTab === t.id ? 'white' : 'var(--muted-foreground)',
                    fontSize: 10, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {connsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-foreground)' }}>
              <i className="ki-filled ki-people text-4xl block mb-3" style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                {connTab === 'active'   ? 'Нет активных связей'        :
                 connTab === 'incoming' ? 'Нет входящих приглашений'   :
                 connTab === 'outgoing' ? 'Нет исходящих приглашений'  : 'История пуста'}
              </p>
              {connTab === 'active' && (
                <button onClick={enterSearch} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
                  fontSize: 13, color: '#F97316', fontWeight: 600, background: 'none',
                  border: 'none', cursor: 'pointer', textDecoration: 'none',
                }}>
                  <i className="ki-filled ki-magnifier text-sm" />Найти людей
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayed.map(c => (
                <ConnCard
                  key={c.id}
                  c={c}
                  tab={connTab}
                  myId={myId}
                  acting={acting}
                  onAct={handleAct}
                  onTerminate={handleTerminate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <InviteModal
          target={inviteTarget}
          myRole={myRole}
          onClose={() => setInviteTarget(null)}
          onSent={handleInviteSent}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
