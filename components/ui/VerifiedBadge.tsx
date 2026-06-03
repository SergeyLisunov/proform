/**
 * <VerifiedBadge /> — Sprint W9 Day 45.
 *
 * Consistent visual marker shown next to a coach's name across
 * profile/marketplace/passes. Admin-issued via /admin → Verification tab.
 *
 * Three size presets:
 *   - 'sm' — inline icon-only (marketplace cards, list rows)
 *   - 'md' — icon + «Verified» text (profile header)
 *   - 'lg' — full chip with icon + text (hero blocks)
 *
 * Tooltip explains the meaning. No interactivity — display-only.
 */
import type { CSSProperties } from 'react'

interface VerifiedBadgeProps {
  size?:     'sm' | 'md' | 'lg'
  tooltip?:  string
  className?: string
  style?:    CSSProperties
}

const DEFAULT_TOOLTIP = 'Verified — личность и квалификация подтверждены администратором Sporteo'

export default function VerifiedBadge({ size = 'sm', tooltip, className, style }: VerifiedBadgeProps) {
  const title = tooltip ?? DEFAULT_TOOLTIP
  if (size === 'sm') {
    return (
      <span
        title={title}
        aria-label="Verified"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: 99,
          background: '#2563EB',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          flexShrink: 0,
          ...style,
        }}
      >
        <i className="ki-filled ki-verify text-[10px]" />
      </span>
    )
  }
  if (size === 'lg') {
    return (
      <span
        title={title}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 99,
          background: '#EFF6FF',
          color: '#1D4ED8',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          border: '1px solid #BFDBFE',
          ...style,
        }}
      >
        <i className="ki-filled ki-verify text-xs" />
        Verified
      </span>
    )
  }
  // md
  return (
    <span
      title={title}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        background: '#EFF6FF',
        color: '#1D4ED8',
        fontSize: 10,
        fontWeight: 700,
        border: '1px solid #BFDBFE',
        ...style,
      }}
    >
      <i className="ki-filled ki-verify text-[11px]" />
      Verified
    </span>
  )
}
