import type { ReactNode } from 'react'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  /** Leading status dot. */
  dot?: boolean
  className?: string
}

const VARIANT_TW: Record<BadgeVariant, string> = {
  primary:     'bg-[#FEF0E7] text-[#D44A02]',
  secondary:   'bg-slate-100 text-slate-600',
  success:     'bg-green-50 text-green-700',
  warning:     'bg-amber-50 text-amber-700',
  destructive: 'bg-red-50 text-red-600',
  info:        'bg-blue-50 text-blue-600',
}

const DOT_TW: Record<BadgeVariant, string> = {
  primary: 'bg-[#F35703]', secondary: 'bg-slate-400', success: 'bg-green-500',
  warning: 'bg-amber-500', destructive: 'bg-red-500', info: 'bg-blue-500',
}

const SIZE_TW: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
}

/** Metronic `kt-badge` (identity) with brand-safe Tailwind colours. */
export function Badge({ children, variant = 'secondary', size = 'md', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`kt-badge kt-badge-${variant} inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap ${VARIANT_TW[variant]} ${SIZE_TW[size]} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${DOT_TW[variant]}`} aria-hidden />}
      {children}
    </span>
  )
}
