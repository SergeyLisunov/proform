function recoveryColor(v: number) {
  return v >= 67 ? '#16A34A' : v >= 34 ? '#F97316' : '#DC2626'
}
function recoveryLabel(v: number) {
  return v >= 67 ? 'Ready to train' : v >= 34 ? 'Moderate effort' : 'Take it easy'
}

interface RecoveryRingProps {
  score: number
  size?: number
}

export function RecoveryRing({ score, size = 100 }: RecoveryRingProps) {
  const r = (size / 2) * 0.72
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = recoveryColor(score)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={size * 0.1} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={size * 0.1}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="pf-num leading-none" style={{ fontSize: size * 0.28, color }}>{score}%</span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color }}>{recoveryLabel(score)}</span>
    </div>
  )
}
