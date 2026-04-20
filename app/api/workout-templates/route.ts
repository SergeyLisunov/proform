import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PostSchema = z.object({
  name:          z.string().trim().min(1).max(160),
  activity_type: z.string().trim().max(60).optional().nullable(),
  duration_min:  z.number().int().min(1).max(600).optional().nullable(),
  description:   z.string().trim().max(4000).optional().nullable(),
  segments:      z.any().optional().nullable(),
  is_public:     z.boolean().optional(),
})

export async function GET(req: Request) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string }

  const url = new URL(req.url)
  const scope = url.searchParams.get('scope') ?? 'all' // 'mine' | 'public' | 'all'
  let q = sb
    .from('workout_templates')
    .select(`
      id, user_id, name, activity_type, duration_min, description, segments, is_public, created_at, updated_at,
      author:users!workout_templates_user_id_fkey(id, name, nickname, avatar_url)
    `)
    .order('updated_at', { ascending: false })

  if (scope === 'mine')   q = q.eq('user_id', meRow.id)
  if (scope === 'public') q = q.eq('is_public', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, templates: data ?? [] })
}

export async function POST(req: Request) {
  let body: z.infer<typeof PostSchema>
  try { body = PostSchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }) }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string }

  const { data, error } = await sb
    .from('workout_templates')
    .insert({
      user_id:       meRow.id,
      name:          body.name,
      activity_type: body.activity_type ?? null,
      duration_min:  body.duration_min ?? null,
      description:   body.description ?? null,
      segments:      body.segments ?? null,
      is_public:     body.is_public ?? false,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, template: data })
}
