'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AdminTab = 'users' | 'audit' | 'system'

type DBUser = {
  id: string
  name: string | null
  email: string | null
  role: string
  created_at: string
}

type RecentActivity = {
  id: string
  actor: string
  action: string
  detail: string
  table_name: string
  created_at: string
}

const ROLE_BADGE: Record<string, string> = {
  athlete:      'bg-orange-50 text-orange-600 border border-orange-200',
  coach:        'bg-green-50 text-green-600 border border-green-200',
  admin:        'bg-violet-50 text-violet-600 border border-violet-200',
  organization: 'bg-blue-50 text-blue-600 border border-blue-200',
}

const ROLE_LABEL: Record<string, string> = {
  athlete: 'Атлет', coach: 'Тренер', admin: 'Администратор', organization: 'Организация',
}

function initials(name: string | null, email: string | null) {
  const src = name || email || '?'
  return src.split(/[\s@]/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminPage() {
  const { user } = useUser()
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<AdminTab>('users')

  // Users tab
  const [users, setUsers] = useState<DBUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState({ total: 0, athletes: 0, coaches: 0, workouts: 0 })

  // Activity
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [actLoading, setActLoading] = useState(false)

  // Assign modal
  const [showAssign, setShowAssign] = useState(false)
  const [assignAthlete, setAssignAthlete] = useState('')
  const [assignCoach, setAssignCoach] = useState('')
  const [assigning, setAssigning] = useState(false)

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const sb = getSB()
    const { data, error } = await sb
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setUsersLoading(false); return }
    const list = (data ?? []) as DBUser[]
    setUsers(list)
    setStats({
      total: list.length,
      athletes: list.filter(u => u.role === 'athlete').length,
      coaches: list.filter(u => u.role === 'coach').length,
      workouts: 0, // loaded separately
    })
    setUsersLoading(false)
  }, [])

  const loadWorkoutCount = useCallback(async () => {
    const sb = getSB()
    const { count } = await sb.from('workouts').select('*', { count: 'exact', head: true })
    setStats(prev => ({ ...prev, workouts: count ?? 0 }))
  }, [])

  const loadActivity = useCallback(async () => {
    setActLoading(true)
    const sb = getSB()
    // Show recent workouts as activity feed
    const { data } = await sb
      .from('workouts')
      .select('id, activity_type, event_date, created_at, athlete_id, users!workouts_athlete_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(30)
    const items: RecentActivity[] = (data ?? []).map((w: any) => ({
      id: w.id,
      actor: w.users?.name ?? w.users?.email ?? 'Атлет',
      action: 'create',
      detail: `${w.activity_type ?? 'Тренировка'} · ${w.event_date}`,
      table_name: 'workouts',
      created_at: w.created_at,
    }))
    setActivity(items)
    setActLoading(false)
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadUsers()
    loadWorkoutCount()
  }, [user, loadUsers, loadWorkoutCount])

  useEffect(() => {
    if (tab === 'audit' && activity.length === 0) loadActivity()
  }, [tab, activity.length, loadActivity])

  async function changeRole(userId: string, newRole: string) {
    setChangingRole(userId)
    const sb = getSB()
    const { error } = await sb.from('users').update({ role: newRole }).eq('id', userId)
    if (error) { toastError('Ошибка смены роли'); setChangingRole(null); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    success('Роль обновлена')
    setChangingRole(null)
  }

  async function handleAssign() {
    if (!assignAthlete || !assignCoach) return
    setAssigning(true)
    const sb = getSB()
    const { error } = await sb
      .from('athletes')
      .update({ coach_id: assignCoach })
      .eq('id', assignAthlete)
    if (error) { toastError('Ошибка назначения тренера'); setAssigning(false); return }
    success('Тренер назначен')
    setAssigning(false)
    setShowAssign(false)
    setAssignAthlete('')
    setAssignCoach('')
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <i className="ki-filled ki-shield-cross text-2xl text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Доступ запрещён</p>
          <p className="text-2sm text-muted-foreground mt-1">У вас нет прав для доступа к этому разделу.</p>
        </div>
      </div>
    )
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'users',  label: 'Пользователи',   icon: 'ki-people' },
    { id: 'audit',  label: 'Активность',      icon: 'ki-notepad-edit' },
    { id: 'system', label: 'Система',         icon: 'ki-setting-2' },
  ]

  const athletes = users.filter(u => u.role === 'athlete')
  const coaches  = users.filter(u => u.role === 'coach')

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Администрирование</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Панель администратора</h2>
        </div>
        <button onClick={() => setShowAssign(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-people text-sm" />
          Назначить атлета
        </button>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/orgs" className="kt-btn kt-btn-outline gap-2">
          <i className="ki-filled ki-office-bag text-sm" />
          Управление организациями
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 pf-stagger">
        {[
          { label: 'Всего пользователей', value: stats.total,    icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Атлетов',             value: stats.athletes, icon: 'ki-abstract-26',   bg: 'bg-orange-50 text-orange-500' },
          { label: 'Тренеров',            value: stats.coaches,  icon: 'ki-teacher',       bg: 'bg-green-50 text-green-600' },
          { label: 'Тренировок в БД',     value: stats.workouts, icon: 'ki-chart-line-up', bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
              <i className={`ki-filled ${c.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{usersLoading ? '…' : c.value}</div>
              <div className="text-2xs text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border px-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-3 text-2sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <i className={`ki-filled ${t.icon} text-xs`} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* USERS TAB */}
          {tab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Управление пользователями
                  {!usersLoading && <span className="ml-2 text-muted-foreground font-normal">({users.length})</span>}
                </h3>
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Пользователи не найдены</p>
              ) : (
                <div className="divide-y divide-border -mx-5">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 text-sm font-bold pf-num text-foreground">
                        {initials(u.name, u.email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{u.name ?? '—'}</div>
                        <div className="text-2xs text-muted-foreground font-mono">{u.email ?? '—'}</div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${ROLE_BADGE[u.role] ?? 'bg-border text-muted-foreground'}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      <div className="text-right hidden md:block shrink-0">
                        <div className="text-2xs text-muted-foreground">{fmtDate(u.created_at)}</div>
                        <div className="text-[9px] text-muted-foreground">создан</div>
                      </div>
                      <div className="shrink-0">
                        {changingRole === u.id ? (
                          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <select
                            value={u.role}
                            onChange={e => changeRole(u.id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-border bg-background text-2xs text-muted-foreground outline-none focus:border-orange-400"
                          >
                            <option value="athlete">Атлет</option>
                            <option value="coach">Тренер</option>
                            <option value="organization">Организация</option>
                            <option value="admin">Администратор</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AUDIT TAB */}
          {tab === 'audit' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Последняя активность</h3>
                <button onClick={loadActivity} className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
                  <i className="ki-filled ki-arrows-circle text-xs" />
                  Обновить
                </button>
              </div>
              {actLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Активности пока нет</p>
              ) : (
                <div className="divide-y divide-border -mx-5">
                  {activity.map(a => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/40">
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 text-2xs font-bold text-foreground pf-num">
                        {initials(a.actor, null)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-2sm font-medium text-foreground">{a.actor}</div>
                        <div className="text-2xs text-muted-foreground truncate">{a.detail}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-green-50 text-green-600">{a.table_name}</span>
                        <span className="text-2xs text-muted-foreground hidden sm:block">{fmtDate(a.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SYSTEM TAB */}
          {tab === 'system' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { service: 'Supabase Database',   region: 'eu-central-1', status: 'Работает', uptime: '99.9%' },
                { service: 'Аутентификация',       region: 'Global',       status: 'Работает', uptime: '100%' },
                { service: 'WHOOP Data Sync',      region: 'eu-central-1', status: 'Активно',  uptime: '99.7%' },
                { service: 'Vercel Edge',          region: 'Global',       status: 'Работает', uptime: '100%' },
                { service: 'Row Level Security',   region: 'DB Layer',     status: 'Включено', uptime: '100%' },
                { service: 'Realtime Messages',    region: 'eu-central-1', status: 'Активно',  uptime: '99.9%' },
              ].map(s => (
                <div key={s.service} className="flex items-center gap-3 p-3.5 bg-background border border-border rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-2sm font-semibold text-foreground truncate">{s.service}</div>
                    <div className="text-2xs text-muted-foreground">{s.region}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xs font-bold text-green-600">{s.status}</div>
                    <div className="text-2xs text-muted-foreground">{s.uptime}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Athlete Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="pf-num text-xl text-foreground">Назначить атлета тренеру</h3>
              <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Атлет</label>
                <select
                  value={assignAthlete}
                  onChange={e => setAssignAthlete(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400"
                >
                  <option value="">— Выбрать атлета —</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Тренер</label>
                <select
                  value={assignCoach}
                  onChange={e => setAssignCoach(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400"
                >
                  <option value="">— Выбрать тренера —</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name ?? c.email}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAssign}
                  disabled={!assignAthlete || !assignCoach || assigning}
                  className="flex-1 kt-btn kt-btn-primary"
                >
                  {assigning ? 'Назначение…' : 'Назначить'}
                </button>
                <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-outline">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
