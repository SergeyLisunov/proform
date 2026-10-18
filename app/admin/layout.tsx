import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
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
    <AppShell>{children}</AppShell>
  )
}
