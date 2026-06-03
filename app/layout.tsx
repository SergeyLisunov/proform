import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Bebas_Neue, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { ToastProvider } from '@/lib/hooks/useToast'
import { MobileMenuProvider } from '@/lib/hooks/useMobileMenu'
import ClientOverlays from '@/components/ui/ClientOverlays'

// W17 Day 84 — next/font migration.
// Previously loaded через Metronic CSS bundle (/assets/css/styles.css) —
// render-blocking + impacted LCP на Hero. next/font:
//   - Self-hosts font files (no external network round-trip)
//   - Automatic preload of critical weights
//   - font-display: swap (text visible с fallback пока font loads)
//   - Size-adjust generated fallback fonts (eliminate layout shift)
//
// Subset choice — neither DM Sans nor Bebas Neue have Cyrillic subsets
// on Google Fonts. We subset к latin + latin-ext (DM Sans) and latin only
// (Bebas Neue). Russian text falls к manual fallback chain (Trebuchet MS,
// Segoe UI, system-ui for body; Impact, Arial Narrow Bold for display) —
// same behavior as pre-migration Metronic CSS load. См. globals.css.
//
// W17+ candidate: evaluate switching body font к Inter / Manrope / Noto Sans
// (full Cyrillic Google subset) если consistent Latin/Cyrillic typography
// becomes priority. Day 84 = minimal-change migration, preserves visual
// parity для Russian content.
const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-pf-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-pf-display',
  weight: '400',
  display: 'swap',
})

// W15 Day 73 — SEO foundation.
// Single source of truth for metadataBase. Override per-route via layout/page
// metadata. Public surfaces inherit; auth-required surfaces still ship meta
// but are disallowed by robots.ts.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://proform-delta.vercel.app'

const SITE_TITLE = 'Sporteo — спортивная платформа для клубов, академий и команд'
const SITE_DESCRIPTION =
  'Sporteo — цифровая платформа управления спортивной подготовкой. Тренер, спортсмен, врач и руководитель клуба вокруг единой карточки спортсмена: дневник тренировок, импорт с носимых устройств, предиктивная аналитика нагрузки (ACWR) и риска травм.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · Sporteo',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Sporteo',
  generator: 'Next.js',
  keywords: [
    'спортивная платформа',
    'тренировки клуб',
    'дневник тренировок',
    'тренер атлет врач',
    'академия плавания',
    'performance-центр',
    'клуб ватерполо',
    'club management',
  ],
  authors: [{ name: 'Sporteo' }],
  creator: 'Sporteo',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE_URL,
    siteName: 'Sporteo',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#F35703',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${dmSans.variable} ${bebasNeue.variable} h-full light`}
      data-kt-theme="true"
      data-kt-theme-mode="light"
    >
      {/* W18 Day 92 CRITICAL BUG FIX:
          Removed `flex h-full` from body className. Metronic template assumes
          flex-row dashboard layout, что превращало landing main + SiteFooter
          в side-by-side columns на desktop — footer рендерился справа от
          контента, content squashed в narrow centered column.
          Default block layout = main + footer stack vertically correctly.
          Dashboard pages handle their own sidebar layout internally (Metronic
          kt-sidebar-* классы продолжают работать как CSS hooks). */}
      <body className="antialiased text-base text-foreground bg-background demo1 kt-sidebar-fixed kt-header-fixed">
        <ToastProvider>
          <MobileMenuProvider>
            {children}
            <ClientOverlays />
          </MobileMenuProvider>
        </ToastProvider>
        <Script src="/assets/js/core.bundle.js" strategy="afterInteractive" />
        {/* W15 Day 76 — Vercel Analytics + Speed Insights.
            SDK auto-disables в development; both products GDPR-aligned
            (cookieless, no PII). Per-event taxonomy: lib/analytics/track.ts */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
