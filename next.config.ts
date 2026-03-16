import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Needed so ApexCharts (client-only) doesn't fail on SSR
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }]
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
