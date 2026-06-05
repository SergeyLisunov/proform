import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// /parent — кабинет родителя / опекуна. Видят пользователи, у которых есть
// хотя бы одна активная запись parent_links (параметр parent_id = me).
// Роль 'parent' глобально НЕ существует — это relationship, не role.
// Force-dynamic, чтобы свежие данные сразу после деплоя (как на /dashboard).
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
