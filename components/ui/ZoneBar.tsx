const ZONE_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444']

interface ZoneBarProps {
  zones: (number | null)[]
  height?: number
  showLabels?: boolean
}

export function ZoneBar({ zones, height = 6, showLabels = false }: ZoneBarProps) {
  const vals = zones.map(v => v ?? 0)
  const total = vals.reduce((a, b) => a + b, 0) || 1
  return (
    <div>
      <div className="flex rounded overflow-hidden" style={{ height, gap: 1 }}>
        {vals.map((v, i) =>
          v > 0 ? (
            <div
              key={i}
              style={{ flex: v / total * 100, background: ZONE_COLORS[i], minWidth: 2 }}
              title={`Z${i + 1}: ${v}min`}
            />
          ) : null
        )}
      </div>
      {showLabels && (
        <div className="flex gap-3 mt-2 flex-wrap">
          {['Z1','Z2','Z3','Z4','Z5'].map((z, i) => (
            vals[i] > 0 && (
              <span key={z} className="text-[9px] text-slate-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: ZONE_COLORS[i] }} />
                {z}: {vals[i]}m
              </span>
            )
          ))}
        </div>
      )}
    </div>
  )
}
