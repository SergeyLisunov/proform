interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon: string
  iconColor: string
  sub?: string
  delta?: number
  accent?: boolean
}

export function StatCard({ label, value, unit, icon, iconColor, sub, delta, accent }: StatCardProps) {
  return (
    <div className="pf-stat" style={{
      background: accent ? '#09090B' : '#fff',
      border: accent ? '1px solid #27272A' : '1px solid #E4E4E7',
      borderRadius: 16,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: accent ? '#52525B' : '#A1A1AA'
        }}>{label}</span>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: iconColor + (accent ? '22' : '15'),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <i className={`ki-filled ${icon}`} style={{ fontSize: 14, color: iconColor }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="pf-num" style={{ fontSize: 32, color: accent ? '#fff' : '#09090B' }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: accent ? '#52525B' : '#A1A1AA' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: accent ? '#3f3f46' : '#A1A1AA', marginTop: 4 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 8,
          fontSize: 11, fontWeight: 600,
          color: delta >= 0 ? '#22C55E' : '#EF4444'
        }}>
          <i className={`ki-filled ${delta >= 0 ? 'ki-arrow-up' : 'ki-arrow-down'}`} style={{ fontSize: 10 }} />
          {delta >= 0 ? '+' : ''}{delta}% vs last week
        </div>
      )}
    </div>
  )
}
