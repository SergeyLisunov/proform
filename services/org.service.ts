import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { Organization, OrgMember, MemberStatus } from '@/types/org.types'

type UserRow = Database['public']['Tables']['users']['Row']
type OrgMemberInsert = Database['public']['Tables']['org_members']['Insert']
type OrgMemberUpdate = Database['public']['Tables']['org_members']['Update']
type OrgMemberRow = Database['public']['Tables']['org_members']['Row']
type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

export async function getMyOrg(): Promise<Organization | null> {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authData.user.id)
    .single()
  const userRecord = userData as Pick<UserRow, 'id'> | null

  if (!userRecord) return null

  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', userRecord.id)
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
  const userRecord = userData as Pick<UserRow, 'id'> | null

  if (!userRecord) return { error: 'Пользователь с таким email не найден' }

  const payload: OrgMemberInsert = { org_id: orgId, user_id: userRecord.id, role, status: 'pending' }
  const { error } = await (supabase.from('org_members') as any).insert(payload)

  return error ? { error: error.message } : {}
}

export async function updateMemberStatus(
  memberId: string,
  status: MemberStatus
): Promise<void> {
  const supabase = createClient()
  const payload: OrgMemberUpdate = { status }
  await (supabase.from('org_members') as any).update(payload).eq('id', memberId)
}

export async function getOrgStats(orgId: string) {
  const supabase = createClient()
  const { data: members } = await supabase
    .from('org_members')
    .select('role, status')
    .eq('org_id', orgId)
    .neq('status', 'suspended')
  const memberRows = (members ?? []) as Pick<OrgMemberRow, 'role' | 'status'>[]

  const total = memberRows.length
  const coaches = memberRows.filter((m) => m.role === 'coach').length
  const athletes = memberRows.filter((m) => m.role === 'athlete').length

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
  const payload: OrganizationUpdate = { is_verified: true }
  await (supabase.from('organizations') as any)
    .update(payload)
    .eq('id', orgId)
}
