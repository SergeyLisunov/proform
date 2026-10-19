import AppShell from '@/components/layout/AppShell'

// Дневник — данные часто меняются, отключаем CDN/ISR кэш сегмента
// чтобы пользователь сразу видел свежие записи и правки тренера.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
