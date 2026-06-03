const ZC = ['#60A5FA','#34D399','#FBBF24','#F35703','#EF4444']

export function ZoneBar({ zones, height = 6, showLabels = false }: { zones: (number|null)[], height?: number, showLabels?: boolean }) {
  const vals = zones.map(v => v ?? 0)
  const total = vals.reduce((a, b) => a + b, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height, gap: 1 }}>
        {vals.map((v, i) => v > 0 ? <div key={i} style={{ flex: v/total*100, background: ZC[i], minWidth: 2 }} title={`Z${i+1}: ${v}min`} /> : null)}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
          {['Z1','Z2','Z3','Z4','Z5'].map((z, i) => vals[i] > 0 && (
            <span key={z} style={{ fontSize: 9, color: '#ADADB3', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 1, background: ZC[i], display: 'inline-block' }} />
              {z}: {vals[i]}m
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
