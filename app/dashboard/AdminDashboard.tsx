import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { fmtDate } from '@/lib/utils/recovery'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [{ count: totalUsers }, { count: athletes }, { count: coaches }, { count: workouts }, { data: recentUsers }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
    supabase.from('workouts').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
    athlete: { bg: '#DBEAFE', text: '#2563EB' },
    coach:   { bg: '#FFEDD5', text: '#F97316' },
    admin:   { bg: '#EDE9FE', text: '#7C3AED' },
  }

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Admin Panel</p>
        <h2 className="pf-num text-3xl text-slate-900 mt-0.5">Platform Overview</h2>
        <p className="text-xs text-slate-400 mt-1">Supabase: atlet-pro · eu-central-1</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Total Users"    value={totalUsers ?? 0} icon="ki-people"      iconColor="#2563EB" />
        <StatCard label="Athletes"       value={athletes ?? 0}   icon="ki-abstract-26"  iconColor="#F97316" />
        <StatCard label="Coaches"        value={coaches ?? 0}    icon="ki-award"        iconColor="#16A34A" />
        <StatCard label="Total Sessions" value={workouts ?? 0}   icon="ki-graph-up"     iconColor="#7C3AED" />
      </div>

      {/* DB schema map */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <p className="pf-num text-xl text-slate-900 mb-4">Database Schema</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { grp:'Identity',   cols:['users','athletes','trainer_athletes'],                    c:'#2563EB' },
            { grp:'Training',   cols:['workouts','cycle_blocks','competitions'],                  c:'#F97316' },
            { grp:'Biometrics', cols:['daily_metrics'],                                           c:'#16A34A' },
            { grp:'Social',     cols:['workout_comments','observation_diary'],                    c:'#7C3AED' },
            { grp:'WHOOP Fields',cols:['hrv · rhr · strain','recovery_score','hr_zone_1–5_min'], c:'#D97706' },
            { grp:'Security',   cols:['RLS on all tables','Auth trigger','Role functions'],       c:'#DC2626' },
          ].map(({ grp, cols, c }) => (
            <div key={grp} className="p-3 rounded-xl" style={{ background: c + '10', border: `1px solid ${c}30` }}>
              <div className="text-xs font-bold mb-2" style={{ color: c }}>{grp}</div>
              {cols.map(col => <div key={col} className="text-[11px] text-slate-500 font-mono leading-5">{col}</div>)}
            </div>
          ))}
        </div>
      </div>

      {/* Recent users table */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <p className="pf-num text-xl text-slate-900 mb-4">Recent Users</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse:'collapse' }}>
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                {['Name','Email','Role','Joined'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers?.map(u => (
                <tr key={u.id} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="py-3 px-3 text-slate-500">{u.email}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={ROLE_STYLE[u.role] ?? { bg:'#F1F5F9', text:'#64748B' }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
