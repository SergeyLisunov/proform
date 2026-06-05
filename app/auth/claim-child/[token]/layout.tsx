import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Привязка аккаунта — Sporteo',
  description: 'Задайте свой email и пароль для аккаунта в Sporteo.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
