/**
 * Sentry server-side initialisation.
 * Loaded by instrumentation.ts when NODE runtime boots.
 * Safe no-op when SENTRY_DSN is unset.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Don't capture Next.js "not-found" / redirect control-flow errors.
    ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT'],
  })
}
