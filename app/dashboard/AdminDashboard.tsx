import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils/recovery'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Database } from '@/types/database'

const AdminHeroBar      = dynamic(() => import('@/components/admin/AdminHeroBar'),      { ssr: false })
const AdminQuickActions = dynamic(() => import('@/components/admin/AdminQuickActions'), { ssr: false })

type UserRow = Database['public']['Tables']['users']['Row']

const ROLE_STYLE: Record<string, { background: string; color: string }> = {
  athlete:      { background: '#DBEAFE', color: '#2563EB' },
  coach:        { background: '#FFEDD5', color: '#F97316' },
  doctor:       { background: '#FEE2E2', color: '#DC2626' },
  organization: { background: '#FAF5FF', color: '#9333EA' },
  admin:        { background: '#EDE9FE', color: '#7C3AED' },
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { count: totalUsers },
    { count: athletes },
    { count: coaches },
    { count: doctors },
    { count: orgs },
    { count: workouts },
    { count: newUsersWeek },
    { count: newWorkoutsWeek },
    { count: openInjuries },
    { count: scheduledCheckups },
    { count: pendingInvites },
    { data: recentUsersData },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'organization'),
    supabase.from('workouts').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('workouts').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('injuries').select('*', { count: 'exact', head: true }).neq('status', 'recovered'),
    supabase.from('medical_checkups').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('email_invites').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const recentUsers = (recentUsersData ?? []) as Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'created_at'>[]

  return (
    <div className="flex flex-col gap-5 pf-page-enter">

      {/* 1. HERO */}
      <AdminHeroBar
        stats={{
          totalUsers:      totalUsers ?? 0,
          athletes:        athletes ?? 0,
          coaches:         coaches ?? 0,
          workouts:        workouts ?? 0,
          newUsersWeek:    newUsersWeek ?? 0,
          newWorkoutsWeek: newWorkoutsWeek ?? 0,
        }}
      />

      {/* 2. QUICK ACTIONS */}
      <AdminQuickActions />

      {/* 3. PLATFORM HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User mix */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Состав</p>
              <h3 className="text-base font-bold text-foreground">Распределение по ролям</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">{totalUsers ?? 0} всего</span>
          </div>

          {(() => {
            const total = (athletes ?? 0) + (coaches ?? 0) + (doctors ?? 0) + (orgs ?? 0) || 1
            const items = [
              { label: 'Атлеты',       count: athletes ?? 0, color: '#F97316' },
              { label: 'Тренеры',      count: coaches ?? 0,  color: '#16A34A' },
              { label: 'Врачи',        count: doctors ?? 0,  color: '#DC2626' },
              { label: 'Организации',  count: orgs ?? 0,     color: '#7C3AED' },
            ]
            return (
              <div className="space-y-3">
                {items.map(it => {
                  const pct = Math.round((it.count / total) * 100)
                  return (
                    <div key={it.label}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-semibold text-foreground">{it.label}</span>
                        <span className="text-muted-foreground">{it.count} <span className="text-[10px]">· {pct}%</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: it.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Live signals */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Сигналы</p>
              <h3 className="text-base font-bold text-foreground">Активность платформы</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Signal
              label="Активных травм"
              value={openInjuries ?? 0}
              icon="ki-shield-cross"
              color="#DC2626"
              hint="требуют наблюдения врача"
            />
            <Signal
              label="Назначено осмотров"
              value={scheduledCheckups ?? 0}
              icon="ki-heart-circle"
              color="#EA580C"
              hint="в работе у докторов"
            />
            <Signal
              label="Pending invites"
              value={pendingInvites ?? 0}
              icon="ki-sms"
              color="#9333EA"
              hint="ждут принятия"
            />
            <Signal
              label="Новых тренировок"
              value={newWorkoutsWeek ?? 0}
              icon="ki-graph-up"
              color="#2563EB"
              hint="за последние 7 дней"
            />
          </div>
        </div>
      </div>

      {/* 4. SCHEMA MAP */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="pf-num text-base font-bold text-slate-900 mb-3">Схема базы данных</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { grp: 'Идентификация',  cols: ['users', 'athletes', 'trainer_athletes', 'connections'], c: '#2563EB' },
            { grp: 'Тренировки',     cols: ['workouts', 'cycle_blocks', 'competitions', 'workout_templates'], c: '#F97316' },
            { grp: 'Биометрика',     cols: ['daily_metrics', 'user_device_connections'], c: '#16A34A' },
            { grp: 'Медицина',       cols: ['injuries', 'medical_checkups', 'medical_diary'], c: '#DC2626' },
            { grp: 'Дневники',       cols: ['observation_diary', 'workout_comments', 'notes'], c: '#7C3AED' },
            { grp: 'Биллинг',        cols: ['subscriptions', 'athlete_passes', 'payments', 'referral_credits'], c: '#9333EA' },
            { grp: 'Маркетинг',      cols: ['tool_leads', 'email_invites', 'newsletters'], c: '#EA580C' },
            { grp: 'Организации',    cols: ['organizations', 'org_group_sessions', 'org_session_participants', 'wall_posts'], c: '#0891B2' },
            { grp: 'Безопасность',   cols: ['RLS on all tables', 'auth trigger', 'role functions', 'audit_logs'], c: '#475569' },
          ].map(({ grp, cols, c }) => (
            <div key={grp} className="p-3 rounded-xl" style={{ background: c + '10', border: `1px solid ${c}30` }}>
              <div className="text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: c }}>{grp}</div>
              {cols.map(col => <div key={col} className="text-[10px] text-muted-foreground font-mono leading-4">{col}</div>)}
            </div>
          ))}
        </div>
      </div>

      {/* 5. RECENT USERS */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">CRM</p>
            <h3 className="text-base font-bold text-foreground">Последние регистрации</h3>
          </div>
          <Link href="/admin/crm" className="text-[11px] font-semibold text-purple-600 hover:underline">
            Все пользователи →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-muted/30">
                {['Имя', 'Email', 'Роль', 'Дата'].map(h => (
                  <th key={h} className="text-left py-2 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.map(u => (
                <tr key={u.id} className="border-b border-[#F8FAFC] hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-foreground">{u.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={ROLE_STYLE[u.role] ?? { background: '#F1F5F9', color: '#64748B' }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{fmtDate(u.created_at ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Signal({
  label, value, icon, color, hint,
}: { label: string; value: number; icon: string; color: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 mb-1">
        <i className={`ki-filled ${icon} text-base`} style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="pf-num text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  )
}
