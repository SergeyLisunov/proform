import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Регистрация родителя — Sporteo',
  description: 'Зарегистрируйтесь как родитель и подключите ребёнка-спортсмена в Sporteo.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
