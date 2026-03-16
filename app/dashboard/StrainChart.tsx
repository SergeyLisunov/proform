'use client'
import ApexChart from '@/components/charts/ApexChart'

interface Props {
  data: { w: string; strain: number }[]
}

export default function StrainChart({ data }: Props) {
  const series = [{ name: 'Day Strain', data: data.map(d => parseFloat(d.strain.toFixed(1))) }]
  const opts = {
    chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: false }, animations: { enabled: true, speed: 600 } },
    colors: ['#F97316'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.15, opacityTo: 0, stops: [0, 100] } },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    dataLabels: { enabled: false },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 3, xaxis: { lines: { show: false } } },
    xaxis: { categories: data.map(d => d.w), labels: { style: { fontSize: '10px', colors: '#94A3B8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => v.toFixed(1) } },
    markers: { size: 4, colors: ['#F97316'], strokeWidth: 0, hover: { size: 6 } },
  }
  return <ApexChart type="area" series={series} options={opts} height={185} width="100%" />
}
