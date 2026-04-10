import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { WallPost, PostType, PostVisibility } from '@/types/org.types'

type WallPostInsert = Database['public']['Tables']['wall_posts']['Insert']
type WallPostUpdate = Database['public']['Tables']['wall_posts']['Update']

export async function getWallPosts(orgId: string): Promise<WallPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('wall_posts')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_deleted', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []) as WallPost[]
}

export async function getPublicWallPosts(orgId: string): Promise<WallPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('wall_posts')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_deleted', false)
    .eq('visible_to', 'all')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []) as WallPost[]
}

export async function createWallPost(post: {
  org_id: string
  author_id: string
  title: string
  body: string
  post_type: PostType
  event_date?: string | null
  visible_to: PostVisibility
}): Promise<WallPost | null> {
  const supabase = createClient()
  const payload: WallPostInsert = { ...post, event_date: post.event_date ?? null, is_pinned: false, is_deleted: false }
  const { data } = await (supabase.from('wall_posts') as any)
    .insert(payload)
    .select()
    .single()

  return data ?? null
}

export async function togglePin(postId: string, isPinned: boolean): Promise<void> {
  const supabase = createClient()
  const payload: WallPostUpdate = { is_pinned: isPinned }
  await (supabase.from('wall_posts') as any).update(payload).eq('id', postId)
}

export async function softDeletePost(postId: string): Promise<void> {
  const supabase = createClient()
  const payload: WallPostUpdate = { is_deleted: true }
  await (supabase.from('wall_posts') as any).update(payload).eq('id', postId)
}
