/**
 * Next.js instrumentation hook. Loads the right Sentry init at runtime
 * boot depending on whether we're in Node.js (API routes, RSC) or the
 * edge runtime (middleware, edge routes).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(
  ...args: Parameters<NonNullable<Awaited<typeof import('@sentry/nextjs')>['captureRequestError']>>
) {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
