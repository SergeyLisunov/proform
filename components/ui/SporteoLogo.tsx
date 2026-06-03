/* eslint-disable @next/next/no-img-element */
interface SporteoLogoProps {
  /** Visual size preset (logo height in px: sm 20 · md 28 · lg 40). */
  size?: 'sm' | 'md' | 'lg'
  /** Render just the orange "S" mark, no wordmark. */
  iconOnly?: boolean
  /** Dark background: orange mark + white wordmark (the navy PNG wordmark
   *  wouldn't read on dark). */
  onDark?: boolean
  className?: string
}

const HEIGHT = { sm: 20, md: 28, lg: 40 } as const
const LOGO_RATIO = 1422 / 472 // full lockup intrinsic w/h
const MARK_RATIO = 385 / 480  // S-mark intrinsic w/h

/**
 * Sporteo brand logo — uses the official assets:
 *   /sporteo-logo.png  full lockup (orange S + navy SPORTEO)
 *   /sporteo-mark.png  the orange S mark only
 * Both trimmed PNGs with transparency, so they sit on any background.
 */
export function SporteoLogo({ size = 'md', iconOnly = false, onDark = false, className = '' }: SporteoLogoProps) {
  const h = HEIGHT[size]
  const markW = Math.round(h * MARK_RATIO)

  if (iconOnly) {
    return (
      <img src="/sporteo-mark.png" alt="Sporteo" width={markW} height={h} className={`inline-block align-middle ${className}`} />
    )
  }

  if (onDark) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Sporteo">
        <img src="/sporteo-mark.png" alt="" width={markW} height={h} className="inline-block align-middle" />
        <span className="font-extrabold leading-none tracking-[0.05em] text-white" style={{ fontSize: Math.round(h * 0.66) }}>
          SPORTEO
        </span>
      </span>
    )
  }

  return (
    <img
      src="/sporteo-logo.png"
      alt="Sporteo"
      width={Math.round(h * LOGO_RATIO)}
      height={h}
      className={`inline-block align-middle ${className}`}
    />
  )
}

export default SporteoLogo
