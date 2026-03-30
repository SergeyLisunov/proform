'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DEMO_SESSIONS, DEMO_COMPETITIONS, DEMO_CYCLES, CYCLE_COLORS, EVENT_COLORS, recoveryColor } from '@/lib/utils/data'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { useUser } from '@/lib/hooks/useUser'
import { createCalendarEvent, deleteCalendarEvent, EVENT_TYPES, type CalendarEvent, type EventType } from '@/services/calendar.service'

type ViewMode = 'month' | 'week' | 'year' | 'quarter'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// Build heatmap data: date → { strain, sessions, hasCompetition }
function buildHeatmap() {
  const map: Record<string, { strain: number; sessions: number; hasComp: boolean; hasEvent: boolean }> = {}
  DEMO_SESSIONS.forEach(s => {
    map[s.date] = { strain: s.strain, sessions: 1, hasComp: false, hasEvent: false }
  })
  DEMO_COMPETITIONS.forEach(c => {
    if (map[c.date]) map[c.date].hasComp = true
    else map[c.date] = { strain: 0, sessions: 0, hasComp: true, hasEvent: false }
  })
  return map
}
const HEATMAP = buildHeatmap()

function strainColor(strain: number): string {
  if (strain === 0) return '#F1F5F9'
  if (strain < 8)  return '#DBEAFE'
  if (strain < 12) return '#93C5FD'
  if (strain < 15) return '#3B82F6'
  return '#1D4ED8'
}

// ── YEAR VIEW ────────────────────────────────────────────────────────────────
function YearView({ year, onSelect }: { year: number; onSelect: (date: string) => void }) {
  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-center gap-3 flex-wrap">
        {['blue','orange','green'].map(c => (
          <div key={c} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="w-3 h-3 rounded-sm" style={{ background: c === 'blue' ? CYCLE_COLORS.macro.bg : c === 'orange' ? CYCLE_COLORS.meso.bg : CYCLE_COLORS.micro.bg, border: `1px solid ${c === 'blue' ? CYCLE_COLORS.macro.border : c === 'orange' ? CYCLE_COLORS.meso.border : CYCLE_COLORS.micro.border}` }} />
            {c === 'blue' ? 'Macrocycle' : c === 'orange' ? 'Mesocycle' : 'Microcycle'}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground ml-auto">
          <span className="text-2xs text-muted-foreground">Strain intensity:</span>
          {['#DBEAFE','#93C5FD','#3B82F6','#1D4ED8'].map((c,i) => (
            <span key={i} className="w-4 h-3 rounded-sm inline-block" style={{ background: c }} />
          ))}
          <span className="text-2xs text-muted-foreground">High</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {MONTHS.map((month, mi) => {
          const firstDay = new Date(year, mi, 1).getDay()
          const offset = (firstDay + 6) % 7
          const days = new Date(year, mi + 1, 0).getDate()
          const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
          while (cells.length % 7 !== 0) cells.push(null)

          return (
            <div key={month} className="bg-card border border-border rounded-xl p-3">
              <div className="text-2xs font-bold text-foreground uppercase tracking-wider mb-2">{MONTHS_FULL[mi]}</div>
              <div className="grid grid-cols-7 gap-[2px] mb-1">
                {['M','T','W','T','F','S','S'].map((d,i) => (
                  <div key={i} className="text-center text-[8px] text-muted-foreground/60 font-medium pb-0.5">{d}</div>
                ))}
                {cells.map((day, di) => {
                  if (!day) return <div key={di} />
                  const dateStr = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const h = HEATMAP[dateStr]
                  const today = new Date().toISOString().slice(0,10)
                  const isCycle = DEMO_CYCLES.find(c => dateStr >= c.start && dateStr <= c.end && c.type === 'macro')

                  return (
                    <div
                      key={di}
                      onClick={() => onSelect(dateStr)}
                      className="aspect-square rounded-sm cursor-pointer hover:ring-1 hover:ring-orange-400 transition-all flex items-center justify-center relative"
                      style={{ background: h ? strainColor(h.strain) : '#F8FAFC' }}
                      title={h ? `Strain: ${h.strain}` : ''}
                    >
                      {h?.hasComp && <span className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-orange-500" />}
                      {dateStr === today && <span className="absolute top-0 left-0 w-1 h-1 rounded-full bg-rose-500" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── QUARTER VIEW ──────────────────────────────────────────────────────────────
function QuarterView({ year, quarter, onSelect }: { year: number; quarter: number; onSelect: (date: string) => void }) {
  const startMonth = (quarter - 1) * 3
  const months = [startMonth, startMonth + 1, startMonth + 2]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pf-enter">
      {months.map(mi => {
        const firstDay = new Date(year, mi, 1).getDay()
        const offset = (firstDay + 6) % 7
        const days = new Date(year, mi + 1, 0).getDate()
        const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
        while (cells.length % 7 !== 0) cells.push(null)

        return (
          <div key={mi} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="pf-num text-lg text-foreground">{MONTHS_FULL[mi]} {year}</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-2xs text-muted-foreground/60 font-medium py-0.5">{d[0]}</div>
                ))}
              </div>

              {/* Cycle bands */}
              {DEMO_CYCLES.filter(c => {
                const cs = new Date(c.start), ce = new Date(c.end)
                const ms = new Date(year, mi, 1), me = new Date(year, mi + 1, 0)
                return cs <= me && ce >= ms
              }).map((c, ci) => {
                const cc = CYCLE_COLORS[c.type as keyof typeof CYCLE_COLORS]
                return (
                  <div key={ci} className="mb-1 px-2 py-0.5 rounded text-2xs font-medium truncate border" style={{ background: cc.bg, color: cc.text, borderColor: cc.border }}>
                    {c.label}
                  </div>
                )
              })}

              <div className="grid grid-cols-7 gap-[2px]">
                {cells.map((day, di) => {
                  if (!day) return <div key={di} />
                  const dateStr = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const h = HEATMAP[dateStr]
                  const today = new Date().toISOString().slice(0,10)

                  return (
                    <div
                      key={di}
                      onClick={() => onSelect(dateStr)}
                      className="min-h-[36px] rounded cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all border flex flex-col items-center justify-start pt-1 gap-0.5 relative"
                      style={{ background: h ? strainColor(h.strain) : '#FAFAFA', borderColor: dateStr === today ? '#F97316' : 'transparent' }}
                    >
                      <span className="text-[9px] font-medium text-foreground/60">{day}</span>
                      {h?.hasComp && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── MONTH VIEW ────────────────────────────────────────────────────────────────
function MonthView({ year, month, onSelect, selected }: { year: number; month: number; onSelect: (d:string)=>void; selected: string|null }) {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = (firstDay + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number|null)[] = [...Array(offset).fill(null), ...Array.from({length: days}, (_,i) => i+1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i+=7) weeks.push(cells.slice(i,i+7))
  const today = new Date().toISOString().slice(0,10)

  // Cycles covering this month
  const activeCycles = DEMO_CYCLES.filter(c => {
    const cs = new Date(c.start), ce = new Date(c.end)
    const ms = new Date(year, month, 1), me = new Date(year, month+1, 0)
    return cs <= me && ce >= ms
  })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden pf-enter">
      {/* Cycle bands */}
      {activeCycles.length > 0 && (
        <div className="px-4 py-2 border-b border-border flex flex-wrap gap-1.5">
          {activeCycles.map((c, i) => {
            const cc = CYCLE_COLORS[c.type as keyof typeof CYCLE_COLORS]
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold border" style={{ background: cc.bg, color: cc.text, borderColor: cc.border }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cc.text }} />
                {c.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-2xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((day, di) => {
            const dateStr = day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : ''
            const session = day ? DEMO_SESSIONS.find(s => s.date === dateStr) : null
            const comp = day ? DEMO_COMPETITIONS.find(c => c.date === dateStr) : null
            const isToday = dateStr === today
            const isSelected = dateStr === selected

            return (
              <div
                key={di}
                onClick={() => day && onSelect(dateStr)}
                className={[
                  'min-h-[90px] p-1.5 border-e border-e-border last:border-e-0 transition-colors',
                  day ? 'cursor-pointer' : 'bg-background/40',
                  isSelected ? 'bg-orange-50/80' : day ? 'hover:bg-accent/50' : '',
                ].join(' ')}
              >
                {day && (
                  <>
                    <div className={[
                      'w-7 h-7 rounded-lg flex items-center justify-center text-2sm font-semibold mb-1 mx-auto',
                      isToday ? 'bg-orange-500 text-white' : isSelected ? 'bg-orange-100 text-orange-600' : 'text-foreground',
                    ].join(' ')}>
                      {day}
                    </div>

                    {/* Strain bar mini */}
                    {session && (
                      <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate" style={{ background: strainColor(session.strain), color: '#1D4ED8' }}>
                        {session.type.slice(0,3)} · {session.strain}
                      </div>
                    )}

                    {/* Competition badge */}
                    {comp && (
                      <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate" style={{ background: EVENT_COLORS.competition.bg, color: EVENT_COLORS.competition.text }}>
                        🏆 {comp.name.slice(0,12)}
                      </div>
                    )}

                    {/* Cycle indicator dot */}
                    <div className="flex gap-0.5 justify-center">
                      {DEMO_CYCLES.filter(c => c.type !== 'macro' && dateStr >= c.start && dateStr <= c.end).slice(0,2).map((c,ci) => {
                        const cc = CYCLE_COLORS[c.type as keyof typeof CYCLE_COLORS]
                        return <span key={ci} className="w-1.5 h-1.5 rounded-full" style={{ background: cc.text }} />
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── WEEK VIEW ─────────────────────────────────────────────────────────────────
function WeekView({ year, month, weekStart, onSelect, selected }: { year: number; month: number; weekStart: Date; onSelect: (d:string)=>void; selected: string|null }) {
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const today = new Date().toISOString().slice(0,10)

  return (
    <div className="grid grid-cols-7 gap-2 pf-enter">
      {days.map((d, di) => {
        const dateStr = d.toISOString().slice(0,10)
        const session = DEMO_SESSIONS.find(s => s.date === dateStr)
        const comp = DEMO_COMPETITIONS.find(c => c.date === dateStr)
        const cycles = DEMO_CYCLES.filter(c => c.type !== 'macro' && dateStr >= c.start && dateStr <= c.end)
        const isToday = dateStr === today
        const isSelected = dateStr === selected

        return (
          <div
            key={di}
            onClick={() => onSelect(dateStr)}
            className={[
              'bg-card border rounded-xl p-3 cursor-pointer transition-all hover:border-orange-200 hover:shadow-sm',
              isSelected ? 'border-orange-400 shadow-sm' : isToday ? 'border-orange-300' : 'border-border',
            ].join(' ')}
          >
            <div className={`text-center mb-2`}>
              <div className="text-2xs text-muted-foreground uppercase tracking-widest">{DAYS_SHORT[di]}</div>
              <div className={`pf-num text-2xl ${isToday ? 'text-orange-500' : 'text-foreground'}`}>{d.getDate()}</div>
            </div>

            {session && (
              <div className="mb-1.5">
                <div className="px-2 py-1 rounded-lg text-2xs font-semibold mb-1" style={{ background: strainColor(session.strain), color: '#1D4ED8' }}>
                  {session.type}
                </div>
                <ZoneBar zones={session.z} height={18} />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">{session.dur}m</span>
                  <span className="text-[9px] font-bold text-foreground">{session.strain}</span>
                </div>
              </div>
            )}

            {comp && (
              <div className="px-2 py-1 rounded-lg text-2xs font-semibold" style={{ background: EVENT_COLORS.competition.bg, color: EVENT_COLORS.competition.text }}>
                🏆 Race
              </div>
            )}

            {cycles.map((c, ci) => {
              const cc = CYCLE_COLORS[c.type as keyof typeof CYCLE_COLORS]
              return (
                <div key={ci} className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border truncate" style={{ background: cc.bg, color: cc.text, borderColor: cc.border }}>
                  {c.label.slice(0,12)}
                </div>
              )
            })}

            {!session && !comp && (
              <div className="flex items-center justify-center h-12 text-muted-foreground/30">
                <i className="ki-filled ki-minus text-xs" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
function DetailPanel({ dateStr, savedEvents, onAddEvent, onDeleteEvent }: {
  dateStr: string
  savedEvents: CalendarEvent[]
  onAddEvent: (date: string) => void
  onDeleteEvent: (id: string) => void
}) {
  const session = DEMO_SESSIONS.find(s => s.date === dateStr)
  const comp = DEMO_COMPETITIONS.find(c => c.date === dateStr)
  const cycles = DEMO_CYCLES.filter(c => dateStr >= c.start && dateStr <= c.end)
  const d = new Date(dateStr)
  const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 h-full">
      <div>
        <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Selected</div>
        <h3 className="pf-num text-xl text-foreground">{label}</h3>
      </div>

      {/* Cycles */}
      {cycles.length > 0 && (
        <div>
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Active Cycles</div>
          <div className="flex flex-col gap-1.5">
            {cycles.map((c, i) => {
              const cc = CYCLE_COLORS[c.type as keyof typeof CYCLE_COLORS]
              return (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border" style={{ background: cc.bg, borderColor: cc.border }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: cc.text }} />
                  <div>
                    <div className="text-2xs font-semibold" style={{ color: cc.text }}>{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.start} → {c.end}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Session */}
      {session && (
        <div>
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Training Session</div>
          <div className="p-3 rounded-xl border bg-blue-50 border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-blue-800">{session.type}</span>
              <span className="pf-num text-lg text-blue-600">{session.strain}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-2xs mb-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-semibold">{session.dur} min</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg HR</span><span className="font-semibold">{session.avg_hr} bpm</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Calories</span><span className="font-semibold">{session.cal} kcal</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recovery</span><span className="font-semibold" style={{ color: recoveryColor(session.recovery) }}>{session.recovery}%</span></div>
            </div>
            <ZoneBar zones={session.z} height={20} showLabels />
          </div>
        </div>
      )}

      {/* Competition */}
      {comp && (
        <div>
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Competition</div>
          <div className="p-3 rounded-xl border bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🏆</span>
              <div>
                <div className="text-sm font-semibold text-orange-800">{comp.name}</div>
                <div className="text-2xs text-orange-600">{comp.location} · {comp.distance}</div>
              </div>
              {comp.pb && <span className="ml-auto text-2xs font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">PB</span>}
            </div>
            {comp.result && (
              <div className="flex gap-3 text-2xs">
                <div><span className="text-muted-foreground">Result: </span><span className="font-bold text-foreground">{comp.result}</span></div>
                {comp.position && <div><span className="text-muted-foreground">Position: </span><span className="font-bold text-foreground">#{comp.position}</span></div>}
              </div>
            )}
            {!comp.result && <div className="text-2xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-700 capitalize">{comp.status}</div>}
          </div>
        </div>
      )}

      {/* Saved calendar events for this date */}
      {savedEvents.filter(e => e.event_date === dateStr).length > 0 && (
        <div>
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Events</div>
          <div className="flex flex-col gap-1.5">
            {savedEvents.filter(e => e.event_date === dateStr).map(ev => {
              const meta = EVENT_TYPES.find(t => t.value === ev.event_type)
              return (
                <div key={ev.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-border hover:bg-accent/30 transition-colors group">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: (meta?.color ?? '#64748B') + '18' }}>
                    <i className={`ki-filled ${meta?.icon ?? 'ki-calendar'} text-xs`} style={{ color: meta?.color ?? '#64748B' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xs font-semibold text-foreground truncate">{ev.title}</div>
                    {ev.start_time && (
                      <div className="text-[10px] text-muted-foreground">{ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ''}</div>
                    )}
                    {ev.notes && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{ev.notes}</div>}
                  </div>
                  <button
                    onClick={() => onDeleteEvent(ev.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"
                  >
                    <i className="ki-filled ki-trash text-xs text-muted-foreground" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!session && !comp && cycles.length === 0 && savedEvents.filter(e => e.event_date === dateStr).length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <i className="ki-filled ki-calendar text-3xl text-muted-foreground/20 mb-2" />
          <p className="text-2sm text-muted-foreground">No events</p>
          <button onClick={() => onAddEvent(dateStr)} className="mt-3 kt-btn kt-btn-sm kt-btn-outline gap-1.5">
            <i className="ki-filled ki-plus text-xs" />
            Add event
          </button>
        </div>
      )}
    </div>
  )
}

// ── ADD EVENT DRAWER (right-side sheet) ───────────────────────────────────────
interface AddEventDrawerProps {
  initialDate: string
  ownerId: string
  onClose: () => void
  onCreated: (event: CalendarEvent) => void
}

function AddEventDrawer({ initialDate, ownerId, onClose, onCreated }: AddEventDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [form, setForm] = useState({
    event_date: initialDate,
    event_type: 'workout' as EventType,
    title:      '',
    notes:      '',
    start_time: '',
    end_time:   '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // Mount → Portal available; then trigger slide-in animation
  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus title on open
  useEffect(() => {
    if (visible) setTimeout(() => titleRef.current?.focus(), 150)
  }, [visible])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const result = await createCalendarEvent({
      owner_id:   ownerId,
      event_date: form.event_date,
      event_type: form.event_type,
      title:      form.title.trim(),
      notes:      form.notes.trim() || null,
      start_time: form.start_time || null,
      end_time:   form.end_time || null,
    })
    if (!result) {
      setError('Failed to save event. Check your Supabase RLS policies.')
      setSaving(false)
      return
    }
    onCreated(result)
    handleClose()
  }

  const selectedType = EVENT_TYPES.find(t => t.value === form.event_type)

  if (!mounted) return null

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop — solid dark overlay, not transparent */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          transition: 'opacity 0.25s ease',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Sheet panel sliding from the right */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          height: '100%',
          backgroundColor: 'white',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Sheet header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid #E2E8F0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedType && (
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: selectedType.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className={`ki-filled ${selectedType.icon}`}
                  style={{ color: selectedType.color, fontSize: 16 }} />
              </div>
            )}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>
                Calendar
              </p>
              <h2 className="pf-num" style={{ fontSize: 22, color: '#0F172A', lineHeight: 1 }}>
                Add Event
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"
            aria-label="Close"
          >
            <i className="ki-filled ki-cross" style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 12, marginBottom: 16,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#DC2626',
            }}>
              <i className="ki-filled ki-information-5" style={{ color: '#EF4444', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── Event type grid ── */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Event type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {EVENT_TYPES.map(t => {
                  const active = form.event_type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, event_type: t.value }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 10px', borderRadius: 10, textAlign: 'left',
                        border: active ? `2px solid ${t.color}` : '1.5px solid #E2E8F0',
                        background: active ? t.color + '12' : '#FAFAFA',
                        color: active ? t.color : '#64748B',
                        fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <i className={`ki-filled ${t.icon}`} style={{ fontSize: 12, color: active ? t.color : '#94A3B8', flexShrink: 0 }} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Title ── */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Title <span style={{ color: '#F97316' }}>*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                placeholder="e.g. Morning run, City marathon…"
                style={{
                  width: '100%', borderRadius: 12,
                  border: '1.5px solid #E2E8F0',
                  padding: '10px 14px', fontSize: 14,
                  outline: 'none', transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = '#F97316')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* ── Date ── */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Date
              </label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                required
                style={{
                  width: '100%', borderRadius: 12,
                  border: '1.5px solid #E2E8F0',
                  padding: '10px 14px', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = '#F97316')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* ── Start / End time ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Start time
                </label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: 12,
                    border: '1.5px solid #E2E8F0',
                    padding: '10px 14px', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#F97316')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  End time
                </label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: 12,
                    border: '1.5px solid #E2E8F0',
                    padding: '10px 14px', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#F97316')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Optional notes…"
                style={{
                  width: '100%', borderRadius: 12,
                  border: '1.5px solid #E2E8F0',
                  padding: '10px 14px', fontSize: 14,
                  outline: 'none', resize: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = '#F97316')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* ── Actions (pinned at bottom of scrollable area) ── */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: saving ? '#FDA96A' : '#F97316',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save event'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="kt-btn kt-btn-outline"
                style={{ flexShrink: 0 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useUser()
  const today = new Date()
  const [view, setView] = useState<ViewMode>('month')
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(0) // Jan 2025
  const [quarter, setQuarter] = useState(1)
  const [selected, setSelected] = useState<string | null>('2025-01-13')
  const [filterType, setFilterType] = useState<string>('all')

  // Add Event modal
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [addEventDate, setAddEventDate] = useState<string>(today.toISOString().slice(0, 10))
  const [savedEvents, setSavedEvents] = useState<CalendarEvent[]>([])

  const openAddEvent = useCallback((date?: string) => {
    setAddEventDate(date ?? today.toISOString().slice(0, 10))
    setShowAddEvent(true)
  }, [today])

  const handleEventCreated = useCallback((event: CalendarEvent) => {
    setSavedEvents(prev => [...prev, event])
  }, [])

  const handleDeleteEvent = useCallback(async (id: string) => {
    await deleteCalendarEvent(id)
    setSavedEvents(prev => prev.filter(e => e.id !== id))
  }, [])

  // For week view
  const weekStart = useMemo(() => {
    const d = new Date(year, month, 13) // default to mid-month
    const day = d.getDay()
    const offset = (day + 6) % 7
    d.setDate(d.getDate() - offset)
    return d
  }, [year, month])

  const prevPeriod = () => {
    if (view === 'year')    { setYear(y => y - 1) }
    if (view === 'quarter') { if (quarter === 1) { setYear(y => y-1); setQuarter(4) } else setQuarter(q => q-1) }
    if (view === 'month')   { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  }
  const nextPeriod = () => {
    if (view === 'year')    { setYear(y => y + 1) }
    if (view === 'quarter') { if (quarter === 4) { setYear(y => y+1); setQuarter(1) } else setQuarter(q => q+1) }
    if (view === 'month')   { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1) }
  }

  const periodLabel = () => {
    if (view === 'year')    return `${year}`
    if (view === 'quarter') return `Q${quarter} ${year}`
    if (view === 'month')   return `${MONTHS_FULL[month]} ${year}`
    if (view === 'week')    return `Week · ${MONTHS_FULL[month]} ${year}`
    return ''
  }

  const VIEWS: { id: ViewMode; label: string }[] = [
    { id: 'week',    label: 'Week' },
    { id: 'month',   label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year',    label: 'Year' },
  ]

  // Stats for current period
  const periodSessions = DEMO_SESSIONS.length
  const avgStrain = (DEMO_SESSIONS.reduce((a,s) => a + s.strain, 0) / DEMO_SESSIONS.length).toFixed(1)
  const totalCals = DEMO_SESSIONS.reduce((a,s) => a + s.cal, 0)

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Training Schedule</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Calendar</h2>
        </div>
        <button onClick={() => openAddEvent(selected ?? undefined)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          Add Event
        </button>
      </div>

      {/* Period stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sessions', value: periodSessions, icon: 'ki-abstract-26', color: 'text-blue-600 bg-blue-50' },
          { label: 'Avg Strain', value: avgStrain, icon: 'ki-chart-line-up', color: 'text-orange-600 bg-orange-50' },
          { label: 'Total Cals', value: totalCals.toLocaleString(), icon: 'ki-abstract-31', color: 'text-green-600 bg-green-50' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
              <i className={`ki-filled ${s.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground leading-none">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center gap-0.5 p-1 bg-card border border-border rounded-lg">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={[
                'px-3 py-1.5 rounded-md text-2sm font-medium transition-all',
                view === v.id ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline">
            <i className="ki-filled ki-left text-xs" />
          </button>
          <span className="pf-num text-lg text-foreground min-w-[160px] text-center">{periodLabel()}</span>
          <button onClick={nextPeriod} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline">
            <i className="ki-filled ki-right text-xs" />
          </button>
        </div>

        {/* Filter */}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {['all','workout','competition','cycle'].map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={[
                'px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all capitalize',
                filterType === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200',
              ].join(' ')}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid: Calendar + Detail */}
      <div className={`grid gap-4 ${view !== 'year' && view !== 'quarter' ? 'xl:grid-cols-[1fr_280px]' : ''}`}>
        <div>
          {view === 'year'    && <YearView year={year} onSelect={setSelected} />}
          {view === 'quarter' && <QuarterView year={year} quarter={quarter} onSelect={setSelected} />}
          {view === 'month'   && <MonthView year={year} month={month} onSelect={setSelected} selected={selected} />}
          {view === 'week'    && <WeekView year={year} month={month} weekStart={weekStart} onSelect={setSelected} selected={selected} />}
        </div>

        {/* Detail panel — only for month/week */}
        {(view === 'month' || view === 'week') && selected && (
          <DetailPanel
            dateStr={selected}
            savedEvents={savedEvents}
            onAddEvent={openAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </div>

      {/* Saved events strip — upcoming */}
      {savedEvents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your saved events</div>
          <div className="flex flex-col gap-1.5">
            {savedEvents.slice().sort((a, b) => a.event_date.localeCompare(b.event_date)).map(ev => {
              const meta = EVENT_TYPES.find(t => t.value === ev.event_type)
              return (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-accent/30 group transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: (meta?.color ?? '#64748B') + '18' }}>
                    <i className={`ki-filled ${meta?.icon ?? 'ki-calendar'} text-xs`} style={{ color: meta?.color ?? '#64748B' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-2sm font-semibold text-foreground truncate">{ev.title}</span>
                    {ev.notes && <span className="text-2xs text-muted-foreground ml-2 truncate">{ev.notes}</span>}
                  </div>
                  <span className="text-2xs text-muted-foreground shrink-0">
                    {new Date(ev.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {ev.start_time && ` · ${ev.start_time}`}
                  </span>
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost shrink-0"
                  >
                    <i className="ki-filled ki-trash text-xs text-muted-foreground" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-5 flex-wrap">
        <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Legend</span>
        {[
          { label: 'Workout',     color: '#3B82F6', type: 'square' },
          { label: 'Competition', color: '#EA580C', type: 'circle' },
          { label: 'Macrocycle',  color: CYCLE_COLORS.macro.text, type: 'bar' },
          { label: 'Mesocycle',   color: CYCLE_COLORS.meso.text, type: 'bar' },
          { label: 'Microcycle',  color: CYCLE_COLORS.micro.text, type: 'bar' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-${l.type === 'circle' ? 'full' : l.type === 'bar' ? '' : 'sm'} inline-block`} style={{ background: l.color }} />
            <span className="text-2xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-2xs text-muted-foreground">Strain:</span>
          {[['Low','#DBEAFE'],['Med','#93C5FD'],['High','#3B82F6'],['Peak','#1D4ED8']].map(([l,c]) => (
            <span key={l} className="flex items-center gap-0.5">
              <span className="w-4 h-3 rounded-sm inline-block" style={{ background: c }} />
              <span className="text-[9px] text-muted-foreground">{l}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Add Event Drawer */}
      {showAddEvent && user && (
        <AddEventDrawer
          initialDate={addEventDate}
          ownerId={user.id}
          onClose={() => setShowAddEvent(false)}
          onCreated={handleEventCreated}
        />
      )}
    </div>
  )
}
