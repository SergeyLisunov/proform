import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Montserrat } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { ToastProvider } from '@/lib/hooks/useToast'
import { MobileMenuProvider } from '@/lib/hooks/useMobileMenu'
import ClientOverlays from '@/components/ui/ClientOverlays'

// Единое семейство — Montserrat (founder decision, 2026-06-08).
// Заменяет прежнюю пару Bebas Neue (display) + DM Sans (body). Причины:
//   - Гармонизация: один шрифт на весь сайт, единая типографика.
//   - Montserrat имеет ПОЛНЫЙ Cyrillic subset на Google Fonts — русский
//     текст теперь рендерится в том же шрифте, что и латиница (раньше
//     падал в Trebuchet MS / Impact fallback, см. старый комментарий).
//   - next/font self-hosts + preload + font-display:swap + size-adjust
//     fallback (без layout shift) — те же преимущества, что и раньше.
//
// Одна next/font инстанция экспортирует ОДНУ CSS-переменную (--font-pf-sans).
// Историческая переменная --font-pf-display сохранена в globals.css и теперь
// резолвится в тот же Montserrat — заголовки получают вес 700/800 через
// .pf-heading-* утилиты, сохраняя визуальную иерархию без второго шрифта.
const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-pf-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
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
      className={`${montserrat.variable} h-full light`}
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
