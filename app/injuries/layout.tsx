import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// Травмы — статус и комментарии меняются по ходу реабилитации.
// Force-dynamic чтобы тренер/врач видели актуальное состояние.
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
