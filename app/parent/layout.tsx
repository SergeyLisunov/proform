import AppShell from '@/components/layout/AppShell'

// /parent — кабинет родителя / опекуна. Видят пользователи, у которых есть
// хотя бы одна активная запись parent_links (параметр parent_id = me).
// Роль 'parent' глобально НЕ существует — это relationship, не role.
// Force-dynamic, чтобы свежие данные сразу после деплоя (как на /dashboard).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
