'use client'
import dynamic from 'next/dynamic'
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100 rounded-xl" /> })
export default ApexChart
