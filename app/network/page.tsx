'use client'
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { EmailInviteDialog } from '@/components/ui/EmailInviteDialog'
import { Card, Alert } from '@/components/ui/metronic'

type Mode = 'contacts' | 'find'
type FindType = 'people' | 'coach' | 'doctor' | 'organization'

type SearchUser = {
  id: string
  nickname: string | null
  name: string | null
  role: string
  avatar_url: string | null
  sport: string | null
  city: string | null
  connection_status: 'none' | 'pending' | 'pending_outgoing' | 'pending_incoming' | 'active'
  connection_id: string | null
}

type DirectoryCoach = {
  id: string
  first_name: string
  last_name: string
  city: string | null
  specialization: string | null
  hourly_rate: number | null
  currency: string | null
  accepts_new_athletes: boolean | null
  users: { avatar_url: string | null; nickname: string | null; role: string } | null
}

type DirectoryDoctor = {
  id: string
  first_name: string
  last_name: string
  city: string | null
  medical_specialization: string | null
  consultation_fee: number | null
  currency: string | null
  accepts_new_patients: boolean | null
  users: { avatar_url: string | null; nickname: string | null; role: string } | null
}

type DirectoryOrg = {
  id: string
  org_name: string
  org_slug: string
  description: string | null
  city: string | null
  sport_type: string | null
  org_type: string | null
  members_count: number | null
  users: { avatar_url: string | null; role: string } | null
}

type Connection = {
  id: string
  status: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
  connection_type: string
  initiated_at: string
  message: string | null
  initiator: { id: string; name: string | null; nickname: string | null; avatar_url: string | null; role: string; city: string | null }
  recipient: { id: string; name: string | null; nickname: string | null; avatar_url: string | null; role: string; city: string | null }
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  athlete:      { label: 'Атлет',    color: '#F97316', bg: '#FFF7ED' },
  coach:        { label: 'Тренер',   color: '#16A34A', bg: '#F0FDF4' },
  organization: { label: 'Орг.',     color: '#2563EB', bg: '#EFF6FF' },
  doctor:       { label: 'Доктор',   color: '#DC2626', bg: '#FEF2F2' },
  admin:        { label: 'Админ',    color: '#7C3AED', bg: '#FAF5FF' },
}

function displayName(u: { name?: string | null; first_name?: string | null; last_name?: string | null; nickname?: string | null }) {
  return u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.nickname ? `@${u.nickname}` : 'Пользователь')
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay])
  return d
}

function Avatar({ url, name, role, size = 44 }: { url?: string | null; name: string; role: string; size?: number }) {
  const rm = ROLE_META[role] ?? { color: '#64748B', bg: '#F8FAFC' }
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: url ? 'transparent' : `${rm.color}20`,
      border: `1.5px solid ${rm.color}30`, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.38, fontWeight: 800, color: rm.color }}>
            {name[0]?.toUpperCase() ?? '?'}
          </span>
      }
    </div>
  )
}

function RoleChip({ role }: { role: string }) {
  const rm = ROLE_META[role] ?? { label: role, color: '#64748B', bg: '#F8FAFC' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: rm.bg, color: rm.color, border: `1px solid ${rm.color}22` }}>
      {rm.label}
    </span>
  )
}

function PillButton({ active, onClick, children, icon, accent }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string; accent?: string }) {
  const color = accent ?? '#F97316'
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all"
      style={{
        background: active ? color : 'transparent',
        color: active ? 'white' : 'var(--muted-foreground)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        boxShadow: active ? `0 4px 12px ${color}40` : 'none',
      }}
    >
      {icon && <i className={`ki-filled ${icon} text-[11px]`} />}
      {children}
    </button>
  )
}

// ─── Find sub-panels ─────────────────────────────────────────────────────────

function PeopleSearch({ myRole }: { myRole: string }) {
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [users, setUsers] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const dq = useDebounce(q, 280)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dq) params.set('q', dq)
      if (roleFilter) params.set('role', roleFilter)
      params.set('limit', '30')
      const res = await fetch(`/api/search/users?${params}`)
      const d = await res.json()
      setUsers(d.users ?? d.items ?? [])
    } catch { setUsers([]) } finally { setLoading(false) }
  }, [dq, roleFilter])

  useEffect(() => { load() }, [load])

  const invite = async (u: SearchUser) => {
    setBusy(u.id)
    try {
      const pair = [myRole, u.role].sort().join('|')
      const typeMap: Record<string, string> = {
        'athlete|coach': 'coach_athlete',
        'athlete|organization': 'org_athlete',
        'coach|organization': 'org_coach',
        'athlete|doctor': 'doctor_athlete',
        'coach|doctor': 'coach_doctor',
        'doctor|organization': 'org_doctor',
      }
      const connection_type = typeMap[pair]
      if (!connection_type) { setBusy(null); return }
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: u.id, connection_type }),
      })
      await load()
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
        <i className="ki-filled ki-magnifier text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Имя, @никнейм…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {q && <button onClick={() => setQ('')} className="text-xs text-muted-foreground hover:text-foreground">×</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'athlete', 'coach', 'doctor', 'organization'].map(r => (
          <PillButton key={r || 'all'} active={roleFilter === r} onClick={() => setRoleFilter(r)} accent="#F97316">
            {r === '' ? 'Все роли' : ROLE_META[r]?.label ?? r}
          </PillButton>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Ищу…</div>}
      {!loading && users.length === 0 && <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-10 text-center text-sm text-muted-foreground">Никого не найдено</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {users.map(u => {
          const name = displayName(u)
          const status = u.connection_status
          return (
            <Card key={u.id} className="flex items-center gap-3 p-3">
              <Link href={`/profile/${u.id}`}><Avatar url={u.avatar_url} name={name} role={u.role} /></Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/profile/${u.id}`} className="text-sm font-semibold text-foreground truncate hover:underline">{name}</Link>
                  <RoleChip role={u.role} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                  {u.nickname && <span>@{u.nickname}</span>}
                  {u.sport && <span>{u.sport}</span>}
                  {u.city && <span>{u.city}</span>}
                </div>
              </div>
              <div className="shrink-0">
                {status === 'active' ? (
                  <span className="text-[11px] font-semibold text-[#16A34A]">✓ в связях</span>
                ) : status === 'pending' || status === 'pending_outgoing' ? (
                  <span className="text-[11px] font-semibold text-[#F97316]">Ожидает</span>
                ) : status === 'pending_incoming' ? (
                  <Link href="/network?tab=contacts" className="text-[11px] font-semibold text-[#F97316]">Ответить →</Link>
                ) : (
                  <button
                    onClick={() => invite(u)}
                    disabled={busy === u.id}
                    className="rounded-lg bg-gradient-to-r from-[#F97316] to-[#EA580C] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === u.id ? '…' : 'Пригласить'}
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function DirectorySearch({ type }: { type: 'coach' | 'doctor' | 'organization' }) {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [items, setItems] = useState<(DirectoryCoach | DirectoryDoctor | DirectoryOrg)[]>([])
  const [loading, setLoading] = useState(false)
  const dq = useDebounce(q, 280)
  const dc = useDebounce(city, 280)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type })
      if (dq) params.set('q', dq)
      if (dc) params.set('city', dc)
      const res = await fetch(`/api/directory?${params}`)
      const d = await res.json()
      setItems(d.items ?? [])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [type, dq, dc])

  useEffect(() => { setItems([]); load() }, [load])

  const accent = type === 'coach' ? '#16A34A' : type === 'doctor' ? '#DC2626' : '#2563EB'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
          <i className="ki-filled ki-magnifier text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={type === 'organization' ? 'Название, вид спорта…' : 'Имя, специализация…'} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
          <i className="ki-filled ki-map text-muted-foreground" />
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="Город" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <Alert variant="info" icon="ki-information-5">
        Для точного поиска (специализация, формат, цена) откройте <Link href={`/directory?type=${type}`} className="font-bold underline" style={{ color: accent }}>полный каталог</Link>.
      </Alert>

      {loading && <div className="text-sm text-muted-foreground">Загружаю…</div>}
      {!loading && items.length === 0 && <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-10 text-center text-sm text-muted-foreground">Нет подходящих специалистов</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(item => {
          if (type === 'organization') {
            const o = item as DirectoryOrg
            return (
              <Link key={o.id} href={`/profile/${o.id}`} className="flex flex-col gap-2 rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: `${accent}30` }}>
                <div className="flex items-center gap-3">
                  <Avatar url={o.users?.avatar_url ?? null} name={o.org_name} role="organization" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{o.org_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{[o.org_type, o.sport_type].filter(Boolean).join(' · ') || 'Организация'}</div>
                  </div>
                </div>
                {o.city && <div className="text-[11px] text-muted-foreground">📍 {o.city}</div>}
                {o.members_count ? <div className="text-[11px] text-muted-foreground">{o.members_count} участников</div> : null}
              </Link>
            )
          }
          const u = item as DirectoryCoach | DirectoryDoctor
          const isCoach = type === 'coach'
          const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Специалист'
          const spec = isCoach ? (u as DirectoryCoach).specialization : (u as DirectoryDoctor).medical_specialization
          const price = isCoach ? (u as DirectoryCoach).hourly_rate : (u as DirectoryDoctor).consultation_fee
          const currency = (u as DirectoryCoach).currency ?? 'RUB'
          return (
            <Link key={u.id} href={`/profile/${u.id}`} className="flex flex-col gap-2 rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: `${accent}30` }}>
              <div className="flex items-center gap-3">
                <Avatar url={u.users?.avatar_url ?? null} name={name} role={u.users?.role ?? type} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{spec || (isCoach ? 'Тренер' : 'Врач')}</div>
                </div>
              </div>
              {u.city && <div className="text-[11px] text-muted-foreground">📍 {u.city}</div>}
              {price ? (
                <div className="text-[12px] font-semibold" style={{ color: accent }}>{price} {currency} / {isCoach ? 'час' : 'консультация'}</div>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Contacts sub-panel (lightweight, with deeplink to full /connections) ────

function ContactsPanel() {
  const [conns, setConns] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'incoming' | 'outgoing'>('active')
  const { user } = useUser()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/connections?status=all')
      const d = await res.json()
      setConns(d.connections ?? [])
    } catch { setConns([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const my = user?.id
  const filtered = useMemo(() => {
    if (!my) return []
    return conns.filter(c => {
      if (tab === 'active') return c.status === 'active'
      if (tab === 'incoming') return c.status === 'pending' && c.recipient.id === my
      if (tab === 'outgoing') return c.status === 'pending' && c.initiator.id === my
      return false
    })
  }, [conns, tab, my])

  const counts = useMemo(() => {
    if (!my) return { active: 0, incoming: 0, outgoing: 0 }
    return {
      active: conns.filter(c => c.status === 'active').length,
      incoming: conns.filter(c => c.status === 'pending' && c.recipient.id === my).length,
      outgoing: conns.filter(c => c.status === 'pending' && c.initiator.id === my).length,
    }
  }, [conns, my])

  const act = async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    await fetch(`/api/connections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <PillButton active={tab === 'active'} onClick={() => setTab('active')} icon="ki-check-circle" accent="#16A34A">
          Активные {counts.active > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.active}</span>}
        </PillButton>
        <PillButton active={tab === 'incoming'} onClick={() => setTab('incoming')} icon="ki-inbox-in" accent="#F97316">
          Входящие {counts.incoming > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.incoming}</span>}
        </PillButton>
        <PillButton active={tab === 'outgoing'} onClick={() => setTab('outgoing')} icon="ki-inbox-out" accent="#7C3AED">
          Исходящие {counts.outgoing > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.outgoing}</span>}
        </PillButton>
        <Link href="/connections" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Развёрнуто →
        </Link>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Загружаю…</div>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-10 text-center text-sm text-muted-foreground">
          {tab === 'active' ? 'У вас пока нет активных связей' : tab === 'incoming' ? 'Нет входящих приглашений' : 'Нет исходящих приглашений'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(c => {
          const other = c.initiator.id === my ? c.recipient : c.initiator
          const name = displayName(other)
          return (
            <Card key={c.id} className="flex items-center gap-3 p-3">
              <Link href={`/profile/${other.id}`}><Avatar url={other.avatar_url} name={name} role={other.role} /></Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/profile/${other.id}`} className="text-sm font-semibold text-foreground truncate hover:underline">{name}</Link>
                  <RoleChip role={other.role} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {other.city ? `${other.city} · ` : ''}{new Date(c.initiated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              {tab === 'incoming' ? (
                <div className="shrink-0 flex gap-1.5">
                  <button onClick={() => act(c.id, 'accept')} className="rounded-lg bg-[#16A34A] px-2.5 py-1.5 text-xs font-bold text-white">Принять</button>
                  <button onClick={() => act(c.id, 'decline')} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">Откл.</button>
                </div>
              ) : tab === 'outgoing' ? (
                <button onClick={() => act(c.id, 'cancel')} className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">Отозвать</button>
              ) : (
                <Link href={`/profile/${other.id}`} className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">Профиль →</Link>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function NetworkPageInner() {
  const { user, loading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('contacts')
  const [findType, setFindType] = useState<FindType>('people')
  const [inviteOpen, setInviteOpen] = useState(false)

  // Hydrate state from URL on mount and whenever the query string changes.
  useEffect(() => {
    const tab = searchParams.get('tab')
    setMode(tab === 'find' ? 'find' : 'contacts')
    const t = searchParams.get('type') as FindType | null
    if (t && ['people', 'coach', 'doctor', 'organization'].includes(t)) {
      setFindType(t)
    }
  }, [searchParams])

  // Push URL back whenever tab / findType changes so the view is shareable.
  const syncUrl = useCallback(
    (nextMode: Mode, nextType: FindType) => {
      const params = new URLSearchParams()
      if (nextMode === 'find') {
        params.set('tab', 'find')
        params.set('type', nextType)
      }
      const qs = params.toString()
      router.replace(qs ? `/network?${qs}` : '/network', { scroll: false })
    },
    [router],
  )

  const selectMode = useCallback(
    (m: Mode) => {
      setMode(m)
      syncUrl(m, findType)
    },
    [findType, syncUrl],
  )

  const selectFindType = useCallback(
    (t: FindType) => {
      setFindType(t)
      syncUrl('find', t)
    },
    [syncUrl],
  )

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )
  if (!user) return null

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="relative overflow-hidden rounded-3xl border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-white to-[#EFF6FF] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FED7AA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#F97316]">
            <i className="ki-filled ki-people text-[11px]" />
            Сеть
          </span>
          <h1 className="pf-num text-3xl md:text-4xl leading-tight text-foreground">Контакты и поиск</h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Одно место для ваших связей и поиска новых специалистов. Переключайте режимы и ищите удобно — по имени, роли или каталогу.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PillButton active={mode === 'contacts'} onClick={() => selectMode('contacts')} icon="ki-people" accent="#F97316">
          Мои контакты
        </PillButton>
        <PillButton active={mode === 'find'} onClick={() => selectMode('find')} icon="ki-magnifier" accent="#2563EB">
          Найти
        </PillButton>
        {user.role !== 'athlete' && (
          <button
            onClick={() => setInviteOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#FED7AA] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
          >
            <i className="ki-filled ki-sms text-xs"/>
            Пригласить по email
          </button>
        )}
      </div>
      {inviteOpen && user.role !== 'athlete' && (
        <EmailInviteDialog myRole={user.role as 'coach' | 'doctor' | 'organization' | 'admin'} onClose={() => setInviteOpen(false)} />
      )}

      {mode === 'contacts' && <ContactsPanel />}

      {mode === 'find' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-2">
            <PillButton active={findType === 'people'} onClick={() => selectFindType('people')} icon="ki-user" accent="#64748B">По имени</PillButton>
            <PillButton active={findType === 'coach'} onClick={() => selectFindType('coach')} icon="ki-award" accent="#16A34A">Тренеры</PillButton>
            <PillButton active={findType === 'doctor'} onClick={() => selectFindType('doctor')} icon="ki-heart-circle" accent="#DC2626">Врачи</PillButton>
            <PillButton active={findType === 'organization'} onClick={() => selectFindType('organization')} icon="ki-office-bag" accent="#2563EB">Организации</PillButton>
          </div>

          {findType === 'people' && <PeopleSearch myRole={user.role} />}
          {findType !== 'people' && <DirectorySearch type={findType} />}
        </div>
      )}
    </div>
  )
}

export default function NetworkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
        </div>
      }
    >
      <NetworkPageInner />
    </Suspense>
  )
}
