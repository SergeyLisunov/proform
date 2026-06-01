/** @type {import('next').NextConfig} */
import bundleAnalyzer from '@next/bundle-analyzer'

// W17 Day 86 — bundle-analyzer wrapper.
// Enabled via `ANALYZE=true npm run build` (or `npm run analyze`).
// In normal builds / production deploys, ANALYZE is unset and analyzer
// adds zero overhead. Generates HTML reports в .next/analyze/ для review.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // W20 Day 4 — `eslint` config key removed: Next 16 no longer runs ESLint
  // during `next build` (use `next lint` / eslint CLI separately). Key is
  // now unrecognized. Lint runs via `npm run lint` — lint-debt cleanup pending.
  // W19 Day 1 — TS errors fixed (25 → 0 after type regen), build gates on tsc.
  typescript: { ignoreBuildErrors: false },
  // W20 Day 1 — `experimental.instrumentationHook` removed: Next 15 loads
  // instrumentation.ts by default (Sentry server/edge configs still boot).
  async redirects() {
    return [
      { source: '/search', destination: '/connections', permanent: false },
    ]
  },
  // W18 Day 94 I4 — security headers (CSP, HSTS, X-Frame-Options, etc).
  // Applied к ALL routes via wildcard. CSP intentionally permissive для
  // Next.js (script-src 'unsafe-inline' нужен для Next dev hydration +
  // 'unsafe-eval' для Webpack HMR). Production may tighten further.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // W21 audit fix (M5): the I4 comment promised a CSP but none was set.
          // Report-Only first — it never BLOCKS (zero risk of breaking the app),
          // just surfaces violations so the policy can be tightened to enforcing
          // later. Sources reflect actual usage: Supabase, Vercel Analytics/
          // Speed-Insights, Sentry, inline Next/Tailwind.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://vitals.vercel-insights.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
