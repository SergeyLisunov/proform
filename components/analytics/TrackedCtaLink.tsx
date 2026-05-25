/**
 * <TrackedCtaLink /> — W15 Day 76.
 *
 * Client-side wrapper над next/link что emit'ит typed analytics event
 * на click. Используется для primary CTAs на public surfaces (hero,
 * sticky nav, final CTA).
 *
 * Server components могут импортировать это — Next.js auto-handles
 * server/client boundary.
 *
 * Дизайнерское решение: separate component вместо onClick directly
 * на Link — keeps tracking concern isolated, легче audit'ить.
 */
'use client'

import Link from 'next/link'
import type { LandingEvent } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/track'

interface TrackedCtaLinkProps {
  href:       string
  event:      LandingEvent
  className?: string
  ariaLabel?: string
  children:   React.ReactNode
}

export default function TrackedCtaLink({
  href,
  event,
  className,
  ariaLabel,
  children,
}: TrackedCtaLinkProps) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent(event)}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}
