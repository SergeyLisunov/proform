import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// Дашборд — персональный кабинет, всегда свежие данные. Force-dynamic
// отключает CDN/ISR на всём /dashboard сегменте, чтобы после
// нового деплоя пользователь сразу видел изменения, а не кэш Vercel
// edge. Сами компоненты рендерятся в браузере, серверная часть —
// только тонкий shell + auth/role routing.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex grow w-full">
      <Sidebar />
      <div className="kt-wrapper flex grow flex-col w-full min-w-0">
        <TopBar />
        <main className="grow w-full min-w-0 px-5 py-6 lg:px-8 lg:py-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
