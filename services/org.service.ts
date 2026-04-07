import { createClient } from '@/lib/supabase/client'
import type { Organization, OrgMember, MemberStatus } from '@/types/org.types'

export async function getMyOrg(): Promise<Organization | null> {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authData.user.id)
    .single()

  if (!userData) return null

  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', userData.id)
    .single()

  return (data ?? null) as Organization | null
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('org_slug', slug)
    .single()

  return (data ?? null) as Organization | null
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('org_members')
    .select('*, user:users(name, email)')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: false })

  return (data ?? []) as unknown as OrgMember[]
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: 'athlete' | 'coach'
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (!userData) return { error: 'Пользователь с таким email не найден' }

  const { error } = await supabase
    .from('org_members')
    .insert({ org_id: orgId, user_id: userData.id, role, status: 'pending' })

  return error ? { error: error.message } : {}
}

export async function updateMemberStatus(
  memberId: string,
  status: MemberStatus
): Promise<void> {
  const supabase = createClient()
  await supabase.from('org_members').update({ status }).eq('id', memberId)
}

export async function getOrgStats(orgId: string) {
  const supabase = createClient()
  const { data: members } = await supabase
    .from('org_members')
    .select('role, status')
    .eq('org_id', orgId)
    .neq('status', 'suspended')

  const total = members?.length ?? 0
  const coaches = members?.filter(m => m.role === 'coach').length ?? 0
  const athletes = members?.filter(m => m.role === 'athlete').length ?? 0

  return { total, coaches, athletes }
}

export async function getAllOrgs(): Promise<Organization[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  return (data ?? []) as Organization[]
}

export async function verifyOrg(orgId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('organizations')
    .update({ is_verified: true })
    .eq('id', orgId)
}
