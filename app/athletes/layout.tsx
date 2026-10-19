import AppShell from '@/components/layout/AppShell'

// /athletes/* (включая /athletes/load и /athletes/[id]) — данные тренеру
// нужны актуальные, отключаем edge cache.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
