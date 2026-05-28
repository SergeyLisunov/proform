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
  eslint: { ignoreDuringBuilds: true },
  // W19 Day 1 — TS errors fixed (25 → 0 after type regen), build now gates
  // on tsc. Stale generated types (migrations 071/072/074) were masking real
  // column/table mismatches. ESLint flag still on — lint-debt cleanup pending.
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
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
