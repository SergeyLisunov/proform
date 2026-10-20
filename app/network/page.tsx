'use client'
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { EmailInviteDialog } from '@/components/ui/EmailInviteDialog'
import { Card, Alert } from '@/components/ui/metronic'
import { Icon } from '@/components/ui/Icon'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { roleMeta } from '@/lib/roles'
import { connectionTypeForRoles, type ConnectionType } from '@/lib/connections/types'
import { connectionRequestError } from '@/lib/connections/request-errors'

type Mode = 'contacts' | 'find'
const FIND_TYPES = ['people', 'coach', 'doctor', 'organization'] as const
type FindType = (typeof FIND_TYPES)[number]
const CONTACT_TABS = ['active', 'incoming', 'outgoing'] as const
type ContactsTab = (typeof CONTACT_TABS)[number]

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

// Роли, по которым можно отфильтровать поиск людей; '' — все роли.
const PEOPLE_ROLE_FILTERS = ['', 'athlete', 'coach', 'doctor', 'specialist', 'organization'] as const

// Отказ ставит паузу на сутки (429 too_soon), а поиск показывает такую пару
// как «нет связи»: без понятной фразы «Пригласить» выглядело бы сломанным.

/**
 * Вид страницы живёт в адресе: ?tab=find&type=coach — поиск,
 * ?tab=incoming / ?tab=outgoing — запросы в «Моих контактах». Так кабинет
 * ведёт прямо к ждущим ответа, а видом можно поделиться ссылкой.
 */
function readView(params: { get(name: string): string | null }): { mode: Mode; findType: FindType; contactsTab: ContactsTab } {
  const tab = params.get('tab') ?? ''
  const type = params.get('type') ?? ''
  return {
    mode: tab === 'find' ? 'find' : 'contacts',
    findType: (FIND_TYPES as readonly string[]).includes(type) ? type as FindType : 'people',
    contactsTab: (CONTACT_TABS as readonly string[]).includes(tab) ? tab as ContactsTab : 'active',
  }
}

function viewHref(mode: Mode, findType: FindType, contactsTab: ContactsTab): string {
  const params = new URLSearchParams()
  if (mode === 'find') {
    params.set('tab', 'find')
    params.set('type', findType)
  } else if (contactsTab !== 'active') {
    params.set('tab', contactsTab)
  }
  const qs = params.toString()
  return qs ? `/network?${qs}` : '/network'
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
  const rm = roleMeta(role)
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: url ? 'transparent' : `${rm.text}20`,
      border: `1.5px solid ${rm.text}30`, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <AvatarImage src={url} alt="" sizes="64px" />
        : <span style={{ fontSize: size * 0.38, fontWeight: 800, color: rm.text }}>
            {name[0]?.toUpperCase() ?? '?'}
          </span>
      }
    </div>
  )
}

function RoleChip({ role }: { role: string }) {
  const rm = roleMeta(role)
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: rm.bg, color: rm.text, border: `1px solid ${rm.text}22` }}>
      {rm.label}
    </span>
  )
}

function PillButton({ active, onClick, children, icon, accent }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string; accent?: string }) {
  const color = accent ?? '#F35703'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all"
      style={{
        background: active ? color : 'transparent',
        color: active ? 'white' : 'var(--muted-foreground)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        boxShadow: active ? `0 4px 12px ${color}40` : 'none',
      }}
    >
      {icon && <Icon name={icon} className="text-[11px]" />}
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
  // Ошибка приглашения — у своей строки: ответ относится к конкретному человеку.
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})
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

  const setInviteError = (userId: string, message: string | null) =>
    setInviteErrors(prev => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([key]) => key !== userId))
      return message ? { ...rest, [userId]: message } : rest
    })

  const invite = async (u: SearchUser, connection_type: ConnectionType) => {
    setBusy(u.id)
    setInviteError(u.id, null)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: u.id, connection_type }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setInviteError(u.id, connectionRequestError(res.status, body))
        return
      }
      await load()
    } catch {
      setInviteError(u.id, 'Не удалось отправить запрос')
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-card px-4 py-3 shadow-xs">
        <Icon name="ki-magnifier" className="text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Имя, @никнейм…"
          className="flex-1 bg-transparent text-sm outline-hidden"
        />
        {q && <button onClick={() => setQ('')} className="text-xs text-muted-foreground hover:text-foreground">×</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {PEOPLE_ROLE_FILTERS.map(r => (
          <PillButton key={r || 'all'} active={roleFilter === r} onClick={() => setRoleFilter(r)} accent="#F35703">
            {r === '' ? 'Все роли' : roleMeta(r).label}
          </PillButton>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Ищу…</div>}
      {!loading && users.length === 0 && <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-10 text-center text-sm text-muted-foreground">Никого не найдено</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {users.map(u => {
          const name = displayName(u)
          const status = u.connection_status
          const connType = connectionTypeForRoles(myRole, u.role)
          const inviteError = inviteErrors[u.id]
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
              <div className="flex shrink-0 flex-col items-end">
                {status === 'active' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]"><Icon name="ki-check" className="text-[11px]" /> в связях</span>
                ) : status === 'pending' || status === 'pending_outgoing' ? (
                  <span className="text-[11px] font-semibold text-[#F35703]">Ожидает</span>
                ) : status === 'pending_incoming' ? (
                  <Link href="/network?tab=incoming" className="text-[11px] font-semibold text-[#F35703]">Ответить →</Link>
                ) : connType ? (
                  <button
                    onClick={() => invite(u, connType)}
                    disabled={busy === u.id}
                    aria-busy={busy === u.id}
                    aria-label={`Пригласить: ${name}`}
                    className="rounded-lg bg-linear-to-r from-[#F35703] to-[#D44A02] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === u.id ? '…' : 'Пригласить'}
                  </button>
                ) : null}
                <p aria-live="polite" className={`max-w-[160px] text-right text-[11px] font-semibold text-destructive ${inviteError ? 'mt-1' : ''}`}>
                  {inviteError}
                </p>
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
        <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-card px-4 py-3 shadow-xs">
          <Icon name="ki-magnifier" className="text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={type === 'organization' ? 'Название, вид спорта…' : 'Имя, специализация…'} className="flex-1 bg-transparent text-sm outline-hidden" />
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-card px-4 py-3 shadow-xs">
          <Icon name="ki-map" className="text-muted-foreground" />
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="Город" className="flex-1 bg-transparent text-sm outline-hidden" />
        </div>
      </div>

      <Alert variant="info" icon="ki-information-4">
        Для точного поиска (специализация, формат, цена) откройте <Link href={`/directory?type=${type}`} className="font-bold underline" style={{ color: accent }}>полный каталог</Link>.
      </Alert>

      {loading && <div className="text-sm text-muted-foreground">Загружаю…</div>}
      {!loading && items.length === 0 && <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-10 text-center text-sm text-muted-foreground">Никого не найдено</div>}

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
                {o.city && <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Icon name="ki-pin" className="text-[11px]" /> {o.city}</div>}
                {o.members_count ? <div className="text-[11px] text-muted-foreground">{o.members_count} участников</div> : null}
              </Link>
            )
          }
          const u = item as DirectoryCoach | DirectoryDoctor
          const isCoach = type === 'coach'
          const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || roleMeta(type).label
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
              {u.city && <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Icon name="ki-pin" className="text-[11px]" /> {u.city}</div>}
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

function ContactsPanel({ tab, onTabChange }: { tab: ContactsTab; onTabChange: (tab: ContactsTab) => void }) {
  const [conns, setConns] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  // «id:действие» — занята одна кнопка, а не вся строка.
  const [acting, setActing] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
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
    setActing(`${id}:${action}`)
    setActError(null)
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        setActError(action === 'cancel' ? 'Не удалось отозвать приглашение' : 'Не удалось ответить на запрос')
        return
      }
      await load()
    } catch {
      setActError('Не удалось связаться с сервером. Попробуйте ещё раз.')
    } finally { setActing(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <PillButton active={tab === 'active'} onClick={() => onTabChange('active')} icon="ki-check-circle" accent="#16A34A">
          Активные {counts.active > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.active}</span>}
        </PillButton>
        <PillButton active={tab === 'incoming'} onClick={() => onTabChange('incoming')} icon="ki-entrance-right" accent="#F35703">
          Входящие {counts.incoming > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.incoming}</span>}
        </PillButton>
        <PillButton active={tab === 'outgoing'} onClick={() => onTabChange('outgoing')} icon="ki-exit-right" accent="#7C3AED">
          Исходящие {counts.outgoing > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{counts.outgoing}</span>}
        </PillButton>
        <Link href="/connections" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Развёрнуто →
        </Link>
      </div>

      {actError && <Alert variant="destructive">{actError}</Alert>}
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
                  <button onClick={() => act(c.id, 'accept')} disabled={acting?.startsWith(`${c.id}:`)} aria-busy={acting === `${c.id}:accept`} aria-label={`Принять запрос: ${name}`} className="rounded-lg bg-[#16A34A] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Принять</button>
                  <button onClick={() => act(c.id, 'decline')} disabled={acting?.startsWith(`${c.id}:`)} aria-busy={acting === `${c.id}:decline`} aria-label={`Отклонить запрос: ${name}`} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50">Откл.</button>
                </div>
              ) : tab === 'outgoing' ? (
                <button onClick={() => act(c.id, 'cancel')} disabled={acting === `${c.id}:cancel`} aria-busy={acting === `${c.id}:cancel`} aria-label={`Отозвать приглашение: ${name}`} className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50">Отозвать</button>
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
  const searchParams = useSearchParams()
  const { mode, findType, contactsTab } = readView(searchParams)
  // Раздел поиска, к которому вернуться из «Моих контактов»: в адресе
  // контактов типа поиска нет.
  const [lastFindType, setLastFindType] = useState<FindType>(findType)
  const [inviteOpen, setInviteOpen] = useState(false)

  // history.replaceState Next.js сводит с useSearchParams: вид меняется
  // сразу, без запроса к серверу, как и прежнее локальное состояние.
  const showView = useCallback((nextMode: Mode, nextType: FindType, nextTab: ContactsTab) => {
    window.history.replaceState(null, '', viewHref(nextMode, nextType, nextTab))
  }, [])

  const selectMode = (m: Mode) => {
    if (mode === 'find') setLastFindType(findType)
    showView(m, mode === 'find' ? findType : lastFindType, 'active')
  }

  const selectFindType = (t: FindType) => {
    setLastFindType(t)
    showView('find', t, 'active')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )
  if (!user) return null

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-linear-to-br from-[#FEF0E7] via-white to-[#EFF6FF] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#F35703]">
            <Icon name="ki-people" className="text-[11px]" />
            Сеть
          </span>
          <h1 className="pf-num text-3xl md:text-4xl leading-tight text-navy-500">Контакты и поиск</h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Одно место для ваших связей и поиска тренеров, врачей и специалистов. Переключайте режимы и ищите удобно — по имени, роли или каталогу.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PillButton active={mode === 'contacts'} onClick={() => selectMode('contacts')} icon="ki-people" accent="#F35703">
          Мои контакты
        </PillButton>
        <PillButton active={mode === 'find'} onClick={() => selectMode('find')} icon="ki-magnifier" accent="#2563EB">
          Найти
        </PillButton>
        <button
          onClick={() => setInviteOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-card px-3.5 py-1.5 text-xs font-semibold text-[#F35703] hover:bg-[#FEF0E7]"
        >
          <Icon name="ki-sms" className="text-xs" />
          Пригласить по email
        </button>
      </div>
      {inviteOpen && (
        <EmailInviteDialog myRole={user.role} onClose={() => setInviteOpen(false)} />
      )}

      {mode === 'contacts' && (
        <ContactsPanel tab={contactsTab} onTabChange={t => showView('contacts', findType, t)} />
      )}

      {mode === 'find' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E2E8F0] bg-card p-2">
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
