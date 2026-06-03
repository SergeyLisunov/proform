/**
 * app/auth/forgot/layout.tsx
 *
 * Server layout wrapper so /auth/forgot (a `'use client'` page) can ship
 * route-specific metadata. App Router rule: client components cannot export
 * `metadata`, but a parent server layout can.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Восстановление пароля',
  description: 'Сбросьте пароль от аккаунта Sporteo — пришлём ссылку на вашу почту.',
  alternates: { canonical: '/auth/forgot' },
  robots: { index: false, follow: false },
}

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
