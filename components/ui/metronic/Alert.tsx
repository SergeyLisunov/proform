import type { ReactNode } from 'react'

export type AlertVariant = 'primary' | 'success' | 'warning' | 'destructive' | 'info'

interface AlertProps {
  children: ReactNode
  variant?: AlertVariant
  title?: ReactNode
  /** Override the default KeenIcon for the variant. */
  icon?: string
  className?: string
}

const VARIANT: Record<AlertVariant, { wrap: string; icon: string; defaultIcon: string }> = {
  primary:     { wrap: 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]', icon: 'text-[#F35703]', defaultIcon: 'ki-information-2' },
  success:     { wrap: 'bg-green-50 border-green-200 text-green-800', icon: 'text-green-600', defaultIcon: 'ki-check-circle' },
  warning:     { wrap: 'bg-amber-50 border-amber-200 text-amber-800', icon: 'text-amber-600', defaultIcon: 'ki-information-5' },
  destructive: { wrap: 'bg-red-50 border-red-200 text-red-800', icon: 'text-red-600', defaultIcon: 'ki-cross-circle' },
  info:        { wrap: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'text-blue-600', defaultIcon: 'ki-information-4' },
}

/** Metronic `kt-alert` (identity) with brand-safe Tailwind colours. */
export function Alert({ children, variant = 'info', title, icon, className = '' }: AlertProps) {
  const v = VARIANT[variant]
  return (
    <div className={`kt-alert kt-alert-${variant} flex items-start gap-3 rounded-xl border px-4 py-3 ${v.wrap} ${className}`} role="alert">
      <i className={`ki-filled ${icon ?? v.defaultIcon} kt-alert-icon mt-0.5 text-base ${v.icon}`} aria-hidden />
      <div className="kt-alert-content min-w-0 flex-1">
        {title && <p className="kt-alert-title text-sm font-semibold">{title}</p>}
        <div className="kt-alert-description text-xs leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  )
}
