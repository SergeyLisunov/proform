const rc = (v: number) => v >= 67 ? '#16A34A' : v >= 34 ? '#F35703' : '#DC2626'
const rl = (v: number) => v >= 67 ? 'Готов' : v >= 34 ? 'Умеренно' : 'Низко'

export function RecoveryRing({
  score,
  size = 120,
  label,
}: {
  score: number
  size?: number
  label?: string
}) {
  const r = (size / 2) * 0.76
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = rc(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F2F2F3" strokeWidth={size * 0.08} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={size * 0.08}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .6s ease, stroke .4s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="pf-num" style={{ fontSize: size * 0.26, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: size * 0.08, color: '#ADADB3', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label ?? rl(score)}</span>
    </div>
  )
}
