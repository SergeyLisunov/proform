import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PostSchema = z.object({
  title:         z.string().trim().min(1).max(160),
  description:   z.string().trim().max(4000).optional().nullable(),
  metric:        z.enum(['duration_min', 'strain', 'workouts_count']),
  activity_type: z.string().trim().max(60).optional().nullable(),
  starts_at:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_at:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  org_id:        z.string().uuid().optional().nullable(),
})

export async function GET(req: Request) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const url    = new URL(req.url)
  const status = url.searchParams.get('status') // active | upcoming | finished | all
  const today  = new Date().toISOString().slice(0, 10)

  let q = sb
    .from('challenges')
    .select(`
      id, owner_id, org_id, title, description, metric, activity_type, starts_at, ends_at, created_at,
      owner:users!challenges_owner_id_fkey(id, name, nickname, avatar_url, role),
      org:organizations(id, org_name, logo_url)
    `)
    .order('starts_at', { ascending: false })

  if (status === 'active')   q = q.lte('starts_at', today).gte('ends_at', today)
  if (status === 'upcoming') q = q.gt('starts_at', today)
  if (status === 'finished') q = q.lt('ends_at', today)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, challenges: data ?? [] })
}

export async function POST(req: Request) {
  let body: z.infer<typeof PostSchema>
  try { body = PostSchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }) }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string; role: string | null }
  if (!['coach', 'organization', 'admin'].includes(meRow.role ?? '')) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  const { data, error } = await sb
    .from('challenges')
    .insert({
      owner_id:      meRow.id,
      org_id:        body.org_id ?? null,
      title:         body.title,
      description:   body.description ?? null,
      metric:        body.metric,
      activity_type: body.activity_type ?? null,
      starts_at:     body.starts_at,
      ends_at:       body.ends_at,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, challenge: data })
}
