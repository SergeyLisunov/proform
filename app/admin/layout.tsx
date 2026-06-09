import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'

// Server-side admin role gate. Protects every page under /admin/** — without
// this, child pages were loading in the browser before a client-side
// `user.role !== 'admin'` check, exposing protected data via an open
// browser-side Supabase client. Now non-admins are redirected before any
// admin component renders.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    redirect('/auth/signin?redirect=/admin')
  }

  const { data: me } = await sb
    .from('users')
    .select('role')
    .eq('auth_id', auth.user.id)
    .maybeSingle()

  const role = (me as { role: string | null } | null)?.role ?? null
  if (role !== 'admin') {
    redirect('/dashboard')
  }

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
