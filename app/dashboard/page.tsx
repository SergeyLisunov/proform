'use client'

import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import ApexChart from '@/components/charts/ApexChart'
import {
  DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, DEMO_SESSIONS, DEMO_GROUP,
  TYPE_COLORS, recoveryColor,
} from '@/lib/utils/data'

const Z_COLORS = ['#93C5FD','#6EE7B7','#FDE68A','#FCA97A','#FCA5A5']
const Z_LABELS = ['Recovery','Aerobic','Tempo','Threshold','VO₂max']
const AT_COLORS = ['#2563EB','#F97316','#16A34A','#7C3AED']

// ── tiny shared chart defaults ───────────────────────────────────
const baseChart = { toolbar:{ show:false }, sparkline:{ enabled:false } }
const baseGrid  = { borderColor:'#F0F0F0', strokeDashArray:3, yaxis:{ lines:{ show:true } }, xaxis:{ lines:{ show:false } } }
const baseTick  = { style:{ fontSize:'10px', colors:'#A1A1AA' } }

// ── SECTION LABEL ────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#D4D4D8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  )
}

// ── BIG STAT ─────────────────────────────────────────────────────
function BigStat({ value, unit, label, color = '#09090B', sub }: {
  value: string | number; unit?: string; label: string; color?: string; sub?: string
}) {
  return (
    <div style={{ padding: '20px 22px', background: '#fff', border: '1px solid #F0F0F0', borderRadius: 16 }} className="pf-stat">
      <div style={{ fontSize: 10, fontWeight: 700, color: '#D4D4D8', letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="pf-num" style={{ fontSize: 40, color }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: '#A1A1AA' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#D4D4D8', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ── ATHLETE DASHBOARD ────────────────────────────────────────────
function AthleteDash({ name }: { name: string }) {
  const rc = recoveryColor(42)

  return (
    <div className="flex flex-col gap-6 pf-enter" style={{ gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#A1A1AA', letterSpacing: '0.04em', marginBottom: 4 }}>
            USER_00011 · WHOOP Real Data
          </div>
          <h2 className="pf-num" style={{ fontSize: 36, color: '#09090B' }}>
            Good morning, {name.split(' ')[0]}
          </h2>
        </div>
        <RecoveryRing score={42} size={100} />
      </div>

      {/* ── Key metrics row ── */}
      <div>
        <SectionLabel>Today's readiness</SectionLabel>
        <div className="pf-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
          <BigStat value={47.2} unit="ms"    label="Avg HRV"     color="#2563EB" sub="WHOOP metric" />
          <BigStat value={45.8} unit="bpm"   label="Resting HR"  color="#EF4444" />
          <BigStat value={7.8}  unit="hrs"   label="Avg Sleep"   color="#7C3AED" />
          <BigStat value="3,415" unit="kcal" label="Calories/day" color="#F97316" />
        </div>
      </div>

      {/* ── Strain + HR zones ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Strain area chart */}
        <div style={{ padding: '22px 24px', background: '#fff', border: '1px solid #F0F0F0', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <SectionLabel>Weekly Strain</SectionLabel>
              <div className="pf-num" style={{ fontSize: 28, color: '#09090B' }}>8 weeks</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pf-num" style={{ fontSize: 44, color: '#F97316' }}>73.6</div>
              <div style={{ fontSize: 10, color: '#A1A1AA', marginTop: 2 }}>WHOOP day_strain</div>
            </div>
          </div>
          <ApexChart type="area" height={160}
            options={{
              chart: { ...baseChart, type:'area' },
              stroke: { curve:'smooth', width:2, colors:['#F97316'] },
              fill: { type:'gradient', gradient:{ opacityFrom:0.12, opacityTo:0.01, stops:[0,100], colorStops:[{offset:0,color:'#F97316',opacity:0.12},{offset:100,color:'#F97316',opacity:0.01}] } },
              colors: ['#F97316'],
              xaxis: { categories: DEMO_WEEKLY.map(d=>d.w), labels: baseTick, axisBorder:{show:false}, axisTicks:{show:false} },
              yaxis: { labels: baseTick, min:30 },
              grid: baseGrid,
              tooltip: { theme:'light' },
              dataLabels: { enabled:false },
              markers: { size:3, colors:['#F97316'], strokeWidth:0, hover:{size:5} },
            }}
            series={[{ name:'Strain', data: DEMO_WEEKLY.map(d=>d.strain) }]}
          />
        </div>

        {/* HR Zones — stacked bars per zone */}
        <div style={{ padding: '22px 24px', background: '#fff', border: '1px solid #F0F0F0', borderRadius: 16 }}>
          <SectionLabel>HR Zones</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {Z_LABELS.map((z, i) => {
              const pct = DEMO_HRZ[i]
              const col = Z_COLORS[i]
              return (
                <div key={z}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: '#52525B' }}>Z{i+1} {z}</span>
                    </div>
                    <span className="pf-num" style={{ fontSize: 18, color: '#09090B' }}>{pct}<span style={{ fontSize: 11, color: '#A1A1AA' }}>%</span></span>
                  </div>
                  <div style={{ height: 4, background: '#F4F4F5', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct * 2}%`, background: col, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 16, padding: '9px 12px', background: '#EFF6FF', borderRadius: 9, fontSize: 11, color: '#2563EB', display: 'flex', gap: 6, alignItems: 'center' }}>
            <i className="ki-filled ki-information" style={{ fontSize: 12, flexShrink: 0 }} />
            80% sub-threshold — optimal aerobic base
          </div>
        </div>
      </div>

      {/* ── Recovery line + recent sessions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recovery & HRV line */}
        <div style={{ padding: '22px 24px', background: '#fff', border: '1px solid #F0F0F0', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <SectionLabel>Recovery & HRV · 7 days</SectionLabel>
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ l:'Recovery %', c:rc, dash:false },{ l:'HRV ms', c:'#2563EB', dash:true }].map(({ l, c, dash }) => (
                  <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#A1A1AA' }}>
                    <span style={{ width:14, height:2, background:c, borderRadius:1, display:'inline-block', borderTop:dash?`1px dashed ${c}`:undefined }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <ApexChart type="line" height={145}
            options={{
              chart: { ...baseChart, type:'line' },
              stroke: { curve:'smooth', width:[2.5,1.5], dashArray:[0,5] },
              colors: [rc, '#2563EB'],
              xaxis: { categories: DEMO_DAILY.map(d=>d.day), labels: baseTick, axisBorder:{show:false}, axisTicks:{show:false} },
              yaxis: { labels: baseTick },
              grid: baseGrid,
              legend: { show:false },
              tooltip: { theme:'light' },
              dataLabels: { enabled:false },
              markers: { size:3, strokeWidth:0, hover:{size:5} },
            }}
            series={[
              { name:'Recovery %', data: DEMO_DAILY.map(d=>d.recovery) },
              { name:'HRV ms',     data: DEMO_DAILY.map(d=>d.hrv) },
            ]}
          />
        </div>

        {/* Recent sessions */}
        <div style={{ padding: '22px 24px', background: '#fff', border: '1px solid #F0F0F0', borderRadius: 16 }}>
          <SectionLabel>Recent sessions</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_SESSIONS.slice(0,5).map((s,i) => {
              const tc = TYPE_COLORS[s.type] ?? { bg:'#F4F4F5', text:'#71717A', icon:'ki-abstract-26' }
              const sc = s.strain>=14 ? '#EF4444' : s.strain>=10 ? '#F97316' : '#22C55E'
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:11, background:'#FAFAFA', border:'1px solid #F5F5F5' }}>
                  <div style={{ width:32,height:32,borderRadius:9,background:tc.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <i className={`ki-filled ${tc.icon}`} style={{ fontSize:13, color:tc.text }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#18181B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.type}</div>
                    <div style={{ fontSize:10, color:'#A1A1AA' }}>{s.date} · {s.dur}min · HR {s.avg_hr}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div className="pf-num" style={{ fontSize:20, color:sc }}>{s.strain}</div>
                    <div style={{ fontSize:8, color:'#D4D4D8', textTransform:'uppercase', letterSpacing:'0.06em' }}>strain</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── COACH DASHBOARD ──────────────────────────────────────────────
function CoachDash({ name }: { name: string }) {
  const athletes = [
    { ini:'SK', name:'Sara Kowalski',  sport:'Running',          recovery:42, hrv:47.2, rhr:45.8, col:'#2563EB' },
    { ini:'MW', name:'Marcus Weiden',  sport:'Cycling',          recovery:82, hrv:62.2, rhr:52.1, col:'#F97316' },
    { ini:'JT', name:'James Thornton', sport:'Swimming',         recovery:63, hrv:32.0, rhr:73.1, col:'#16A34A' },
    { ini:'LN', name:'Linh Nguyen',    sport:'Weight Training',  recovery:80, hrv:106.5,rhr:55.8, col:'#7C3AED' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="pf-enter">
      <div>
        <div style={{ fontSize:11, color:'#A1A1AA', marginBottom:4 }}>Coach View · WHOOP Data</div>
        <h2 className="pf-num" style={{ fontSize:36, color:'#09090B' }}>Coach Dashboard</h2>
      </div>
      <div className="pf-stagger" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12 }}>
        <BigStat value={4}    label="Athletes"          color="#09090B" />
        <BigStat value="67%"  label="Avg Recovery"      color="#22C55E" />
        <BigStat value={62}   unit="ms" label="Avg HRV" color="#2563EB" sub="WHOOP" />
        <BigStat value={38}   label="Total Sessions"    color="#F97316" />
      </div>
      <div style={{ padding:'22px 24px', background:'#fff', border:'1px solid #F0F0F0', borderRadius:16 }}>
        <SectionLabel>Group Day Strain · 8 weeks</SectionLabel>
        <div style={{ display:'flex', gap:14, marginBottom:4, flexWrap:'wrap' }}>
          {athletes.map((a,i)=>(
            <span key={a.ini} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#A1A1AA' }}>
              <span style={{ width:9,height:9,borderRadius:2,background:AT_COLORS[i],display:'inline-block' }}/>
              {a.name.split(' ')[0]}
            </span>
          ))}
        </div>
        <ApexChart type="bar" height={200}
          options={{
            chart:{ ...baseChart, type:'bar' },
            plotOptions:{ bar:{ borderRadius:4, columnWidth:'62%' } },
            colors: AT_COLORS,
            xaxis:{ categories: DEMO_GROUP.map(d=>d.w), labels: baseTick, axisBorder:{show:false}, axisTicks:{show:false} },
            yaxis:{ labels: baseTick },
            grid: baseGrid,
            legend:{ show:false },
            tooltip:{ theme:'light' },
            dataLabels:{ enabled:false },
          }}
          series={[
            { name:'Sara',   data: DEMO_GROUP.map(d=>d.SK) },
            { name:'Marcus', data: DEMO_GROUP.map(d=>d.MW) },
            { name:'James',  data: DEMO_GROUP.map(d=>d.JT) },
            { name:'Linh',   data: DEMO_GROUP.map(d=>d.LN) },
          ]}
        />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}>
        {athletes.map((a,i)=>{
          const rc = recoveryColor(a.recovery)
          return (
            <div key={a.ini} style={{ padding:'18px 20px', background:'#fff', border:'1px solid #F0F0F0', borderRadius:16 }} className="pf-stat">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:38,height:38,borderRadius:'50%',background:AT_COLORS[i]+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:AT_COLORS[i] }}>{a.ini}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:'#18181B', fontSize:13 }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'#A1A1AA' }}>{a.sport}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="pf-num" style={{ fontSize:28, color:rc, lineHeight:1 }}>{a.recovery}<span style={{ fontSize:14 }}>%</span></div>
                  <div style={{ fontSize:9, color:'#D4D4D8', textTransform:'uppercase', letterSpacing:'0.06em' }}>recovery</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[{v:a.hrv,u:'HRV ms',c:'#2563EB'},{v:a.rhr,u:'RHR bpm',c:'#EF4444'},{v:'—',u:'Sessions',c:'#A1A1AA'}].map(({v,u,c})=>(
                  <div key={u} style={{ padding:'8px',background:'#FAFAFA',borderRadius:10,textAlign:'center' }}>
                    <div className="pf-num" style={{ fontSize:18, color:c }}>{v}</div>
                    <div style={{ fontSize:9, color:'#D4D4D8', marginTop:2, textTransform:'uppercase', letterSpacing:'0.05em' }}>{u}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ADMIN DASHBOARD ──────────────────────────────────────────────
function AdminDash() {
  const tables = ['users','workouts','athletes','daily_metrics','cycle_blocks','competitions','workout_comments','observation_diary','trainer_athletes']
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="pf-enter">
      <div>
        <div style={{ fontSize:11, color:'#A1A1AA', marginBottom:4 }}>Supabase · atlet-pro · eu-central-1</div>
        <h2 className="pf-num" style={{ fontSize:36, color:'#09090B' }}>Admin Panel</h2>
      </div>
      <div className="pf-stagger" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12 }}>
        <BigStat value="100K" unit="rows" label="Dataset Size"  color="#2563EB" sub="WHOOP records" />
        <BigStat value={286}  label="Unique Users"              color="#F97316" />
        <BigStat value={9}    label="DB Tables"                  color="#22C55E" sub="All RLS enabled" />
        <BigStat value={4}    label="Migrations"                 color="#7C3AED" sub="Applied" />
      </div>
      <div style={{ padding:'22px 24px', background:'#fff', border:'1px solid #F0F0F0', borderRadius:16 }}>
        <SectionLabel>Database schema — atlet-pro</SectionLabel>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr>
              {['Table','RLS','Policies','Status'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:700, color:'#D4D4D8', letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid #F0F0F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tables.map((t,i)=>(
              <tr key={t} style={{ background: i%2===1?'#FAFAFA':'transparent' }}>
                <td style={{ padding:'9px 10px', fontFamily:'monospace', fontSize:12, color:'#3F3F46', borderBottom:'1px solid #F5F5F5' }}>{t}</td>
                <td style={{ padding:'9px 10px', borderBottom:'1px solid #F5F5F5' }}>
                  <span className="pf-badge" style={{ background:'#DCFCE7', color:'#16A34A' }}>
                    <i className="ki-filled ki-check" style={{ fontSize:8, marginRight:3 }}/>ON
                  </span>
                </td>
                <td style={{ padding:'9px 10px', fontSize:12, color:'#A1A1AA', borderBottom:'1px solid #F5F5F5' }}>
                  {t==='workouts'?'4':t==='users'?'3':'2'} policies
                </td>
                <td style={{ padding:'9px 10px', borderBottom:'1px solid #F5F5F5' }}>
                  <span className="pf-badge" style={{ background:'#EFF6FF', color:'#2563EB' }}>Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div className="pf-spin" style={{ width:28,height:28,border:'2px solid #F0F0F0',borderTopColor:'#F97316',borderRadius:'50%' }}/>
        <span style={{ fontSize:12, color:'#A1A1AA' }}>Loading dashboard…</span>
      </div>
    </div>
  )
  if (!user) return null
  if (user.role==='coach') return <CoachDash name={user.name} />
  if (user.role==='admin') return <AdminDash />
  return <AthleteDash name={user.name} />
}
