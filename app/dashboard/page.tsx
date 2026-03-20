'use client'
import { useUser } from '@/lib/hooks/useUser'
import { StatCard } from '@/components/ui/StatCard'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import ApexChart from '@/components/charts/ApexChart'
import { DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, DEMO_SESSIONS, DEMO_GROUP, TYPE_COLORS, recoveryColor } from '@/lib/utils/data'

const ZC = ['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
const ZL = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max']
const ZB = ['<120','120–140','140–160','160–175','175+']
const AT = ['#2563EB','#F97316','#16A34A','#7C3AED']

const areaOpts = (color: string) => ({
  chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: false }, animations: { enabled: false } },
  stroke: { curve: 'smooth' as const, width: 1.5, colors: [color] },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.08, opacityTo: 0, stops: [0,100] } },
  colors: [color],
  xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { labels: { show: false } },
  grid: { show: false },
  tooltip: { enabled: false },
  dataLabels: { enabled: false },
})

// ── ATHLETE ────────────────────────────────────────────
function AthleteDash({ name }: { name: string }) {
  const rc = recoveryColor(42)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="pf-enter">

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#ADADB3', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            USER_00011 · WHOOP Live
          </div>
          <h2 className="pf-num" style={{ fontSize: 38, color: '#0A0A0B', lineHeight: 1 }}>
            Good morning,<br />{name.split(' ')[0]} 🏃
          </h2>
        </div>
        <RecoveryRing score={42} size={108} />
      </div>

      {/* KPI row — editorial big numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }} className="pf-stagger">
        <StatCard label="Avg HRV"     value={47.2}  unit="ms"   icon="ki-abstract-26"  iconColor="#2563EB" sub="WHOOP metric" />
        <StatCard label="Resting HR"  value={45.8}  unit="bpm"  icon="ki-heart"         iconColor="#DC2626" delta={-3} />
        <StatCard label="Avg Sleep"   value={7.8}   unit="hrs"  icon="ki-moon"          iconColor="#7C3AED" />
        <StatCard label="Cal / Day"   value="3,415" unit="kcal" icon="ki-abstract-31"   iconColor="#F97316" delta={5} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Strain area chart */}
        <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Weekly Strain</div>
              <div className="pf-num" style={{ fontSize: 44, color: '#0A0A0B', lineHeight: 1.1 }}>
                {DEMO_WEEKLY[DEMO_WEEKLY.length-1].strain}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>↑ 8% vs prev</div>
          </div>
          <ApexChart
            type="area" height={90}
            options={{ ...areaOpts('#F97316'),
              xaxis: { categories: DEMO_WEEKLY.map(d => d.w), labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
            }}
            series={[{ name: 'Strain', data: DEMO_WEEKLY.map(d => d.strain) }]}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {DEMO_WEEKLY.map(d => <span key={d.w} style={{ fontSize: 9, color: '#ADADB3' }}>{d.w}</span>)}
          </div>
        </div>

        {/* Recovery 7-day line */}
        <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Recovery · 7 Days</div>
              <div className="pf-num" style={{ fontSize: 44, color: rc, lineHeight: 1.1 }}>42%</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>↓ Low zone</span>
          </div>
          <ApexChart
            type="area" height={90}
            options={{ ...areaOpts(rc),
              xaxis: { categories: DEMO_DAILY.map(d => d.day), labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
            }}
            series={[{ name: 'Recovery', data: DEMO_DAILY.map(d => d.recovery) }]}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {DEMO_DAILY.map(d => <span key={d.day} style={{ fontSize: 9, color: '#ADADB3' }}>{d.day}</span>)}
          </div>
        </div>
      </div>

      {/* Bottom row: HR Zones + Sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* HR zones */}
        <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>HR Zone Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {ZL.map((z, i) => (
              <div key={z}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 1, background: ZC[i], display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: '#3D3D40' }}>{z}</span>
                    <span style={{ fontSize: 10, color: '#ADADB3' }}>{ZB[i]}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0B' }}>{DEMO_HRZ[i]}%</span>
                </div>
                <div style={{ height: 4, background: '#F2F2F3', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${DEMO_HRZ[i] * 2}%`, background: ZC[i], borderRadius: 2, transition: 'width .4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Recent Sessions</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FFF3E8', color: '#F97316' }}>Running</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_SESSIONS.slice(0, 5).map((s, i) => {
              const tc = TYPE_COLORS[s.type] ?? { bg: '#F7F7F8', text: '#7A7A80', icon: 'ki-abstract-26' }
              const total = s.z.reduce((a: number, b: number) => a + b, 0) || 1
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ki-filled ${tc.icon}`} style={{ fontSize: 13, color: tc.text }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0A0A0B', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.type}</span>
                      <span className="pf-num" style={{ fontSize: 18, color: s.strain >= 14 ? '#DC2626' : s.strain >= 10 ? '#F97316' : '#16A34A', flexShrink: 0, marginLeft: 8 }}>{s.strain}</span>
                    </div>
                    <div style={{ height: 3, background: '#F2F2F3', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ display: 'flex', height: '100%', borderRadius: 2, overflow: 'hidden', gap: 0.5 }}>
                        {s.z.map((v: number, zi: number) => v > 0 ? <div key={zi} style={{ flex: v/total*100, background: ZC[zi], minWidth: 1 }} /> : null)}
                      </div>
                    </div>
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

// ── COACH ──────────────────────────────────────────────
function CoachDash({ name }: { name: string }) {
  const athletes = [
    { ini:'SK', name:'Sara Kowalski',  sport:'Running',         recovery:42,  hrv:47.2,  rhr:45.8, col:'#2563EB' },
    { ini:'MW', name:'Marcus Weiden',  sport:'Cycling',         recovery:82,  hrv:62.2,  rhr:52.1, col:'#F97316' },
    { ini:'JT', name:'James Thornton', sport:'Swimming',        recovery:63,  hrv:32.0,  rhr:73.1, col:'#16A34A' },
    { ini:'LN', name:'Linh Nguyen',    sport:'Wt. Training',    recovery:80,  hrv:106.5, rhr:55.8, col:'#7C3AED' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="pf-enter">
      <div>
        <div style={{ fontSize: 11, color: '#ADADB3', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>WHOOP Data · Coach View</div>
        <h2 className="pf-num" style={{ fontSize: 38, color: '#0A0A0B', lineHeight: 1 }}>Coach Dashboard<br /><span style={{ color: '#ADADB3', fontSize: 26 }}>{name}</span></h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }} className="pf-stagger">
        <StatCard label="Athletes"       value={4}     icon="ki-people"       iconColor="#2563EB" />
        <StatCard label="Avg Recovery"   value="67%"   icon="ki-abstract-26"  iconColor="#16A34A" />
        <StatCard label="Avg HRV"        value={62}    unit="ms" icon="ki-heart" iconColor="#2563EB" sub="WHOOP" />
        <StatCard label="Total Sessions" value={38}    icon="ki-abstract-17"  iconColor="#F97316" delta={11} />
      </div>

      {/* Group strain chart */}
      <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Group Day Strain · 8 Weeks</div>
            <div style={{ fontSize: 12, color: '#7A7A80', marginTop: 2 }}>Real WHOOP day_strain · all athletes</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {athletes.map((a, i) => (
              <span key={a.ini} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7A7A80' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: AT[i], display: 'inline-block' }} />
                {a.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
        <ApexChart type="bar" height={200}
          options={{
            chart: { type: 'bar', toolbar: { show: false }, animations: { enabled: false } },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
            colors: AT,
            xaxis: { categories: DEMO_GROUP.map(d => d.w), labels: { style: { fontSize: '10px', colors: '#ADADB3' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { fontSize: '10px', colors: '#ADADB3' } } },
            grid: { borderColor: '#F2F2F3', strokeDashArray: 4 },
            legend: { show: false },
            dataLabels: { enabled: false },
            tooltip: { theme: 'light' },
          }}
          series={[
            { name: 'Sara',   data: DEMO_GROUP.map(d => d.SK) },
            { name: 'Marcus', data: DEMO_GROUP.map(d => d.MW) },
            { name: 'James',  data: DEMO_GROUP.map(d => d.JT) },
            { name: 'Linh',   data: DEMO_GROUP.map(d => d.LN) },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        {athletes.map((a, i) => {
          const rc2 = recoveryColor(a.recovery)
          return (
            <div key={a.ini} style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: AT[i] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, color: AT[i], flexShrink: 0 }}>{a.ini}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#0A0A0B', fontSize: 13 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#ADADB3' }}>{a.sport}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pf-num" style={{ fontSize: 28, color: rc2, lineHeight: 1 }}>{a.recovery}%</div>
                  <div style={{ fontSize: 9, color: '#ADADB3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>recovery</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {[{ v: a.hrv, u: 'HRV ms', c: '#2563EB' }, { v: a.rhr, u: 'RHR bpm', c: '#DC2626' }, { v: '-', u: 'Sessions', c: '#7A7A80' }].map(({ v, u, c }) => (
                  <div key={u} style={{ background: '#F7F7F8', borderRadius: 8, padding: '8px 8px', textAlign: 'center' }}>
                    <div className="pf-num" style={{ fontSize: 18, color: c }}>{v}</div>
                    <div style={{ fontSize: 8, color: '#ADADB3', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{u}</div>
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

// ── ADMIN ───────────────────────────────────────────────
function AdminDash() {
  const tables = ['users','workouts','athletes','daily_metrics','cycle_blocks','competitions','workout_comments','observation_diary','trainer_athletes']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="pf-enter">
      <div>
        <div style={{ fontSize: 11, color: '#ADADB3', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Supabase · atlet-pro · eu-central-1</div>
        <h2 className="pf-num" style={{ fontSize: 38, color: '#0A0A0B' }}>Admin Overview</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }} className="pf-stagger">
        <StatCard label="Dataset"      value="100K" unit="records" icon="ki-abstract-28"  iconColor="#2563EB" />
        <StatCard label="Unique Users" value={286}               icon="ki-people"        iconColor="#F97316" />
        <StatCard label="DB Tables"    value={9}                 icon="ki-abstract-22"   iconColor="#16A34A" sub="All RLS enabled" />
        <StatCard label="Migrations"   value={3}                 icon="ki-setting-2"     iconColor="#7C3AED" sub="All applied" highlight />
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #EBEBEC', borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Schema — public</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{['Table','RLS','Policies','Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1.5px solid #EBEBEC' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {tables.map((t, i) => (
                <tr key={t} style={{ background: i%2 ? '#FAFAFA' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: '#0A0A0B', borderBottom: '1px solid #F2F2F3' }}>{t}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F2F2F3' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A' }}>ON</span>
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: '#7A7A80', borderBottom: '1px solid #F2F2F3' }}>
                    {t === 'workouts' ? '4' : t === 'users' ? '3' : '2'}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F2F2F3' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#EFF6FF', color: '#2563EB' }}>Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── ROOT ────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 28, height: 28, border: '2px solid #EBEBEC', borderTopColor: '#F97316', borderRadius: '50%' }} className="pf-spin" />
      <span style={{ fontSize: 12, color: '#ADADB3' }}>Loading dashboard…</span>
    </div>
  )
  if (!user) return null
  if (user.role === 'coach') return <CoachDash name={user.name} />
  if (user.role === 'admin') return <AdminDash />
  return <AthleteDash name={user.name} />
}
