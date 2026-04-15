import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex grow w-full">
      <Sidebar />
      <div className="kt-wrapper flex grow flex-col w-full min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex flex-col grow w-full min-w-0 overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
