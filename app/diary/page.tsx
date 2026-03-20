'use client'
import { useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { DEMO_SESSIONS, DEMO_DIARY, TYPE_COLORS, RISK_COLORS, recoveryColor } from '@/lib/utils/data'

const FILTER_OPTIONS = ['All', 'Running', 'Cycling', 'Swimming', 'Weight Training', 'Walking']
const RISK_FILTER = ['all', 'low', 'moderate', 'high']
const CATEGORY_FILTER = ['all', 'performance', 'health', 'motivation', 'technique']

// ── Coach Observation Diary ────────────────────────────────────────────────────
function CoachDiary() {
  const [riskFilter, setRiskFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const filtered = DEMO_DIARY.filter(d =>
    (riskFilter === 'all' || d.risk === riskFilter) &&
    (catFilter === 'all' || d.category === catFilter)
  )

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Observation Journal</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Coach Diary</h2>
        </div>
        <button onClick={() => setShowForm(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          New Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: DEMO_DIARY.length, bg: 'bg-blue-50 text-blue-600', icon: 'ki-book-open' },
          { label: 'High Risk',     value: DEMO_DIARY.filter(d => d.risk === 'high' || d.risk === 'critical').length, bg: 'bg-red-50 text-red-500', icon: 'ki-warning-2' },
          { label: 'Moderate',      value: DEMO_DIARY.filter(d => d.risk === 'moderate').length, bg: 'bg-orange-50 text-orange-500', icon: 'ki-information-2' },
          { label: 'On Track',      value: DEMO_DIARY.filter(d => d.risk === 'low').length, bg: 'bg-green-50 text-green-600', icon: 'ki-check-circle' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <i className={`ki-filled ${s.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {RISK_FILTER.map(f => {
            const rc = f !== 'all' ? RISK_COLORS[f] : null
            return (
              <button key={f} onClick={() => setRiskFilter(f)}
                className={[
                  'px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize',
                  riskFilter === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200',
                ].join(' ')}
              >
                {f === 'all' ? 'All Risk' : f}
              </button>
            )
          })}
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto">
          {CATEGORY_FILTER.map(f => (
            <button key={f} onClick={() => setCatFilter(f)}
              className={[
                'px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize',
                catFilter === f ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-card border-border text-muted-foreground hover:border-blue-200',
              ].join(' ')}
            >
              {f === 'all' ? 'All Categories' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-3">
        {filtered.map((entry, i) => {
          const rc = RISK_COLORS[entry.risk as keyof typeof RISK_COLORS]
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-orange-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full border" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      <i className={`ki-filled ${rc.icon} mr-1 text-[10px]`} />
                      {entry.risk.charAt(0).toUpperCase() + entry.risk.slice(1)} Risk
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-border/60 text-muted-foreground capitalize">
                      {entry.category}
                    </span>
                  </div>
                  <div className="text-2xs text-muted-foreground">{entry.date} · Sara Kowalski</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-pencil text-xs text-muted-foreground" /></button>
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{entry.note}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {entry.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-2xs font-medium bg-accent border border-border text-muted-foreground">#{tag}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* New Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="pf-num text-xl text-foreground">New Diary Entry</h3>
              <button onClick={() => setShowForm(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Title</label>
                <input className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400" placeholder="Observation title..." />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Note</label>
                <textarea rows={4} className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 resize-none" placeholder="Detailed observation..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Risk Level</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                    {['low','moderate','high','critical'].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                    {['performance','health','motivation','technique','tactical'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button className="flex-1 kt-btn kt-btn-primary">Save Entry</button>
                <button onClick={() => setShowForm(false)} className="kt-btn kt-btn-outline">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Athlete Training Diary ────────────────────────────────────────────────────
function AthleteDiary() {
  const [filter, setFilter] = useState('All')
  const [view, setView] = useState<'list'|'grid'>('list')
  const sessions = filter === 'All' ? DEMO_SESSIONS : DEMO_SESSIONS.filter(s => s.type === filter)

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Training History</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">My Diary</h2>
        </div>
        <button className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          New Session
        </button>
      </div>

      {/* Filters + view */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={[
              'px-3 py-1.5 rounded-lg text-2sm font-medium border transition-all',
              filter === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
          <button onClick={() => setView('list')} className={`px-2.5 py-1.5 rounded-md transition-all ${view==='list'?'bg-orange-50 text-orange-600':'text-muted-foreground'}`}>
            <i className="ki-filled ki-row-horizontal text-sm" />
          </button>
          <button onClick={() => setView('grid')} className={`px-2.5 py-1.5 rounded-md transition-all ${view==='grid'?'bg-orange-50 text-orange-600':'text-muted-foreground'}`}>
            <i className="ki-filled ki-element-grid text-sm" />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {sessions.map((s, i) => {
              const tc = TYPE_COLORS[s.type] ?? TYPE_COLORS['Walking']
              const rc = recoveryColor(s.recovery)
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: tc.bg, borderColor: tc.border }}>
                    <i className={`ki-filled ${tc.icon} text-sm`} style={{ color: tc.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{s.type}</span>
                      <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-border/60 text-muted-foreground">{s.date}</span>
                    </div>
                    <div className="text-2xs text-muted-foreground mt-0.5">{s.dur} min · {s.avg_hr} bpm · {s.cal} kcal</div>
                  </div>
                  <div className="w-36 hidden sm:block"><ZoneBar zones={s.z} height={24} /></div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-xl leading-none text-foreground">{s.strain}</div>
                    <div className="text-2xs text-muted-foreground">strain</div>
                  </div>
                  <div className="text-right shrink-0 hidden md:block">
                    <div className="pf-num text-lg leading-none" style={{ color: rc }}>{s.recovery}%</div>
                    <div className="text-2xs text-muted-foreground">recovery</div>
                  </div>
                  <i className="ki-filled ki-right text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((s, i) => {
            const tc = TYPE_COLORS[s.type] ?? TYPE_COLORS['Walking']
            const rc = recoveryColor(s.recovery)
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: tc.bg, borderColor: tc.border }}>
                    <i className={`ki-filled ${tc.icon} text-sm`} style={{ color: tc.text }} />
                  </div>
                  <span className="text-2xs font-medium text-muted-foreground">{s.date}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.type}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">{s.dur} min · {s.cal} kcal</div>
                </div>
                <ZoneBar zones={s.z} height={20} />
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <div className="pf-num text-xl leading-none" style={{ color: rc }}>{s.recovery}%</div>
                    <div className="text-2xs text-muted-foreground">recovery</div>
                  </div>
                  <div className="text-right">
                    <div className="pf-num text-xl text-foreground leading-none">{s.strain}</div>
                    <div className="text-2xs text-muted-foreground">strain</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DiaryPage() {
  const { user } = useUser()
  return user?.role === 'coach' ? <CoachDiary /> : <AthleteDiary />
}
