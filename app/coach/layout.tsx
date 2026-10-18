import AppShell from '@/components/layout/AppShell'

/**
 * Оболочка кабинета тренера.
 *
 * Причина та же, что и у app/athlete/layout.tsx: сегмент app/coach/ жил без
 * layout.tsx, поэтому /coach/plans, /coach/services, /coach/passes,
 * /coach/inquiries и /coach/pass-plans открывались без сайдбара и верхней
 * панели, а на мобильном — ещё и без нижней навигации.
 *
 * /coach/plans — единственный рабочий путь назначения тренировок, и он же
 * добавлен в меню; вести из меню на экран без меню нельзя.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
