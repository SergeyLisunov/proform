'use client'

import dynamic from 'next/dynamic'
import { ChartCard } from '@/components/ui/metronic'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface WeeklyPoint { w: string; strain: number }
interface DailyPoint  { day: string; recovery: number; hrv: number; strain: number; rhr: number; sleep: number }

interface Props { weeklyData: WeeklyPoint[]; daily7: DailyPoint[] }

export default function AthleteCharts({ weeklyData, daily7 }: Props) {
  const strainOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: false }, background: 'transparent' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5, colors: ['#F35703'] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.15, opacityTo: 0.0, stops: [0, 90, 100], colorStops: [{ offset: 0, color: '#F35703', opacity: 0.15 }, { offset: 100, color: '#F35703', opacity: 0 }] } },
    xaxis: { categories: weeklyData.map(d => d.w), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 4, xaxis: { lines: { show: false } } },
    markers: { size: 4, colors: ['#F35703'], strokeColors: '#fff', strokeWidth: 2 },
    tooltip: { theme: 'light', style: { fontSize: '11px' } },
  }

  const recoveryOptions: ApexCharts.ApexOptions = {
    chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: [2.5, 1.5], dashArray: [0, 5] },
    colors: ['#16A34A', '#2563EB'],
    xaxis: { categories: daily7.map(d => d.day), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
    markers: { size: [4, 0], colors: ['#16A34A', '#2563EB'], strokeColors: '#fff', strokeWidth: 2 },
    legend: { show: false },
    tooltip: { theme: 'light', style: { fontSize: '11px' } },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Weekly strain */}
      <ChartCard title="Нагрузка по дням недели" subtitle="WHOOP day_strain score · последние 8 недель">
        {weeklyData.length > 0 ? (
          <ReactApexChart
            type="area"
            series={[{ name: 'Day Strain', data: weeklyData.map(d => d.strain) }]}
            options={strainOptions}
            height={185}
          />
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">Данных пока нет</div>
        )}
      </ChartCard>

      {/* Recovery + HRV 7 days */}
      <ChartCard
        title="Восстановление и ВСР"
        subtitle="7-дневные биометрики WHOOP"
        toolbar={
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded inline-block bg-green-500" />Восстановление %</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded inline-block bg-blue-500 border-dashed border-t border-blue-500" />ВСР мс</span>
          </div>
        }
      >
        {daily7.length > 0 ? (
          <ReactApexChart
            type="line"
            series={[
              { name: 'Восстановление %', data: daily7.map(d => d.recovery) },
              { name: 'ВСР мс',           data: daily7.map(d => d.hrv) },
            ]}
            options={recoveryOptions}
            height={185}
          />
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">Данных пока нет</div>
        )}
      </ChartCard>
    </div>
  )
}
