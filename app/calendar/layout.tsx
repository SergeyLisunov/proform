import AppShell from '@/components/layout/AppShell'

// Календарь — события постоянно создаются/переносятся, кэширование
// делает ленту устаревшей. Force-dynamic на сегменте.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
