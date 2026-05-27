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
  typescript: { ignoreBuildErrors: true },
  // Next 14.2 still gates instrumentation.ts behind this flag.
  // Needed so Sentry server/edge configs load at boot.
  experimental: {
    instrumentationHook: true,
  },
  async redirects() {
    return [
      { source: '/search', destination: '/connections', permanent: false },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
