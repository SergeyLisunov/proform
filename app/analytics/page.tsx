'use client'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import ApexChart from '@/components/charts/ApexChart'
import { DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, recoveryColor } from '@/lib/utils/data'
const ZONE_COLORS=['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
const ZONE_LABELS=['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max']
export default function AnalyticsPage() {
  const rc = recoveryColor(42)
  const hrzData = DEMO_HRZ.map((v,i)=>({x:ZONE_LABELS[i],y:v,fillColor:ZONE_COLORS[i]}))
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">USER_00011 · Real WHOOP dataset</p>
        <h2 className="pf-num text-3xl text-slate-900">Analytics & Insights</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{v:'47.2',u:'ms',l:'Avg HRV',c:'#2563EB'},{v:'42%',u:'',l:'Recovery Score',c:rc},{v:'45.8',u:'bpm',l:'Resting HR',c:'#DC2626'},{v:'7.8',u:'hrs',l:'Avg Sleep',c:'#7C3AED'}].map(({v,u,l,c})=>(
          <div key={l} className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{l}</div>
            <div className="flex items-baseline gap-1"><span className="pf-num text-4xl" style={{color:c}}>{v}</span>{u&&<span className="text-xs text-slate-400">{u}</span>}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Weekly Strain Trend</p>
          <p className="text-xs text-slate-400 mb-4">8 weeks · WHOOP day_strain</p>
          <ApexChart type="area" height={200} options={{chart:{type:'area',toolbar:{show:false}},stroke:{curve:'smooth',width:2},colors:['#F97316'],fill:{type:'gradient',gradient:{opacityFrom:0.15,opacityTo:0.01}},xaxis:{categories:DEMO_WEEKLY.map(d=>d.w),labels:{style:{fontSize:'10px',colors:'#94A3B8'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{labels:{style:{fontSize:'10px',colors:'#94A3B8'}}},grid:{borderColor:'#F1F5F9',strokeDashArray:4},tooltip:{theme:'light'},dataLabels:{enabled:false}}} series={[{name:'Strain',data:DEMO_WEEKLY.map(d=>d.strain)}]}/>
        </div>
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">HR Zone Distribution</p>
          <p className="text-xs text-slate-400 mb-4">Aggregated across all sessions</p>
          <ApexChart type="bar" height={200} options={{chart:{type:'bar',toolbar:{show:false}},plotOptions:{bar:{borderRadius:6,columnWidth:'55%',distributed:true}},colors:ZONE_COLORS,xaxis:{categories:ZONE_LABELS.map(z=>z.split(' ')[0]),labels:{style:{fontSize:'10px',colors:'#94A3B8'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{labels:{style:{fontSize:'10px',colors:'#94A3B8'}}},grid:{borderColor:'#F1F5F9',strokeDashArray:4},legend:{show:false},dataLabels:{enabled:false},tooltip:{theme:'light'}}} series={[{name:'%',data:DEMO_HRZ}]}/>
        </div>
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recovery & HRV Daily</p>
          <p className="text-xs text-slate-400 mb-4">Last 7 days · WHOOP biometrics</p>
          <ApexChart type="line" height={200} options={{chart:{type:'line',toolbar:{show:false}},stroke:{curve:'smooth',width:[2.5,1.5],dashArray:[0,5]},colors:[rc,'#2563EB'],xaxis:{categories:DEMO_DAILY.map(d=>d.day),labels:{style:{fontSize:'10px',colors:'#94A3B8'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{labels:{style:{fontSize:'10px',colors:'#94A3B8'}}},grid:{borderColor:'#F1F5F9',strokeDashArray:4},legend:{show:false},tooltip:{theme:'light'},dataLabels:{enabled:false}}} series={[{name:'Recovery %',data:DEMO_DAILY.map(d=>d.recovery)},{name:'HRV ms',data:DEMO_DAILY.map(d=>d.hrv)}]}/>
        </div>
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 self-start">Recovery Score</p>
          <RecoveryRing score={42} size={140}/>
          <div className="mt-5 grid grid-cols-3 gap-3 w-full">
            {[{l:'Height',v:'169.6 cm'},{l:'Weight',v:'58 kg'},{l:'Sport',v:'Running'},{l:'Age',v:'45 yrs'},{l:'Gender',v:'Female'},{l:'Level',v:'Beginner'}].map(({l,v})=>(
              <div key={l} className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-xs font-semibold text-slate-700">{v}</div>
                <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
