/**
 * Sentry client-side initialisation.
 * Safe no-op when NEXT_PUBLIC_SENTRY_DSN is unset — the SDK is imported
 * but init() is skipped, so bundles stay small and no network calls fire.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      // Drop noisy ResizeObserver / ChunkLoadError events.
      const msg = event.exception?.values?.[0]?.value ?? event.message ?? ''
      if (/ResizeObserver loop|ChunkLoadError|Loading chunk/i.test(msg)) return null
      return event
    },
  })
}
