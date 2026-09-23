'use client'

import { useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

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
 * Аккордеон на классах `kt-accordion`, управляемый состоянием React.
 *
 * Скрипт Metronic сканировал DOM один раз после гидратации и ломался на
 * перерисовке, поэтому раскрытие с самого начала держалось на useState. В
 * сентябре 2026 скрипт удалён из проекта — здесь не изменилось ничего, и это
 * как раз показывает, что он был не нужен. Плавное открытие — приёмом
 * grid-rows 1fr→0fr.
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
              {item.icon && <Icon name={item.icon} className="text-base text-[#F35703]" />}
              <span className="kt-accordion-title flex-1 text-sm font-semibold text-foreground">{item.title}</span>
              <Icon
                name="ki-down"
                className={`kt-accordion-indicator text-xs text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
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
