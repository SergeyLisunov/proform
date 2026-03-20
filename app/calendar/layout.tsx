import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F7F8' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 0 }} className="lg:ms-[232px]">
        <TopBar />
        <main style={{ flex: 1, padding: '24px' }}>{children}</main>
      </div>
    </div>
  )
}
