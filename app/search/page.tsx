'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'

type UserRole = 'athlete' | 'coach' | 'organization'

type SearchUser = {
  id: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
  role: string
  avatar_url: string | null
  sport: string | null
  city: string | null
  connection_status: 'none' | 'pending' | 'active'
}

const ROLE_FILTER_OPTIONS = [
  { value: '',             label: 'Все' },
  { value: 'athlete',      label: 'Атлеты' },
  { value: 'coach',        label: 'Тренеры' },
  { value: 'organization', label: 'Организации' },
]

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  athlete:      { label: 'Атлет',      color: '#F97316', bg: '#FFF7ED' },
  coach:        { label: 'Тренер',     color: '#16A34A', bg: '#F0FDF4' },
  organization: { label: 'Орг.',       color: '#2563EB', bg: '#EFF6FF' },
}

// Connection type logic based on my role → their role
function getConnectionType(myRole: string, theirRole: string): string | null {
  if (myRole === 'athlete'  && theirRole === 'coach')        return 'coach_athlete'
  if (myRole === 'coach'    && theirRole === 'athlete')      return 'coach_athlete'
  if (myRole === 'organization' && theirRole === 'coach')    return 'org_coach'
  if (myRole === 'organization' && theirRole === 'athlete')  return 'org_athlete'
  if (myRole === 'coach'    && theirRole === 'organization') return 'org_coach'
  if (myRole === 'athlete'  && theirRole === 'organization') return 'org_athlete'
  return null
}

function UserCard({
  user, myRole, onConnect, loadingId,
}: {
  user: SearchUser
  myRole: string
  onConnect: (userId: string, connType: string) => void
  loadingId: string | null
}) {
  const connType = getConnectionType(myRole, user.role)
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.nickname || 'Без имени'
  const roleMeta = ROLE_META[user.role] ?? { label: user.role, color: '#64748B', bg: '#F8FAFC' }
  const loading = loadingId === user.id

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 20, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
      }}>
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: `linear-gradient(135deg, ${roleMeta.color}30, ${roleMeta.color}10)`,
        border: `1.5px solid ${roleMeta.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 700, color: roleMeta.color,
      }}>
        {displayName[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{displayName}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: roleMeta.bg, color: roleMeta.color,
            border: `1px solid ${roleMeta.color}22`,
          }}>{roleMeta.label}</span>
        </div>
        {user.nickname && (
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 1 }}>@{user.nickname}</div>
        )}
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {user.sport && <span><i className="ki-filled ki-abstract-26 text-[10px]" /> {user.sport}</span>}
          {user.city  && <span><i className="ki-filled ki-map-marker text-[10px]" /> {user.city}</span>}
        </div>
      </div>

      {/* Action */}
      <div style={{ flexShrink: 0 }}>
        {user.connection_status === 'active' ? (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 10,
            background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <i className="ki-filled ki-check-circle text-xs" />Связаны
          </span>
        ) : user.connection_status === 'pending' ? (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 10,
            background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <i className="ki-filled ki-time text-xs" />Ожидает
          </span>
        ) : connType ? (
          <button
            onClick={() => onConnect(user.id, connType)}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0',
              background: loading ? 'var(--muted)' : 'var(--card)',
              color: loading ? 'var(--muted-foreground)' : 'var(--foreground)',
              fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316'; (e.currentTarget as HTMLButtonElement).style.background = '#FFF7ED' }}}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)' }}
          >
            {loading
              ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Отправка…</>
              : <><i className="ki-filled ki-user-plus text-xs" />Пригласить</>
            }
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function SearchPage() {
  const { user } = useUser()
  const [query, setQuery]       = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [results, setResults]   = useState<SearchUser[]>([])
  const [total, setTotal]       = useState(0)
  const [searching, setSearching] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, role: string) => {
    if (q.length < 1) { setResults([]); setTotal(0); return }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q, limit: '30' })
      if (role) params.set('role', role)
      const res = await fetch(`/api/search/users?${params}`)
      const data = await res.json()
      setResults(data.users ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(query, roleFilter), 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, roleFilter, doSearch])

  async function handleConnect(recipientId: string, connType: string) {
    setLoadingId(recipientId)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId, connection_type: connType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      // Update local state
      setResults(prev => prev.map(u => u.id === recipientId ? { ...u, connection_status: 'pending' } : u))
      showToast('Приглашение отправлено', true)
    } catch (e: any) {
      showToast(e.message, false)
    } finally {
      setLoadingId(null)
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="flex flex-col gap-6 pf-enter" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 14,
          }}>
            <i className="ki-filled ki-left" style={{ fontSize: 13 }} />
          </Link>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Поиск</p>
          <h1 className="pf-num" style={{ fontSize: 34, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1 }}>Найти людей</h1>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 16, pointerEvents: 'none' }} />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          )}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по имени или @никнейму…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px 12px 40px', borderRadius: 14,
              border: '1.5px solid var(--border)', background: 'var(--background)',
              fontSize: 14, outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#F97316')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            autoFocus
          />
        </div>

        {/* Role filter tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {ROLE_FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setRoleFilter(opt.value)} style={{
              padding: '6px 14px', borderRadius: 10, border: '1.5px solid',
              borderColor: roleFilter === opt.value ? '#F97316' : 'var(--border)',
              background: roleFilter === opt.value ? '#FFF7ED' : 'var(--card)',
              color: roleFilter === opt.value ? '#F97316' : 'var(--muted-foreground)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {query.length > 0 && !searching && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
          <i className="ki-filled ki-search-list text-3xl block mb-3" style={{ color: 'var(--border)' }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>Никого не найдено</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Попробуйте другой запрос или поищите по @никнейму</p>
        </div>
      )}

      {query.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
          <i className="ki-filled ki-people text-4xl block mb-3" style={{ color: 'var(--border)' }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>Начните вводить имя или @никнейм</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Поиск среди атлетов, тренеров и организаций</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
              Найдено: {total}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(u => (
              <UserCard
                key={u.id}
                user={u}
                myRole={user?.role ?? ''}
                onConnect={handleConnect}
                loadingId={loadingId}
              />
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 18px', borderRadius: 14,
          background: toast.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${toast.ok ? '#BBF7D0' : '#FECACA'}`,
          color: toast.ok ? '#15803D' : '#DC2626',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <i className={`ki-filled ${toast.ok ? 'ki-check-circle' : 'ki-information-5'} text-sm`} />
          {toast.msg}
        </div>
      )}

    </div>
  )
}
