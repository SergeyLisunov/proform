import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex grow w-full">
      <Sidebar />
      {/* Main content shifted by sidebar width on desktop */}
      <div className="flex flex-col flex-1 min-w-0 lg:ms-[240px]">
        <TopBar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
