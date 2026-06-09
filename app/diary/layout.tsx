import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// Дневник — данные часто меняются, отключаем CDN/ISR кэш сегмента
// чтобы пользователь сразу видел свежие записи и правки тренера.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
