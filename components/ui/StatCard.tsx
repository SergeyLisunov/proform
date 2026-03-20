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
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16, padding: '18px 20px', transition: 'box-shadow .15s,transform .15s', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.transform = '' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A1A1AA' }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: iconColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ki-filled ${icon}`} style={{ fontSize: 14, color: iconColor }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="pf-num" style={{ fontSize: 34, color: '#09090B' }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: '#A1A1AA' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, fontWeight: 600, color: delta >= 0 ? '#22C55E' : '#EF4444' }}>
          <i className={`ki-filled ${delta >= 0 ? 'ki-arrow-up' : 'ki-arrow-down'}`} style={{ fontSize: 10 }} />
          {delta >= 0 ? '+' : ''}{delta}% vs last week
        </div>
      )}
    </div>
  )
}
