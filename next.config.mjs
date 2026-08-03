/** @type {import('next').NextConfig} */
import bundleAnalyzer from '@next/bundle-analyzer'
import createNextIntlPlugin from 'next-intl/plugin'

// i18n (Этап 0) — next-intl без URL-роутинга, локаль из cookie.
// Конфиг запроса: i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// W17 Day 86 — bundle-analyzer wrapper.
// Enabled via `ANALYZE=true npm run build` (or `npm run analyze`).
// In normal builds / production deploys, ANALYZE is unset and analyzer
// adds zero overhead. Generates HTML reports в .next/analyze/ для review.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  // Локальная разработка: Next 16 по умолчанию блокирует запросы к
  // dev-ресурсам (/_next/webpack-hmr, /__nextjs_original-stack-frames) с
  // origin, который считает чужим, — а обращение по 127.0.0.1 таковым и
  // является, даже когда сервер слушает на этой же машине.
  //
  // Симптом выглядел как дефект приложения: страница отдаётся, значения
  // попадают в DOM, но React не гидрируется — кнопка входа остаётся
  // disabled, и локально нельзя ни войти, ни прогнать E2E. Диагноз в
  // qa/ralph/DECISIONS.md D-02 списывал это на флаг `--webpack`; проверка
  // с turbopack показала ту же картину и вывела на настоящую причину —
  // в логе dev-сервера прямо сказано, какой origin заблокирован.
  //
  // На сборку и прод не влияет: ключ читается только в dev-режиме.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // P2 — Hostiman deploy pack: standalone-сервер для self-hosted VPS
  // (.next/standalone/server.js под PM2 + nginx). На Vercel ключ
  // безвреден — их билдер использует собственный output. См.
  // docs/deploy/HOSTIMAN.md.
  output: 'standalone',
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

export default withNextIntl(withBundleAnalyzer(nextConfig))
