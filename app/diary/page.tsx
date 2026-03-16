'use client'
import { useState } from 'react'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { DEMO_SESSIONS, TYPE_COLORS } from '@/lib/utils/data'
const FILTERS = ['All Types','Running','Cycling','Swimming','Weight Training','HIIT','Yoga','Walking']
export default function DiaryPage() {
  const [filter, setFilter] = useState('All Types')
  const sessions = filter === 'All Types' ? DEMO_SESSIONS : DEMO_SESSIONS.filter(s => s.type === filter)
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">USER_00011 · Real WHOOP data</p>
          <h2 className="pf-num text-3xl text-slate-900">Training Diary</h2>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:'#F97316'}}>
          <i className="ki-filled ki-plus text-sm"/>Log Session
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${filter===f?'text-white':'bg-white border border-[#E2E8F0] text-slate-500 hover:border-slate-300'}`} style={filter===f?{background:'#2563EB'}:{}}>{f}</button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {sessions.map((s,i)=>{
          const tc=TYPE_COLORS[s.type]??{bg:'#F8FAFC',text:'#64748B',icon:'ki-abstract-26'}
          return (
            <div key={i} className="card rounded-2xl border border-[#E2E8F0] bg-white p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:tc.bg}}>
                    <i className={`ki-filled ${tc.icon} text-lg`} style={{color:tc.text}}/>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{s.type}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-400">{s.date}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.strain>=14?'bg-red-50 text-red-600':s.strain>=10?'bg-orange-50 text-orange-600':'bg-green-50 text-green-600'}`}>Strain {s.strain}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-5 flex-wrap">
                  {[{v:`${s.dur}m`,l:'Duration',c:'#2563EB'},{v:s.avg_hr,l:'Avg HR',c:'#DC2626'},{v:s.cal,l:'Calories',c:'#F97316'},{v:s.strain,l:'Strain',c:'#7C3AED'}].map(({v,l,c})=>(
                    <div key={l} className="text-center">
                      <div className="pf-num text-2xl leading-none" style={{color:c}}>{v}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              {s.z.some(v=>v>0)&&<div className="mt-4"><ZoneBar zones={s.z} height={7} showLabels/></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
