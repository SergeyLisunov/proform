interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon: string
  iconColor: string
  sub?: string
  delta?: number
}

export function StatCard({ label, value, unit, icon, iconColor, sub, delta }: StatCardProps) {
  return (
    <div className="card pf-stat-card rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconColor + '18' }}>
          <i className={`ki-filled ${icon} text-sm`} style={{ color: iconColor }} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="pf-num text-[2rem] text-slate-900 leading-none">{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-1.5">{sub}</div>}
      {delta !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          <i className={`ki-filled ${delta >= 0 ? 'ki-arrow-up' : 'ki-arrow-down'} text-[10px]`} />
          {delta >= 0 ? '+' : ''}{delta}% vs prev week
        </div>
      )}
    </div>
  )
}
