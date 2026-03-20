function recoveryColor(v: number) {
  return v >= 67 ? '#22C55E' : v >= 34 ? '#F97316' : '#EF4444'
}
function recoveryLabel(v: number) {
  return v >= 67 ? 'Ready to train' : v >= 34 ? 'Moderate effort' : 'Take it easy'
}

interface RecoveryRingProps {
  score: number
  size?: number
  dark?: boolean
}

export function RecoveryRing({ score, size = 110, dark = false }: RecoveryRingProps) {
  const r = (size / 2) * 0.74
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = recoveryColor(score)
  const bg = dark ? '#1c1c1f' : '#F4F4F5'
  const textCol = dark ? '#fff' : '#09090B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={size * 0.09} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={size * 0.09}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease', filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <span className="pf-num" style={{ fontSize: size * 0.27, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: size * 0.09, color: dark ? '#52525B' : '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {recoveryLabel(score)}
      </span>
    </div>
  )
}
