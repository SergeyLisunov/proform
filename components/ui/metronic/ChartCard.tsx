import type { ReactNode } from 'react'
import { Card } from './Card'

interface ChartCardProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned controls (filters, legend toggles, range pills). */
  toolbar?: ReactNode
  children: ReactNode
  className?: string
  accent?: boolean
}

/**
 * A Metronic `kt-card` purpose-built to host an ApexChart — title + subtitle +
 * optional toolbar header, then the chart body. Use across dashboards/analytics
 * to give every chart a consistent, branded frame.
 */
export function ChartCard({ title, subtitle, toolbar, children, className = '', accent = false }: ChartCardProps) {
  return (
    <Card accent={accent} className={className}>
      <div className="kt-card-header flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="kt-card-title pf-num text-base leading-tight text-navy-500">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {toolbar && <div className="kt-card-toolbar flex shrink-0 items-center gap-2">{toolbar}</div>}
      </div>
      <div className="px-3 pb-3 pt-2">{children}</div>
    </Card>
  )
}
