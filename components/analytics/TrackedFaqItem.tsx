/**
 * <TrackedFaqItem /> — W15 Day 76.
 *
 * Client wrapper над native `<details>` что fires `landing.faq_open`
 * event когда user expand'ит item (НЕ когда collapse'ит — мы измеряем
 * curiosity, не churn).
 *
 * Visual styling и summary content передаются через children — компонент
 * не knows о content, только о tracking.
 */
'use client'

import type { ReactNode, SyntheticEvent } from 'react'
import { trackEvent } from '@/lib/analytics/track'

interface TrackedFaqItemProps {
  /** Question text, идёт в event props для dashboard analysis. */
  question:   string
  className?: string
  children:   ReactNode
}

export default function TrackedFaqItem({
  question,
  className,
  children,
}: TrackedFaqItemProps) {
  function handleToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    // open=true ⇒ expand; open=false ⇒ collapse. Only track expand.
    if (e.currentTarget.open) {
      trackEvent({ name: 'landing.faq_open', question })
    }
  }

  return (
    <details className={className} onToggle={handleToggle}>
      {children}
    </details>
  )
}
