'use client'
import { recoveryColor } from '@/lib/utils/data'
import ApexChart from '@/components/charts/ApexChart'
const AT_COLORS=['#2563EB','#F97316','#16A34A','#7C3AED']
const athletes=[
  {ini:'SK',name:'Sara Kowalski',sport:'Running',age:45,gender:'Female',level:'Beginner',recovery:42,hrv:47.2,rhr:45.8,sleep:7.8,sessions:10,uid:'USER_00011'},
  {ini:'MW',name:'Marcus Weiden',sport:'Cycling',age:43,gender:'Male',level:'Intermediate',recovery:82,hrv:62.2,rhr:52.1,sleep:6.0,sessions:7,uid:'USER_00003'},
  {ini:'JT',name:'James Thornton',sport:'Swimming',age:55,gender:'Male',level:'Intermediate',recovery:63,hrv:32.0,rhr:73.1,sleep:5.7,sessions:7,uid:'USER_00006'},
  {ini:'LN',name:'Linh Nguyen',sport:'Weight Training',age:56,gender:'Female',level:'Beginner',recovery:80,hrv:106.5,rhr:55.8,sleep:6.1,sessions:14,uid:'USER_00001'},
]
const HRZ_W=[
  [13.4,22.1,27.3,26.5,10.6],[10.5,21.0,29.3,29.6,9.5],
  [10.5,19.9,28.0,29.7,11.9],[15.3,24.9,29.4,23.1,7.3],
]
const ZONE_COLORS=['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
export default function AthletesPage() {
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Real WHOOP data · 100K records</p>
        <h2 className="pf-num text-3xl text-slate-900">My Athletes</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {athletes.map((a,i)=>{
          const rc=recoveryColor(a.recovery)
          return (
            <div key={a.uid} className="card rounded-2xl border border-[#E2E8F0] bg-white p-5 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 pf-num text-xl font-bold" style={{background:AT_COLORS[i]+'20',color:AT_COLORS[i]}}>{a.ini}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.sport} · {a.gender} · {a.age}y · {a.level}</div>
                </div>
                <div className="text-right">
                  <div className="pf-num text-3xl leading-none" style={{color:rc}}>{a.recovery}%</div>
                  <div className="text-[9px] text-slate-400">recovery</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[{v:a.hrv,u:'HRV ms',c:'#2563EB'},{v:a.rhr,u:'RHR bpm',c:'#DC2626'},{v:a.sleep,u:'Sleep h',c:'#7C3AED'},{v:a.sessions,u:'Sessions',c:'#64748B'}].map(({v,u,c})=>(
                  <div key={u} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="pf-num text-lg leading-none" style={{color:c}}>{v}</div>
                    <div className="text-[8px] text-slate-400 mt-1 uppercase tracking-wide">{u}</div>
                  </div>
                ))}
              </div>
              <div className="flex h-2 rounded overflow-hidden" style={{gap:1}}>
                {HRZ_W[i].map((pct,zi)=>pct>0?<div key={zi} style={{flex:pct,background:ZONE_COLORS[zi],minWidth:2}}/>:null)}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">{a.uid} · Real WHOOP data</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
