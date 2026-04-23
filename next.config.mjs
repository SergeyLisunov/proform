/** @type {import('next').NextConfig} */
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

export default nextConfig
