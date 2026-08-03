'use client'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/metronic'
import {
  listAuditLogForUser,
  AUDIT_ACTION_LABEL,
  type AuditLogEntry,
} from '@/services/admin-audit.service'

// ── Types ──────────────────────────────────────────────────────────────────────
type CRMUser = {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  plan: string
  plan_status: string
  workout_count: number
  last_active: string | null
  segment: 'new' | 'active' | 'churned' | 'paying' | 'trial'
}

type UserDetail = CRMUser & {
  // Вкладка «События» читает audit_logs, а не user_events: в user_events
  // никто не пишет (единственная ссылка на таблицу была здесь, в базе ноль
  // строк), поэтому вкладка всегда рисовала «Нет событий» — пустой экран,
  // выдающий себя за работающий. См. services/admin-audit.service.ts.
  events: AuditLogEntry[]
  notes: { id: string; body: string; created_at: string; author_name: string }[]
  workouts: { event_date: string; activity_type: string; activity_strain: number | null }[]
}

type Stats = {
  total: number
  active: number
  paying: number
  new_this_week: number
  free: number
  pro: number
  team: number
}

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** payload журнала — свободный jsonb; печатаем как есть, без домысливания. */
function describeAuditPayload(e: AuditLogEntry): string {
  const who = e.actor_name ?? e.actor_email ?? 'система'
  const p = e.payload
  if (!p || typeof p !== 'object' || Object.keys(p).length === 0) return who
  const details = Object.entries(p)
    .map(([k, v]) => `${k}: ${v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')
  return `${who} — ${details}`
}

function getSegment(u: { created_at: string; workout_count: number; plan: string; last_active: string | null }): CRMUser['segment'] {
  const daysSinceReg = (Date.now() - new Date(u.created_at).getTime()) / 86400000
  if (u.plan === 'pro' || u.plan === 'team') return 'paying'
  if (daysSinceReg < 7) return 'new'
  if (!u.last_active) return 'churned'
  const daysSinceActive = (Date.now() - new Date(u.last_active).getTime()) / 86400000
  if (daysSinceActive > 14) return 'churned'
  return 'active'
}

const SEGMENT_CFG = {
  new:     { label: 'Новый',     bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  active:  { label: 'Активный',  bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  churned: { label: 'Отток',     bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  paying:  { label: 'Платящий',  bg: '#FEF0E7', text: '#F35703', border: '#FBC1A0' },
  trial:   { label: 'Триал',     bg: '#FAF5FF', text: '#9333EA', border: '#E9D5FF' },
}

const PLAN_CFG = {
  free: { label: 'Free',  bg: '#F1F5F9', text: '#64748B' },
  pro:  { label: 'Pro',   bg: '#FEF0E7', text: '#F35703' },
  team: { label: 'Team',  bg: '#F0FDF4', text: '#16A34A' },
}

const ROLE_CFG = {
  athlete:      { label: 'Атлет',    color: '#2563EB' },
  coach:        { label: 'Тренер',   color: '#16A34A' },
  admin:        { label: 'Админ',    color: '#9333EA' },
  organization: { label: 'Орг.',     color: '#F35703' },
}

// ── User Detail Drawer ─────────────────────────────────────────────────────────
function UserDrawer({ userId, adminId, onClose }: { userId: string; adminId: string; onClose: () => void }) {
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [tab, setTab] = useState<'overview' | 'events' | 'notes'>('overview')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  useEffect(() => {
    const sb = getSB()
    async function load() {
      const [
        { data: u },
        { data: sub },
        { data: wks },
        { data: events },
        { data: notes },
      ] = await Promise.all([
        sb.from('users').select('*').eq('id', userId).single(),
        sb.from('subscriptions').select('*').eq('user_id', userId).single(),
        sb.from('workouts').select('event_date, activity_type, activity_strain').eq('athlete_id', userId).order('event_date', { ascending: false }).limit(10),
        // Промис-обёртка: listAuditLogForUser возвращает массив, а не { data }
        listAuditLogForUser(userId, 30).then(rows => ({ data: rows })),
        sb.from('crm_notes').select('*, author:author_id(name)').eq('about_user_id', userId).order('created_at', { ascending: false }),
      ])
      if (!u) return
      const wkList = wks ?? []
      const lastActive = wkList[0]?.event_date ?? null
      const segment = getSegment({ created_at: u.created_at, workout_count: wkList.length, plan: sub?.plan ?? 'free', last_active: lastActive })
      setData({
        id: u.id, name: u.name ?? u.email, email: u.email, role: u.role,
        created_at: u.created_at, plan: sub?.plan ?? 'free',
        plan_status: sub?.status ?? 'active', workout_count: wkList.length,
        last_active: lastActive, segment,
        events: events ?? [],
        notes: (notes ?? []).map((n: { id: string; body: string; created_at: string; author: { name?: string } | null }) => ({
          id: n.id, body: n.body, created_at: n.created_at,
          author_name: n.author?.name ?? 'Admin',
        })),
        workouts: wkList,
      })
      setLoading(false)
    }
    load()
  }, [userId])

  async function addNote() {
    if (!note.trim()) return
    setSavingNote(true)
    const sb = getSB()
    const { data: n } = await sb.from('crm_notes')
      .insert({ about_user_id: userId, author_id: adminId, body: note.trim() })
      .select().single()
    if (n && data) {
      setData(d => d ? { ...d, notes: [{ id: n.id, body: n.body, created_at: n.created_at, author_name: 'Admin' }, ...d.notes] } : d)
    }
    setNote('')
    setSavingNote(false)
  }

  async function changePlan(plan: string) {
    setSavingPlan(true)
    const sb = getSB()
    await sb.from('subscriptions').upsert({ user_id: userId, plan, status: 'active' }, { onConflict: 'user_id' })
    setData(d => d ? { ...d, plan } : d)
    setSavingPlan(false)
  }

  const seg = data ? SEGMENT_CFG[data.segment] : null
  const plan = data ? PLAN_CFG[data.plan as keyof typeof PLAN_CFG] ?? PLAN_CFG.free : null
  const role = data ? ROLE_CFG[data.role as keyof typeof ROLE_CFG] ?? ROLE_CFG.athlete : null

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', transition: 'opacity 0.26s', opacity: visible ? 1 : 0 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '100vw',
        zIndex: 9999, background: 'var(--card)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              {loading ? (
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CRM / Пользователь</span>
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{data?.name}</h2>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{data?.email}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {seg && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: seg.bg, color: seg.text, border: `1px solid ${seg.border}` }}>{seg.label}</span>}
                    {plan && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: plan.bg, color: plan.text }}>{plan.label}</span>}
                    {role && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: role.color + '15', color: role.color }}>{role.label}</span>}
                  </div>
                </>
              )}
            </div>
            <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {([['overview', 'Обзор'], ['events', 'События'], ['notes', 'Заметки']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 8px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', color: tab === id ? '#F35703' : 'var(--muted-foreground)', borderBottom: `2px solid ${tab === id ? '#F35703' : 'transparent'}`, transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? null : tab === 'overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Тренировок', value: data.workout_count, icon: 'ki-abstract-26', color: '#2563EB', bg: '#EFF6FF' },
                  { label: 'Последняя активность', value: fmtDate(data.last_active), icon: 'ki-calendar', color: '#16A34A', bg: '#F0FDF4' },
                  { label: 'Дата регистрации', value: fmtDate(data.created_at), icon: 'ki-time', color: '#9333EA', bg: '#FAF5FF' },
                  { label: 'Статус подписки', value: data.plan_status, icon: 'ki-verify', color: '#F35703', bg: '#FEF0E7' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--accent)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`ki-filled ${s.icon} text-sm`} style={{ color: s.color }} />
                    </div>
                    <div>
                      <div className="pf-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Change plan */}
              <div style={{ background: 'var(--accent)', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Изменить план</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['free', 'pro', 'team'] as const).map(p => (
                    <button key={p} onClick={() => changePlan(p)} disabled={savingPlan || data.plan === p}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${data.plan === p ? '#F35703' : 'var(--border)'}`,
                        background: data.plan === p ? '#fef0e7' : 'var(--card)',
                        color: data.plan === p ? '#F35703' : 'var(--muted-foreground)',
                        fontSize: 12, fontWeight: 700, cursor: data.plan === p ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                      }}>
                      {PLAN_CFG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent workouts */}
              {data.workouts.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Последние тренировки</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.workouts.slice(0, 5).map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--accent)', borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{w.activity_type ?? 'Тренировка'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{fmtDate(w.event_date)}</div>
                        </div>
                        {w.activity_strain != null && (
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#F35703' }}>{Number(w.activity_strain).toFixed(1)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'events' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
                  В журнале аудита нет записей по этому пользователю
                </div>
              ) : data.events.map(e => (
                <div key={e.id} style={{ padding: '10px 14px', background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F35703', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                      {AUDIT_ACTION_LABEL[e.action] ?? e.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1, overflowWrap: 'anywhere' }}>
                      {describeAuditPayload(e)}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {e.created_at ? fmtDateTime(e.created_at) : '—'}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4, lineHeight: 1.5 }}>
                Источник — audit_logs: смена роли, обход врачебного допуска,
                назначения. Обычные действия (вход, тренировки) в журнал
                аудита не пишутся.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Add note */}
              <div>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  placeholder="Заметка по пользователю…"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none" />
                <button onClick={addNote} disabled={!note.trim() || savingNote} className="kt-btn kt-btn-primary mt-2 gap-2">
                  <i className="ki-filled ki-plus text-xs" />{savingNote ? 'Сохранение…' : 'Добавить заметку'}
                </button>
              </div>
              {/* Notes list */}
              {data.notes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>Нет заметок</div>
              ) : data.notes.map(n => (
                <div key={n.id} style={{ padding: '12px 14px', background: 'var(--accent)', borderRadius: 12, borderLeft: '3px solid #F35703' }}>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: '0 0 6px', lineHeight: 1.55 }}>{n.body}</p>
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{n.author_name} · {fmtDateTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main CRM Page ──────────────────────────────────────────────────────────────
export default function AdminCRMPage() {
  const { user, loading: ul } = useUser()
  const router = useRouter()
  const [users, setUsers] = useState<CRMUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segFilter, setSegFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, paying: 0, new_this_week: 0, free: 0, pro: 0, team: 0 })

  // Redirect if not admin
  useEffect(() => {
    if (!ul && user && user.role !== 'admin') router.push('/dashboard')
  }, [user, ul, router])

  const load = useCallback(async () => {
    const sb = getSB()
    const [{ data: usersData }, { data: subsData }, { data: wksData }] = await Promise.all([
      sb.from('users').select('*').order('created_at', { ascending: false }),
      sb.from('subscriptions').select('*'),
      sb.from('workouts').select('athlete_id, event_date'),
    ])
    if (!usersData) { setLoading(false); return }

    const subMap = Object.fromEntries((subsData ?? []).map(s => [s.user_id, s]))
    const wkMap: Record<string, { count: number; last: string | null }> = {}
    ;(wksData ?? []).forEach(w => {
      if (!wkMap[w.athlete_id]) wkMap[w.athlete_id] = { count: 0, last: null }
      wkMap[w.athlete_id].count++
      if (!wkMap[w.athlete_id].last || w.event_date > wkMap[w.athlete_id].last!) {
        wkMap[w.athlete_id].last = w.event_date
      }
    })

    const enriched: CRMUser[] = usersData.map(u => {
      const sub = subMap[u.id]
      const wk = wkMap[u.id] ?? { count: 0, last: null }
      const segment = getSegment({ created_at: u.created_at, workout_count: wk.count, plan: sub?.plan ?? 'free', last_active: wk.last })
      return {
        id: u.id, name: u.name ?? u.email ?? '—', email: u.email ?? '—',
        role: u.role ?? 'athlete', created_at: u.created_at,
        plan: sub?.plan ?? 'free', plan_status: sub?.status ?? 'active',
        workout_count: wk.count, last_active: wk.last, segment,
      }
    })

    setUsers(enriched)

    const weekAgo = new Date(Date.now() - 7 * 86400000)
    setStats({
      total: enriched.length,
      active: enriched.filter(u => u.segment === 'active').length,
      paying: enriched.filter(u => u.segment === 'paying').length,
      new_this_week: enriched.filter(u => new Date(u.created_at) >= weekAgo).length,
      free: enriched.filter(u => u.plan === 'free').length,
      pro:  enriched.filter(u => u.plan === 'pro').length,
      team: enriched.filter(u => u.plan === 'team').length,
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (ul || loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (user?.role !== 'admin') return null

  const filtered = users.filter(u => {
    if (search && !(u.name + u.email).toLowerCase().includes(search.toLowerCase())) return false
    if (segFilter !== 'all' && u.segment !== segFilter) return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (planFilter !== 'all' && u.plan !== planFilter) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6 pf-enter">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Администрирование</p>
          <h2 className="pf-num text-[34px] text-navy-500 leading-none">CRM</h2>
        </div>
        <button onClick={() => load()} className="kt-btn kt-btn-outline gap-2">
          <i className="ki-filled ki-arrows-circle text-sm" />Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Всего', value: stats.total, icon: 'ki-people', color: '#64748B', bg: '#F8FAFC' },
          { label: 'Активных', value: stats.active, icon: 'ki-check-circle', color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Платящих', value: stats.paying, icon: 'ki-dollar', color: '#F35703', bg: '#FEF0E7' },
          { label: 'За неделю', value: `+${stats.new_this_week}`, icon: 'ki-arrow-up', color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Free', value: stats.free, icon: 'ki-abstract-26', color: '#64748B', bg: '#F1F5F9' },
          { label: 'Pro', value: stats.pro, icon: 'ki-star', color: '#F35703', bg: '#FEF0E7' },
          { label: 'Team', value: stats.team, icon: 'ki-people', color: '#16A34A', bg: '#F0FDF4' },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ki-filled ${s.icon} text-sm`} style={{ color: s.color }} />
            </div>
            <div>
              <div className="pf-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: 200, maxWidth: 320 }}>
          <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 13 }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или email…"
            className="w-full rounded-xl border border-input text-sm outline-none bg-card focus:border-orange-400"
            style={{ padding: '10px 12px 10px 34px' }} />
        </div>

        {/* Segment filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'Все'], ['new', 'Новые'], ['active', 'Активные'], ['churned', 'Отток'], ['paying', 'Платящие']].map(([v, l]) => (
            <button key={v} onClick={() => setSegFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold border transition-all ${segFilter === v ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Role filter */}
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="rounded-xl border border-input text-sm outline-none bg-card px-3 py-2 focus:border-orange-400">
          <option value="all">Все роли</option>
          <option value="athlete">Атлеты</option>
          <option value="coach">Тренеры</option>
          <option value="organization">Организации</option>
          <option value="admin">Администраторы</option>
        </select>

        {/* Plan filter */}
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          className="rounded-xl border border-input text-sm outline-none bg-card px-3 py-2 focus:border-orange-400">
          <option value="all">Все планы</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="team">Team</option>
        </select>

        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
          {filtered.length} из {users.length}
        </span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--accent)' }}>
          {['Пользователь', 'Роль', 'Сегмент', 'План', 'Тренировок', 'Дата'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            Нет пользователей по выбранным фильтрам
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(u => {
              const seg = SEGMENT_CFG[u.segment]
              const pln = PLAN_CFG[u.plan as keyof typeof PLAN_CFG] ?? PLAN_CFG.free
              const rol = ROLE_CFG[u.role as keyof typeof ROLE_CFG] ?? ROLE_CFG.athlete
              const initials = u.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={u.id} onClick={() => setSelectedUser(u.id)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s', alignItems: 'center' }}
                  className="hover:bg-accent/50">

                  {/* User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F35703,#D44A02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, background: rol.color + '15', color: rol.color }}>
                      {rol.label}
                    </span>
                  </div>

                  {/* Segment */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: seg.bg, color: seg.text, border: `1px solid ${seg.border}` }}>
                      {seg.label}
                    </span>
                  </div>

                  {/* Plan */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: pln.bg, color: pln.text }}>
                      {pln.label}
                    </span>
                  </div>

                  {/* Workouts */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }} className="pf-num">
                    {u.workout_count}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {fmtDate(u.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* User drawer */}
      {selectedUser && user && (
        <UserDrawer
          userId={selectedUser}
          adminId={user.id}
          onClose={() => { setSelectedUser(null); load() }}
        />
      )}
    </div>
  )
}
