import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex grow">
      <Sidebar />
      <div className="kt-wrapper flex grow flex-col">
        <TopBar />
        <main className="grow px-5 py-6 lg:px-8 lg:py-7 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
