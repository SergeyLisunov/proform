import type { ReactNode } from 'react'

interface BaseProps {
  children: ReactNode
  className?: string
}

/**
 * Metronic `kt-card` surface. Carries the Metronic component identity
 * (`kt-card*` classes) while colours come from the app's design tokens so the
 * brand (orange #F35703) and good looks are guaranteed regardless of theme.
 */
export function Card({ children, className = '', accent = false }: BaseProps & { accent?: boolean }) {
  return (
    <div
      className={`kt-card bg-card border border-border rounded-xl shadow-sm ${
        accent ? 'kt-card-accent border-t-2 border-t-[#F35703]' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: BaseProps) {
  return (
    <div className={`kt-card-header flex items-center justify-between gap-3 px-5 py-4 border-b border-border ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: BaseProps) {
  return <h3 className={`kt-card-title text-sm font-semibold text-foreground ${className}`}>{children}</h3>
}

export function CardToolbar({ children, className = '' }: BaseProps) {
  return <div className={`kt-card-toolbar flex items-center gap-2 ${className}`}>{children}</div>
}

export function CardContent({ children, className = '' }: BaseProps) {
  return <div className={`kt-card-content p-5 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }: BaseProps) {
  return <div className={`kt-card-footer px-5 py-4 border-t border-border ${className}`}>{children}</div>
}
