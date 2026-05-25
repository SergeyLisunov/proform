/**
 * app/robots.ts — W15 Day 73.
 *
 * Allow public marketing surfaces; explicitly disallow auth-required and
 * API routes from being crawled / indexed. Sitemap pointer included so
 * Googlebot finds the canonical list of public URLs.
 *
 * Rationale per disallow group:
 *   - /api/*        — server endpoints, never useful to crawlers
 *   - /admin/*      — admin surface, sensitive
 *   - role-scoped   — /dashboard, /coach, /athlete[s], /org, /doctor — all
 *                     require auth и contain personal data
 *   - personal      — /profile, /settings, /messages, /notifications, /diary
 *   - workflow      — /onboarding, /invite, /quick, /share/* — token-scoped
 *                     or post-auth flows
 *   - tools / data  — /tools/*, /analytics, /insights, /load, /streaks,
 *                     /records, /injuries, /cycles, /challenges, /calendar,
 *                     /competitions, /directory, /form-analysis, /templates,
 *                     /notes, /connections, /network, /search, /marketplace
 *   - dynamic       — /p/[nickname], /[orgSlug] — public-by-design но
 *                     индексировать только когда content stable. В W15+
 *                     можно whitelist'ить через separate sitemap entries.
 */
import type { MetadataRoute } from 'next'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://proform-delta.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/contacts',
          '/auth/login',
          '/auth/register',
          '/pricing',
          '/legal/',
          // W16 Day 78 — lead-magnet tools are public acquisition entry points.
          // Removed from disallow list (was blocking indexable lead magnets).
          '/tools/',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard',
          '/coach/',
          '/athlete/',
          '/athletes',
          '/org/',
          '/doctor/',
          '/profile/',
          '/settings',
          '/messages',
          '/notifications',
          '/diary',
          '/onboarding',
          '/invite',
          '/quick',
          '/share/',
          '/analytics',
          '/insights',
          '/load',
          '/streaks',
          '/records',
          '/injuries',
          '/cycles',
          '/challenges',
          '/calendar',
          '/competitions',
          '/directory',
          '/form-analysis',
          '/templates',
          '/notes',
          '/connections',
          '/network',
          '/search',
          '/marketplace',
          '/p/',
          '/ai/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
