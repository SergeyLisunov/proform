interface SporteoLogoProps {
  /** Visual size preset. */
  size?: 'sm' | 'md' | 'lg'
  /** Render just the orange "S" mark, no wordmark. */
  iconOnly?: boolean
  /** Render the wordmark in white (for dark/navy backgrounds). */
  onDark?: boolean
  className?: string
}

const SIZES = {
  sm: { box: 'w-6 h-7 rounded-md text-base', word: 'text-base', gap: 'gap-2' },
  md: { box: 'w-8 h-10 rounded-lg text-xl', word: 'text-xl', gap: 'gap-2.5' },
  lg: { box: 'w-11 h-14 rounded-xl text-3xl', word: 'text-3xl', gap: 'gap-3' },
} as const

/**
 * Sporteo brand logo — orange rounded "S" mark + navy "SPORTEO" wordmark.
 * Brand palette: orange #F35703, navy #1D4672 (sampled from the brand deck).
 * CSS/token-based so it scales crisply and inherits the app fonts. Swap in an
 * exact SVG asset later if desired (drop it into public/ and point here).
 */
export function SporteoLogo({ size = 'md', iconOnly = false, onDark = false, className = '' }: SporteoLogoProps) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`} aria-label="Sporteo">
      <span
        className={`${s.box} grid place-items-center bg-[#F35703] font-extrabold leading-none text-[#FBF3EC] select-none`}
        style={{ fontFamily: 'var(--pf-font-sans)' }}
        aria-hidden
      >
        S
      </span>
      {!iconOnly && (
        <span
          className={`${s.word} font-extrabold leading-none tracking-[0.04em] ${onDark ? 'text-white' : 'text-[#1D4672]'}`}
        >
          SPORTEO
        </span>
      )}
    </span>
  )
}

export default SporteoLogo
