import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { WallPost, PostType, PostVisibility } from '@/types/org.types'

type WallPostInsert = Database['public']['Tables']['wall_posts']['Insert']
type WallPostUpdate = Database['public']['Tables']['wall_posts']['Update']
type WallPostRow    = Database['public']['Tables']['wall_posts']['Row']

// ─── visible_to translation ───────────────────────────────────────────────
// DB column is text[] (default ['athlete','coach','public']). The API
// surface expects a single PostVisibility value. Map both directions.

function toVisibilityArray(v: PostVisibility): string[] {
  switch (v) {
    case 'all':     return ['athlete', 'coach', 'public']
    case 'members': return ['athlete', 'coach']
    case 'coaches': return ['coach']
  }
}

function fromVisibilityArray(arr: string[] | null): PostVisibility {
  if (!arr || arr.length === 0) return 'coaches'
  if (arr.includes('public'))   return 'all'
  if (arr.includes('athlete'))  return 'members'
  return 'coaches'
}

function rowToPost(row: WallPostRow): WallPost {
  return {
    id:         row.id,
    org_id:     row.org_id,
    author_id:  row.author_id,
    title:      row.title,
    body:       row.body,
    post_type:  row.post_type as PostType,
    event_date: row.event_date,
    visible_to: fromVisibilityArray(row.visible_to),
    is_pinned:  row.is_pinned ?? false,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
  }
}

// ─── reads ─────────────────────────────────────────────────────────────────

export async function getWallPosts(orgId: string): Promise<WallPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('wall_posts')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return ((data ?? []) as WallPostRow[]).map(rowToPost)
}

export async function getPublicWallPosts(orgId: string): Promise<WallPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('wall_posts')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .contains('visible_to', ['public'])
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return ((data ?? []) as WallPostRow[]).map(rowToPost)
}

// ─── writes ────────────────────────────────────────────────────────────────

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
  const payload: WallPostInsert = {
    org_id:     post.org_id,
    author_id:  post.author_id,
    title:      post.title,
    body:       post.body,
    post_type:  post.post_type,
    event_date: post.event_date ?? null,
    visible_to: toVisibilityArray(post.visible_to),
    is_pinned:  false,
    // deleted_at intentionally omitted — soft-delete sentinel set later.
  }
  const { data, error } = await supabase
    .from('wall_posts')
    .insert(payload)
    .select()
    .single()

  if (error || !data) return null
  return rowToPost(data as WallPostRow)
}

/**
 * Возвращает true, только если строка действительно изменена.
 *
 * Раньше функция возвращала void и глотала результат. Под RLS это опаснее
 * обычного: UPDATE, не нашедший ни одной доступной строки, не считается
 * ошибкой — supabase-js отдаёт error = null, и вызывающий код показывал
 * «Готово», хотя не изменилось ничего. Ровно на этом обжигались раньше
 * (см. комментарий к softDeletePost ниже), поэтому здесь и далее судим по
 * фактически затронутым строкам, а не по отсутствию ошибки.
 */
export async function togglePin(postId: string, isPinned: boolean): Promise<boolean> {
  const supabase = createClient()
  const payload: WallPostUpdate = { is_pinned: isPinned }
  const { data, error } = await supabase
    .from('wall_posts').update(payload).eq('id', postId).select('id')
  if (error) {
    console.warn('[wall.togglePin]', error.message)
    return false
  }
  return (data ?? []).length > 0
}

// Soft delete: set deleted_at to now(). Read paths filter on
// `deleted_at IS NULL`. The previous implementation set a non-existent
// `is_deleted` column — every soft delete silently failed.
export async function softDeletePost(postId: string): Promise<boolean> {
  const supabase = createClient()
  const payload: WallPostUpdate = { deleted_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('wall_posts').update(payload).eq('id', postId).select('id')
  if (error) {
    console.warn('[wall.softDeletePost]', error.message)
    return false
  }
  return (data ?? []).length > 0
}
