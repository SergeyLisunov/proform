'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Workout { id: string; event_date: string; activity_type: string | null; event_type: string; activity_strain: number | null; is_public: boolean }
interface CycleBlock { id: string; start_date: string; end_date: string; cycle_type: string; label: string | null; color: string }

interface Props { userId: string; workouts: Workout[]; cycleBlocks: CycleBlock[]; year: number; month: number }

const CYCLE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  micro: { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
  meso:  { bg: '#FFF7ED', border: '#FED7AA', text: '#F97316' },
  macro: { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
}
const TYPE_COLOR: Record<string, string> = {
  Running:'#2563EB', Cycling:'#16A34A', Swimming:'#7C3AED', HIIT:'#DC2626',
  'Weight Training':'#F97316', CrossFit:'#D97706', Yoga:'#0D9488', Walking:'#64748B',
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarClient({ userId, workouts, cycleBlocks, year: initYear, month: initMonth }: Props) {
  const router = useRouter()
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [layer, setLayer] = useState<'micro'|'meso'|'macro'|'none'>('micro')
  const [addingCycle, setAddingCycle] = useState(false)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  function dateStr(d: number) { return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }

  function workoutsOnDay(d: number) {
    const ds = dateStr(d)
    return workouts.filter(w => w.event_date === ds)
  }
  function cycleOnDay(d: number) {
    const ds = dateStr(d)
    return cycleBlocks.find(b => b.start_date <= ds && b.end_date >= ds && b.cycle_type === layer)
  }

  const cells = Array.from({ length: firstDay }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  return (
    <div className="flex flex-col gap-5 pf-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Calendar</p>
          <h2 className="pf-num text-3xl text-slate-900 mt-0.5">{MONTHS[month]} {year}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cycle layer filter */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(['none','micro','meso','macro'] as const).map(l => (
              <button key={l} onClick={() => setLayer(l)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: layer===l ? '#fff' : 'transparent', color: layer===l ? '#0F172A' : '#94A3B8', boxShadow: layer===l ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {l.charAt(0).toUpperCase()+l.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={prev} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-slate-500 hover:bg-slate-50 transition bg-white">
            <i className="ki-filled ki-left text-sm" />
          </button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }}
            className="px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 transition bg-white">
            Today
          </button>
          <button onClick={next} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-slate-500 hover:bg-slate-50 transition bg-white">
            <i className="ki-filled ki-right text-sm" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background:'#2563EB' }} />Training</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background:'#F97316' }} />Competition</span>
        {layer !== 'none' && <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: CYCLE_STYLES[layer].bg, border: `1.5px solid ${CYCLE_STYLES[layer].border}` }} />
          {layer.charAt(0).toUpperCase()+layer.slice(1)}cycle block
        </span>}
      </div>

      {/* Calendar grid */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          {WDAYS.map(d => (
            <div key={d} className="py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[90px] border-r border-b border-[#F1F5F9] bg-[#FAFAFA]" />
            const ws = workoutsOnDay(day)
            const cycle = cycleOnDay(day)
            const cs = cycle ? CYCLE_STYLES[cycle.cycle_type] : null
            return (
              <div key={day}
                className="min-h-[90px] border-r border-b border-[#F1F5F9] p-2 cursor-pointer hover:bg-[#F8FAFC] transition-colors relative"
                style={{ background: isToday(day) ? '#FFFBF5' : cs ? cs.bg : '#fff' }}>
                {/* Cycle top indicator */}
                {cs && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: cs.border }} />}
                {/* Day number */}
                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1.5 font-medium ${isToday(day) ? 'text-white' : 'text-slate-700'}`}
                  style={{ background: isToday(day) ? '#F97316' : 'transparent' }}>
                  {day}
                </div>
                {/* Workout pills */}
                {ws.slice(0,2).map(w => {
                  const isComp = w.event_type === 'competition'
                  const col = isComp ? '#F97316' : (TYPE_COLOR[w.activity_type??''] ?? '#64748B')
                  return (
                    <div key={w.id} className="mb-0.5 flex items-center gap-1">
                      <div className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-white truncate" style={{ background: col }}>
                        {w.activity_type ?? (isComp ? 'Competition' : 'Training')}
                      </div>
                      {w.activity_strain && (
                        <span className="text-[8px] text-slate-400">{w.activity_strain.toFixed(0)}</span>
                      )}
                    </div>
                  )
                })}
                {ws.length > 2 && <div className="text-[9px] text-slate-400">+{ws.length - 2} more</div>}
                {/* Strain mini bar */}
                {ws.length > 0 && ws[0].activity_strain && (
                  <div className="mt-1 h-1 bg-slate-100 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(ws[0].activity_strain/21*100,100)}%`, background: TYPE_COLOR[ws[0].activity_type??''] ?? '#64748B' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cycle blocks summary */}
      {layer !== 'none' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cycleBlocks.filter(b => b.cycle_type === layer).map(b => {
            const cs = CYCLE_STYLES[b.cycle_type]
            return (
              <div key={b.id} className="rounded-xl p-3" style={{ background: cs.bg, border: `1.5px solid ${cs.border}` }}>
                <div className="text-xs font-bold mb-1" style={{ color: cs.text }}>{b.label ?? b.cycle_type+' block'}</div>
                <div className="text-xs text-slate-500">{b.start_date} → {b.end_date}</div>
              </div>
            )
          })}
          {cycleBlocks.filter(b => b.cycle_type === layer).length === 0 && (
            <div className="col-span-4 text-center py-4 text-sm text-slate-400">No {layer}cycle blocks defined for this month.</div>
          )}
        </div>
      )}
    </div>
  )
}
