interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon: string
  iconColor: string
  iconBg?: string
  sub?: string
  delta?: number
}

export function StatCard({ label, value, unit, icon, iconColor, iconBg, sub, delta }: StatCardProps) {
  // iconBg accepts a Tailwind class string (e.g. "bg-orange-50 text-orange-500")
  // or falls back to a computed inline style using iconColor
  const useTailwindBg = Boolean(iconBg)

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 pf-card-hover cursor-default">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${useTailwindBg ? iconBg : ''}`}
          style={useTailwindBg ? undefined : { background: iconColor + '15' }}
        >
          <i
            className={`ki-filled ${icon} text-base ${useTailwindBg ? '' : ''}`}
            style={useTailwindBg ? undefined : { color: iconColor }}
          />
        </div>
      </div>

      <div className="flex items-end gap-1.5">
        <span className="pf-num text-4xl text-foreground leading-none">{value}</span>
        {unit && (
          <span className="text-sm text-muted-foreground mb-0.5 font-medium">{unit}</span>
        )}
        {delta !== undefined && (
          <span className={`text-2xs font-bold ml-auto mb-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>

      {sub && (
        <p className="text-2xs text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}
