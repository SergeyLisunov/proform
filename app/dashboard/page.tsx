'use client'

import { useUser } from '@/lib/hooks/useUser'
import { StatCard } from '@/components/ui/StatCard'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import ApexChart from '@/components/charts/ApexChart'
import {
  DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, DEMO_SESSIONS, DEMO_GROUP,
  TYPE_COLORS, recoveryColor,
} from '@/lib/utils/data'

const ZONE_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444']
const ZONE_LABELS = ['Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO₂max']
const AT_COLORS = ['#2563EB', '#F97316', '#16A34A', '#7C3AED']

function AthleteDashboard({ name }: { name: string }) {
  const rc = recoveryColor(42)
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">WHOOP Live Data · USER_00011</p>
          <h2 className="pf-num text-3xl text-slate-900">Good morning, {name.split(' ')[0]} 🏃</h2>
        </div>
        <RecoveryRing score={42} size={90} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Avg HRV" value={47.2} unit="ms" icon="ki-abstract-26" iconColor="#2563EB" sub="WHOOP metric" />
        <StatCard label="Resting HR" value={45.8} unit="bpm" icon="ki-heart" iconColor="#DC2626" />
        <StatCard label="Avg Sleep" value={7.8} unit="hrs" icon="ki-moon" iconColor="#7C3AED" />
        <StatCard label="Calories / Day" value="3,415" unit="kcal" icon="ki-abstract-31" iconColor="#F97316" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Weekly Day Strain</p>
          <p className="text-xs text-slate-400 mb-4">WHOOP day_strain · last 8 weeks</p>
          <ApexChart
            type="area"
            height={185}
            options={{
              chart: { type: 'area', toolbar: { show: false } },
              stroke: { curve: 'smooth', width: 2 },
              colors: ['#F97316'],
              fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.01, stops: [0, 100] } },
              xaxis: { categories: DEMO_WEEKLY.map(d => d.w), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
              yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
              grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
              tooltip: { theme: 'light' },
              dataLabels: { enabled: false },
            }}
            series={[{ name: 'Strain', data: DEMO_WEEKLY.map(d => d.strain) }]}
          />
        </div>
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">HR Zone Mix</p>
          <p className="text-xs text-slate-400 mb-4">Aggregated · real WHOOP data</p>
          <div className="flex flex-col gap-2.5 mt-2">
            {ZONE_LABELS.map((z, i) => (
              <div key={z}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: ZONE_COLORS[i] }} />
                    <span className="text-xs text-slate-500">{z}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{DEMO_HRZ[i]}%</span>
                </div>
                <div className="h-1.5 rounded bg-slate-100">
                  <div className="h-full rounded transition-all" style={{ width: `${DEMO_HRZ[i] * 2}%`, background: ZONE_COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Recovery & HRV · 7 Days</p>
          <p className="text-xs text-slate-400 mb-4">WHOOP daily biometrics</p>
          <ApexChart
            type="line"
            height={165}
            options={{
              chart: { type: 'line', toolbar: { show: false } },
              stroke: { curve: 'smooth', width: [2.5, 1.5], dashArray: [0, 5] },
              colors: [rc, '#2563EB'],
              xaxis: { categories: DEMO_DAILY.map(d => d.day), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
              yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
              grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
              legend: { show: false },
              tooltip: { theme: 'light' },
              dataLabels: { enabled: false },
            }}
            series={[
              { name: 'Recovery %', data: DEMO_DAILY.map(d => d.recovery) },
              { name: 'HRV ms', data: DEMO_DAILY.map(d => d.hrv) },
            ]}
          />
        </div>

        <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Recent Sessions</p>
              <p className="text-xs text-slate-400">{DEMO_SESSIONS.length} sessions · WHOOP</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#DBEAFE] text-[#2563EB]">Running</span>
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_SESSIONS.slice(0, 5).map((s, i) => {
              const tc = TYPE_COLORS[s.type] ?? { bg: '#F8FAFC', text: '#64748B', icon: 'ki-abstract-26' }
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc.bg }}>
                    <i className={`ki-filled ${tc.icon} text-sm`} style={{ color: tc.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{s.type}</div>
                    <div className="text-xs text-slate-400">{s.date} · {s.dur}min · HR {s.avg_hr}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-lg leading-none" style={{ color: s.strain >= 14 ? '#DC2626' : s.strain >= 10 ? '#F97316' : '#2563EB' }}>{s.strain}</div>
                    <div className="text-[9px] text-slate-400">strain</div>
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

function CoachDashboard({ name }: { name: string }) {
  const athletes = [
    { ini: 'SK', name: 'Sara Kowalski',  sport: 'Running',          recovery: 42, hrv: 47.2,  rhr: 45.8, col: '#2563EB' },
    { ini: 'MW', name: 'Marcus Weiden',  sport: 'Cycling',          recovery: 82, hrv: 62.2,  rhr: 52.1, col: '#F97316' },
    { ini: 'JT', name: 'James Thornton', sport: 'Swimming',         recovery: 63, hrv: 32.0,  rhr: 73.1, col: '#16A34A' },
    { ini: 'LN', name: 'Linh Nguyen',    sport: 'Weight Training',  recovery: 80, hrv: 106.5, rhr: 55.8, col: '#7C3AED' },
  ]
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">WHOOP Data · Coach View</p>
        <h2 className="pf-num text-3xl text-slate-900">Coach Dashboard — {name}</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Athletes" value={4} icon="ki-people" iconColor="#2563EB" />
        <StatCard label="Avg Recovery" value="67%" icon="ki-abstract-26" iconColor="#16A34A" />
        <StatCard label="Avg Group HRV" value={62} unit="ms" icon="ki-heart" iconColor="#2563EB" sub="WHOOP" />
        <StatCard label="Total Sessions" value={38} icon="ki-abstract-17" iconColor="#F97316" />
      </div>
      <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group Day Strain · 8 Weeks</p>
            <p className="text-xs text-slate-400">Real WHOOP day_strain · all athletes</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {athletes.map((a, i) => (
              <span key={a.ini} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: AT_COLORS[i] }} />
                {a.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
        <ApexChart
          type="bar"
          height={220}
          options={{
            chart: { type: 'bar', toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '65%' } },
            colors: AT_COLORS,
            xaxis: { categories: DEMO_GROUP.map(d => d.w), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
            grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
            legend: { show: false },
            tooltip: { theme: 'light' },
            dataLabels: { enabled: false },
          }}
          series={[
            { name: 'Sara',   data: DEMO_GROUP.map(d => d.SK) },
            { name: 'Marcus', data: DEMO_GROUP.map(d => d.MW) },
            { name: 'James',  data: DEMO_GROUP.map(d => d.JT) },
            { name: 'Linh',   data: DEMO_GROUP.map(d => d.LN) },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {athletes.map((a, i) => {
          const rc = recoveryColor(a.recovery)
          return (
            <div key={a.ini} className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 pf-num text-lg font-bold" style={{ background: AT_COLORS[i] + '20', color: AT_COLORS[i] }}>{a.ini}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.sport}</div>
                </div>
                <div className="text-right">
                  <div className="pf-num text-2xl leading-none" style={{ color: rc }}>{a.recovery}%</div>
                  <div className="text-[9px] text-slate-400">recovery</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ v: a.hrv, u: 'HRV ms', c: '#2563EB' }, { v: a.rhr, u: 'RHR bpm', c: '#DC2626' }, { v: 'n/a', u: 'Sessions', c: '#64748B' }].map(({ v, u, c }) => (
                  <div key={u} className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="pf-num text-xl" style={{ color: c }}>{v}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{u}</div>
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

function AdminDashboard() {
  const tables = ['users','workouts','athletes','daily_metrics','cycle_blocks','competitions','workout_comments','observation_diary','trainer_athletes']
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">16 March 2026</p>
        <h2 className="pf-num text-3xl text-slate-900">Admin · Platform Overview</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Dataset Rows" value="100K" unit="WHOOP records" icon="ki-abstract-28" iconColor="#2563EB" />
        <StatCard label="Unique Users" value={286} icon="ki-people" iconColor="#F97316" />
        <StatCard label="DB Tables" value={9} icon="ki-abstract-22" iconColor="#16A34A" sub="All RLS enabled" />
        <StatCard label="Migrations" value={3} icon="ki-setting-2" iconColor="#7C3AED" sub="All applied" />
      </div>
      <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Database Schema — atlet-pro (eu-central-1)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>{['Table', 'RLS', 'Policies', 'Status'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#F1F5F9]">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {tables.map((t, i) => (
                <tr key={t} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                  <td className="py-2.5 px-3 font-mono text-sm text-slate-700">{t}</td>
                  <td className="py-2.5 px-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A]"><i className="ki-filled ki-check text-[8px] mr-0.5" />ON</span></td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{t === 'workouts' ? '4 policies' : t === 'users' ? '3 policies' : '2 policies'}</td>
                  <td className="py-2.5 px-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#2563EB]">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, loading } = useUser()
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
        <span className="text-sm text-slate-400">Loading dashboard…</span>
      </div>
    </div>
  )
  if (!user) return null
  if (user.role === 'coach') return <CoachDashboard name={user.name} />
  if (user.role === 'admin') return <AdminDashboard />
  return <AthleteDashboard name={user.name} />
}
