'use client'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import dynamic from 'next/dynamic'
const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })
import { DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, DEMO_SESSIONS, DEMO_GROUP, recoveryColor } from '@/lib/utils/data'

const ZC = ['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
const ZL = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max']

const sparkOpts = (color: string) => ({
  chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth' as const, width: 2, colors: [color] },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.0 } },
  colors: [color],
  tooltip: { enabled: false },
  dataLabels: { enabled: false },
})

const weekLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function StatCard({ label, value, unit, icon, iconBg, delta, sub, sparkData, sparkColor }: {
  label: string; value: string | number; unit?: string; icon: string; iconBg: string
  delta?: number; sub?: string; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-2sm text-muted-foreground font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="pf-num text-4xl text-foreground leading-none">{value}</span>
        {unit && <span className="text-sm text-muted-foreground mb-0.5 font-medium">{unit}</span>}
        {delta !== undefined && (
          <span className={`text-2xs font-bold ml-auto mb-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {sparkData && sparkColor && (
        <div className="-mx-1">
          <ApexChart type="area" series={[{ data: sparkData }]} options={sparkOpts(sparkColor)} height={48} />
        </div>
      )}
      {sub && <p className="text-2xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ──────────────────────────────────────────────
function AthleteDash({ name }: { name: string }) {
  const rc = recoveryColor(42)
  const hrv7d = [41, 44, 50, 48, 47, 45, 47]
  const strain7d = [8.2, 11.5, 7.1, 14.2, 10.8, 6.3, 12.1]

  const lineOpts = {
    chart: { type: 'line' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: [2, 2], dashArray: [0, 5] },
    colors: ['#F97316', '#60A5FA'],
    xaxis: { categories: weekLabels, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: [
      { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
      { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    ],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontSize: '12px', fontFamily: 'DM Sans' },
    tooltip: { theme: 'light' },
    dataLabels: { enabled: false },
  }

  return (
    <div className="flex flex-col gap-6 pf-enter">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            USER_00011 · WHOOP Live
          </p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">
            Good morning, {name.split(' ')[0]} 🏃
          </h2>
        </div>
        <RecoveryRing score={42} size={100} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        <StatCard
          label="Avg HRV"
          value={47.2} unit="ms"
          icon="ki-abstract-26" iconBg="bg-blue-50 text-blue-600"
          sub="WHOOP metric"
          sparkData={hrv7d} sparkColor="#2563EB"
        />
        <StatCard
          label="Resting HR"
          value={45.8} unit="bpm"
          icon="ki-heart" iconBg="bg-red-50 text-red-500"
          delta={-3}
          sparkData={[48,47,46,47,45,46,46]} sparkColor="#EF4444"
        />
        <StatCard
          label="Avg Sleep"
          value={7.8} unit="hrs"
          icon="ki-moon" iconBg="bg-violet-50 text-violet-600"
          sparkData={[7.2,8.1,7.5,8.3,7.8,8.0,7.8]} sparkColor="#7C3AED"
        />
        <StatCard
          label="Cal / Day"
          value="3,415" unit="kcal"
          icon="ki-abstract-31" iconBg="bg-orange-50 text-orange-500"
          delta={5}
          sparkData={[3100,3400,3200,3500,3350,3600,3415]} sparkColor="#F97316"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Strain + HRV line chart */}
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Weekly Strain & HRV</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">Last 7 days vs baseline</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-2xs font-semibold text-orange-600">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              This week
            </span>
          </div>
          <ApexChart
            type="line"
            series={[
              { name: 'Strain', data: strain7d },
              { name: 'HRV (ms)', data: hrv7d },
            ]}
            options={lineOpts}
            height={200}
          />
        </div>

        {/* Recovery ring + metrics */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground">Today's Recovery</h3>
          <div className="flex items-center justify-center">
            <RecoveryRing score={42} size={120} />
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Sleep Quality', val: '72%', color: '#F97316' },
              { label: 'HRV Score',     val: '47 ms', color: '#2563EB' },
              { label: 'Resting HR',    val: '46 bpm', color: '#EF4444' },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-2sm text-muted-foreground">{m.label}</span>
                <span className="text-2sm font-semibold text-foreground">{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Sessions</h3>
          <a href="/diary" className="text-2xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">View all →</a>
        </div>
        <div className="divide-y divide-border">
          {DEMO_SESSIONS.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <i className="ki-filled ki-abstract-26 text-orange-500 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{s.type}</div>
                <div className="text-2xs text-muted-foreground">{s.dur} min · {s.date}</div>
              </div>
              <ZoneBar zones={s.z} height={28} />
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-foreground pf-num">{s.strain}</div>
                <div className="text-2xs text-muted-foreground">strain</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
function CoachDash({ name }: { name: string }) {
  const barOpts = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 6 } },
    colors: ['#F97316'],
    xaxis: { categories: ['Sara K.', 'Marcus W.', 'James T.', 'Linh N.'], labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    tooltip: { theme: 'light' },
    dataLabels: { enabled: false },
  }

  const athletes = [
    { name: 'Sara Kowalski',   sport: 'Running',        recovery: 42, hrv: 47.2, status: 'warning' },
    { name: 'Marcus Weiden',   sport: 'Cycling',        recovery: 82, hrv: 62.2, status: 'good' },
    { name: 'James Thornton',  sport: 'Swimming',       recovery: 63, hrv: 32.0, status: 'ok' },
    { name: 'Linh Nguyen',     sport: 'Weight Training',recovery: 80, hrv: 106.5,status: 'good' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Coach View</p>
        <h2 className="pf-num text-[36px] text-foreground leading-none">
          Welcome back, {name.split(' ')[0]} 👋
        </h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Active Athletes', value: '4',  icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Avg Team Recovery', value: '67%', icon: 'ki-abstract-26', bg: 'bg-green-50 text-green-600' },
          { label: 'Sessions Today',   value: '3',  icon: 'ki-calendar',      bg: 'bg-orange-50 text-orange-500' },
          { label: 'Alerts',           value: '1',  icon: 'ki-notification',  bg: 'bg-red-50 text-red-500' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Athlete Status</h3>
            <a href="/athletes" className="text-2xs font-semibold text-orange-500 hover:text-orange-600">Manage →</a>
          </div>
          <div className="divide-y divide-border">
            {athletes.map(a => {
              const rc = recoveryColor(a.recovery)
              const statusIcon = a.status === 'good' ? 'ki-check-circle' : a.status === 'warning' ? 'ki-warning-2' : 'ki-information-2'
              const statusColor = a.status === 'good' ? 'text-green-500' : a.status === 'warning' ? 'text-orange-500' : 'text-blue-500'
              return (
                <div key={a.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num" style={{ background: rc + '20', color: rc }}>
                    {a.name.split(' ').map((n:string) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{a.name}</div>
                    <div className="text-2xs text-muted-foreground">{a.sport}</div>
                  </div>
                  <div className="text-right">
                    <div className="pf-num text-lg leading-none" style={{ color: rc }}>{a.recovery}%</div>
                    <div className="text-2xs text-muted-foreground">recovery</div>
                  </div>
                  <div className="w-28 hidden sm:block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xs text-muted-foreground">HRV</span>
                      <span className="text-2xs font-bold text-foreground">{a.hrv} ms</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                    </div>
                  </div>
                  <i className={`ki-filled ${statusIcon} text-base ${statusColor} shrink-0`} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recovery Distribution</h3>
          <ApexChart
            type="bar"
            series={[{ name: 'Recovery %', data: [42, 82, 63, 80] }]}
            options={barOpts}
            height={200}
          />
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
function AdminDash({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Admin View</p>
        <h2 className="pf-num text-[36px] text-foreground leading-none">System Overview</h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Total Users',    value: '3',      icon: 'ki-people',       bg: 'bg-blue-50 text-blue-600' },
          { label: 'Athletes',       value: '1',      icon: 'ki-abstract-26',  bg: 'bg-orange-50 text-orange-500' },
          { label: 'Coaches',        value: '1',      icon: 'ki-notepad-edit', bg: 'bg-green-50 text-green-600' },
          { label: 'WHOOP Records',  value: '100K',   icon: 'ki-chart-line-up',bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">System Health</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Supabase DB',       status: 'Online',  color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'WHOOP Data Sync',   status: 'Active',  color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Auth Service',      status: 'Healthy', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
              <span className={`w-2 h-2 rounded-full ${s.color} shrink-0`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{s.label}</div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${s.badge}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <a href="/admin" className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-setting-2 text-sm" />
          Go to Admin Panel
        </a>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          <span className="text-2sm text-muted-foreground">Loading your data…</span>
        </div>
      </div>
    )
  }

  const name = user?.name ?? 'Athlete'

  if (user?.role === 'coach') return <CoachDash name={name} />
  if (user?.role === 'admin') return <AdminDash name={name} />
  return <AthleteDash name={name} />
}
