/**
 * app/pricing/layout.tsx — W15 Day 73.
 *
 * Server layout wrapper so /pricing (client component) can ship
 * route-specific metadata. DB-driven tariff content remains в page.tsx.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Тарифы — простые и честные цены',
  description:
    'Тарифы ProForm: бесплатный старт, trial-период на платных планах, отмена в любой момент. Планы для атлетов, тренеров, специалистов и клубов.',
  keywords: [
    'тарифы ProForm',
    'цены спортивная платформа',
    'подписка тренеров',
    'тариф клуб',
    'pro athlete тариф',
  ],
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Тарифы ProForm — простые и честные цены',
    description:
      'Free start. Trial period на платных тарифах. Планы для 4 ролей: athlete, coach, specialist, organization.',
    url: '/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
