/**
 * app/sitemap.ts — W15 Day 73.
 *
 * Public routes only. Auth-required surfaces (/admin, /dashboard, /coach,
 * /athlete, etc.) are intentionally excluded — they're disallowed по
 * robots.ts тоже, double protection.
 *
 * priority: 1.0 = landing, 0.8 = primary conversion paths, 0.5 = legal.
 * changeFrequency reflects realistic update cadence (weekly for marketing,
 * monthly for legal stubs).
 *
 * SITE_URL precedence: NEXT_PUBLIC_SITE_URL env → production fallback.
 */
import type { MetadataRoute } from 'next'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://proform-delta.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contacts`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/auth/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/auth/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // W16 Day 78 — lead-magnet tool pages. High-priority acquisition entry
    // points, surfaced на landing через `<LeadMagnetSection />`.
    {
      url: `${SITE_URL}/tools/team-risk`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/adaptive-plan`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/club-audit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/medical-summary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/acwr`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/tools/overtraining`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Legal stubs — `robots: { index: false }` на странице блокирует
    // индексацию, но оставляем в sitemap для прозрачности структуры.
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]
}
