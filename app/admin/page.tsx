'use client'
import { useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'

type AdminTab = 'users' | 'audit' | 'system' | 'privacy'

const USERS = [
  { email: 'athlete@proform.test', name: 'Sara Kowalski', role: 'athlete', status: 'active', created: '2025-01-15', lastLogin: '2 hours ago' },
  { email: 'coach@proform.test',   name: 'Alex Trainer',  role: 'coach',   status: 'active', created: '2025-01-10', lastLogin: '1 day ago' },
  { email: 'admin@proform.test',   name: 'Admin User',    role: 'admin',   status: 'active', created: '2025-01-01', lastLogin: 'Just now' },
]

const AUDIT = [
  { actor: 'Sara Kowalski', action: 'login',          target: 'users',    detail: 'Web login',                            time: '2h ago' },
  { actor: 'Sara Kowalski', action: 'create',         target: 'workouts', detail: 'Running 62 min',                       time: '2h ago' },
  { actor: 'Sara Kowalski', action: 'update',         target: 'workouts', detail: 'is_public → true',                     time: '3h ago' },
  { actor: 'Sara Kowalski', action: 'privacy_change', target: 'athletes', detail: 'workouts → coaches_only',              time: '1d ago' },
  { actor: 'Alex Trainer',  action: 'create',         target: 'observation_diary', detail: 'Note: Back on Track',         time: '1d ago' },
  { actor: 'Admin User',    action: 'role_change',    target: 'users',    detail: 'Sara: athlete role confirmed',          time: '5d ago' },
]

const ROLE_BADGE: Record<string, string> = {
  athlete: 'bg-orange-50 text-orange-600 border border-orange-200',
  coach:   'bg-green-50 text-green-600 border border-green-200',
  admin:   'bg-violet-50 text-violet-600 border border-violet-200',
}

const ACTION_BADGE: Record<string, string> = {
  login:          'bg-blue-50 text-blue-600',
  create:         'bg-green-50 text-green-600',
  update:         'bg-orange-50 text-orange-600',
  privacy_change: 'bg-violet-50 text-violet-600',
  role_change:    'bg-red-50 text-red-600',
  delete:         'bg-red-50 text-red-600',
}

export default function AdminPage() {
  const { user } = useUser()
  const [tab, setTab] = useState<AdminTab>('users')
  const [showAssign, setShowAssign] = useState(false)

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <i className="ki-filled ki-shield-cross text-2xl text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Admin Access Required</p>
          <p className="text-2sm text-muted-foreground mt-1">You don't have permission to access this area.</p>
        </div>
      </div>
    )
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'users',   label: 'Users',      icon: 'ki-people' },
    { id: 'privacy', label: 'Privacy',    icon: 'ki-lock' },
    { id: 'audit',   label: 'Audit Log',  icon: 'ki-notepad-edit' },
    { id: 'system',  label: 'System',     icon: 'ki-setting-2' },
  ]

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Administration</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Admin Panel</h2>
        </div>
        <button onClick={() => setShowAssign(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-people text-sm" />
          Assign Athlete
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 pf-stagger">
        {[
          { label: 'Total Users',   value: '3',    icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Active Today',  value: '3',    icon: 'ki-check-circle',  bg: 'bg-green-50 text-green-600' },
          { label: 'DB Tables',     value: '13',   icon: 'ki-data',          bg: 'bg-orange-50 text-orange-500' },
          { label: 'WHOOP Records', value: '100K', icon: 'ki-chart-line-up', bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
              <i className={`ki-filled ${c.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{c.value}</div>
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
                <h3 className="text-sm font-semibold text-foreground">User Management</h3>
                <button className="kt-btn kt-btn-sm kt-btn-primary gap-1.5">
                  <i className="ki-filled ki-plus text-xs" />
                  New User
                </button>
              </div>
              <div className="divide-y divide-border -mx-5">
                {USERS.map((u, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 text-sm font-bold pf-num text-foreground">
                      {u.name.split(' ').map((n:string) => n[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{u.name}</div>
                      <div className="text-2xs text-muted-foreground font-mono">{u.email}</div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                    <div className="text-right hidden md:block shrink-0">
                      <div className="text-2xs text-foreground font-medium">{u.lastLogin}</div>
                      <div className="text-[9px] text-muted-foreground">last login</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button className="kt-btn kt-btn-xs kt-btn-icon kt-btn-outline"><i className="ki-filled ki-pencil text-xs" /></button>
                      <select className="px-2 py-1 rounded-lg border border-border bg-background text-2xs text-muted-foreground outline-none focus:border-orange-400">
                        <option>Change role</option>
                        <option>athlete</option>
                        <option>coach</option>
                        <option>admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRIVACY TAB */}
          {tab === 'privacy' && (
            <div>
              <div className="text-2xs text-muted-foreground mb-4">Privacy settings per athlete. Admins can view and override.</div>
              <div className="space-y-4">
                {USERS.filter(u => u.role === 'athlete').map(u => (
                  <div key={u.email} className="p-4 bg-background border border-border rounded-xl">
                    <div className="text-sm font-semibold text-foreground mb-3">{u.name}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {['profile','workouts','metrics','competitions','diary'].map(resource => (
                        <div key={resource} className="flex items-center justify-between px-3 py-2 bg-card border border-border rounded-lg">
                          <span className="text-2xs font-medium text-foreground capitalize">{resource}</span>
                          <select className="px-2 py-0.5 rounded border border-border bg-background text-2xs text-muted-foreground outline-none focus:border-orange-400">
                            <option value="private">Private</option>
                            <option value="coaches_only">Coaches only</option>
                            <option value="public">Public</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDIT TAB */}
          {tab === 'audit' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Audit Log</h3>
                <button className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
                  <i className="ki-filled ki-abstract-26 text-xs" />
                  Export CSV
                </button>
              </div>
              <div className="divide-y divide-border -mx-5">
                {AUDIT.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/40">
                    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 text-2xs font-bold text-foreground pf-num">
                      {a.actor.split(' ').map((n:string) => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-2sm font-medium text-foreground">{a.actor}</div>
                      <div className="text-2xs text-muted-foreground truncate">{a.detail}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${ACTION_BADGE[a.action] ?? 'bg-border text-muted-foreground'}`}>{a.action.replace('_',' ')}</span>
                      <span className="text-2xs text-muted-foreground hidden sm:block">{a.target}</span>
                      <span className="text-2xs text-muted-foreground">{a.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SYSTEM TAB */}
          {tab === 'system' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { service: 'Supabase Database',   region: 'eu-central-1', status: 'Healthy',  uptime: '99.9%' },
                { service: 'Authentication',       region: 'Global',       status: 'Healthy',  uptime: '100%' },
                { service: 'WHOOP Data Sync',      region: 'eu-central-1', status: 'Active',   uptime: '99.7%' },
                { service: 'Vercel Edge',          region: 'Global',       status: 'Healthy',  uptime: '100%' },
                { service: 'Row Level Security',   region: 'DB Layer',     status: 'Enabled',  uptime: '100%' },
                { service: 'Audit Logging',        region: 'DB Layer',     status: 'Active',   uptime: '100%' },
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
              <h3 className="pf-num text-xl text-foreground">Assign Athlete to Coach</h3>
              <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Athlete</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                  <option>Sara Kowalski (athlete@proform.test)</option>
                </select>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Coach</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                  <option>Alex Trainer (coach@proform.test)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button className="flex-1 kt-btn kt-btn-primary">Assign</button>
                <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-outline">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
