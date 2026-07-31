import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

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
    <div className="flex grow w-full">
      <Sidebar />
      <div className="kt-wrapper flex grow flex-col w-full min-w-0">
        <TopBar />
        <main className="grow w-full min-w-0 px-5 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
