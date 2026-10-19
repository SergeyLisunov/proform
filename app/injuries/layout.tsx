import AppShell from '@/components/layout/AppShell'

// Травмы — статус и комментарии меняются по ходу реабилитации.
// Force-dynamic чтобы тренер/врач видели актуальное состояние.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
