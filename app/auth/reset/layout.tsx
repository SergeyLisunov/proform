/**
 * app/auth/reset/layout.tsx
 *
 * Server layout wrapper so /auth/reset (a `'use client'` page) can ship
 * route-specific metadata. The page itself handles the recovery token.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Новый пароль',
  description: 'Задайте новый пароль для аккаунта Sporteo.',
  alternates: { canonical: '/auth/reset' },
  robots: { index: false, follow: false },
}

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
