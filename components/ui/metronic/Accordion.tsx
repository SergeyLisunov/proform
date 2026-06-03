'use client'

import { useState, type ReactNode } from 'react'

export interface AccordionItem {
  id: string
  title: ReactNode
  content: ReactNode
  /** Optional KeenIcon name, e.g. "ki-shield-tick" */
  icon?: string
}

interface AccordionProps {
  items: AccordionItem[]
  defaultOpenIds?: string[]
  /** Allow more than one panel open at once (default: single-open). */
  allowMultiple?: boolean
  className?: string
}

/**
 * Metronic `kt-accordion`, driven by React state (not Metronic's
 * `core.bundle.js`, which only scans the DOM once `afterInteractive` and breaks
 * on re-render). Smooth open/close via the grid-rows 1fr→0fr technique.
 */
export function Accordion({ items, defaultOpenIds = [], allowMultiple = false, className = '' }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(defaultOpenIds))

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(allowMultiple ? prev : [])
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={`kt-accordion flex flex-col gap-2.5 ${className}`}>
      {items.map(item => {
        const isOpen = openIds.has(item.id)
        return (
          <div
            key={item.id}
            data-kt-accordion-item={item.id}
            className={`kt-accordion-item bg-card border rounded-xl overflow-hidden transition-colors ${
              isOpen ? 'active border-[#F35703]/40' : 'border-border'
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="kt-accordion-toggle flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-muted/40 transition-colors"
            >
              {item.icon && <i className={`ki-filled ${item.icon} text-base text-[#F35703]`} aria-hidden />}
              <span className="kt-accordion-title flex-1 text-sm font-semibold text-foreground">{item.title}</span>
              <i
                className={`ki-filled ki-down kt-accordion-indicator text-xs text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            <div
              className={`kt-accordion-content grid transition-all duration-200 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
