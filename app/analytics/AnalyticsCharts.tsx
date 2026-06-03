'use client'

import ApexChart from '@/components/charts/ApexChart'
import { ChartCard } from '@/components/ui/metronic'

interface Props {
  dailyData: { date: string; recovery: number; hrv: number; rhr: number; strain: number; sleep: number }[]
  weeklyStrain: { w: string; strain: number }[]
  zonePcts: number[]
}

const ZONE_COLORS = ['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
const ZONE_LABELS = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 VO₂max']

export default function AnalyticsCharts({ dailyData, weeklyStrain, zonePcts }: Props) {
  const baseOpts = { chart: { toolbar: { show:false }, animations: { enabled:true, speed:500 } }, grid: { borderColor:'#F1F5F9', strokeDashArray:3 }, xaxis: { labels: { style: { fontSize:'10px', colors:'#94A3B8' } }, axisBorder:{show:false}, axisTicks:{show:false} }, yaxis: { labels: { style: { fontSize:'10px', colors:'#94A3B8' } } }, tooltip: { theme:'light' }, dataLabels: { enabled:false } }

  const recoveryHRVOpts = {
    ...baseOpts,
    chart: { ...baseOpts.chart, type:'line' as const, id:'rv' },
    colors: ['#16A34A','#2563EB'],
    stroke: { curve:'smooth' as const, width:[2.5,1.5], dashArray:[0,4] },
    markers: { size: [4,3], strokeWidth:0 },
    xaxis: { ...baseOpts.xaxis, categories: dailyData.map(d=>d.date) },
    yaxis: [
      { title:{ text:'Recovery %', style:{fontSize:'10px',color:'#16A34A'} }, labels:{ style:{fontSize:'10px',colors:'#94A3B8'} }, min:0, max:100 },
      { opposite:true, title:{ text:'HRV ms', style:{fontSize:'10px',color:'#2563EB'} }, labels:{ style:{fontSize:'10px',colors:'#94A3B8'} } },
    ],
    legend: { position:'top' as const, fontSize:'11px' },
  }

  const strainOpts = {
    ...baseOpts,
    chart: { ...baseOpts.chart, type:'area' as const, id:'str' },
    colors: ['#F97316'],
    fill: { type:'gradient', gradient: { opacityFrom:0.15, opacityTo:0 } },
    stroke: { curve:'smooth' as const, width:2.5 },
    xaxis: { ...baseOpts.xaxis, categories: weeklyStrain.map(d=>d.w) },
    markers: { size:4, colors:['#F97316'], strokeWidth:0 },
  }

  const donutOpts = {
    chart: { type:'donut' as const, toolbar:{show:false}, animations:{enabled:true,speed:600} },
    colors: ZONE_COLORS,
    labels: ZONE_LABELS,
    plotOptions: { pie: { donut: { size:'65%', labels: { show:true, total: { show:true, label:'Total Zones', fontSize:'11px', color:'#64748B' } } } } },
    dataLabels: { enabled: false },
    legend: { position:'bottom' as const, fontSize:'11px', offsetY:4 },
    tooltip: { y: { formatter:(v:number) => v+'%' } },
  }

  const rhrSleepOpts = {
    ...baseOpts,
    chart: { ...baseOpts.chart, type:'bar' as const, id:'rhr' },
    colors: ['#DC2626','#7C3AED'],
    plotOptions: { bar: { borderRadius:4, columnWidth:'60%' } },
    stroke: { show:false },
    xaxis: { ...baseOpts.xaxis, categories: dailyData.slice(0,14).map(d=>d.date) },
    legend: { position:'top' as const, fontSize:'11px' },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartCard title="Recovery & HRV — 30 Days" subtitle="Daily WHOOP biometrics" accent>
        <ApexChart type="line" options={recoveryHRVOpts}
          series={[{ name:'Recovery %', data: dailyData.map(d=>d.recovery) }, { name:'HRV ms', data: dailyData.map(d=>d.hrv) }]}
          height={200} width="100%" />
      </ChartCard>

      <ChartCard title="Weekly Day Strain" subtitle="WHOOP day_strain cumulative">
        <ApexChart type="area" options={strainOpts}
          series={[{ name:'Day Strain', data: weeklyStrain.map(d=>d.strain) }]}
          height={200} width="100%" />
      </ChartCard>

      <ChartCard title="HR Zone Distribution" subtitle="Aggregated across all sessions">
        {zonePcts.some(p=>p>0) ? (
          <ApexChart type="donut" options={donutOpts} series={zonePcts} height={260} width="100%" />
        ) : (
          <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No zone data available</div>
        )}
      </ChartCard>

      <ChartCard title="RHR & Sleep — 14 Days" subtitle="Resting heart rate & sleep hours">
        <ApexChart type="bar" options={rhrSleepOpts}
          series={[{ name:'RHR bpm', data: dailyData.slice(0,14).map(d=>d.rhr) }, { name:'Sleep hrs', data: dailyData.slice(0,14).map(d=>d.sleep) }]}
          height={200} width="100%" />
      </ChartCard>
    </div>
  )
}
