import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  title:         z.string().trim().min(1).max(160).optional(),
  description:   z.string().trim().max(4000).nullable().optional(),
  metric:        z.enum(['duration_min', 'strain', 'workouts_count']).optional(),
  activity_type: z.string().trim().max(60).nullable().optional(),
  starts_at:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ends_at:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: ch, error: chErr } = await sb
    .from('challenges')
    .select(`
      id, owner_id, org_id, title, description, metric, activity_type, starts_at, ends_at, created_at,
      owner:users!challenges_owner_id_fkey(id, name, nickname, avatar_url, role),
      org:organizations(id, org_name, logo_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (chErr) return NextResponse.json({ ok: false, error: chErr.message }, { status: 500 })
  if (!ch)   return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  const [{ data: participants }, { data: lb }, { data: me }] = await Promise.all([
    sb.from('challenge_participants').select('user_id, joined_at').eq('challenge_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).rpc('get_challenge_leaderboard', { p_challenge_id: id }),
    sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle(),
  ])

  const meId = (me as { id: string } | null)?.id ?? null
  const joined = !!(participants ?? []).find((p: { user_id: string }) => p.user_id === meId)

  return NextResponse.json({
    ok: true,
    challenge: ch,
    leaderboard: lb ?? [],
    participants_count: (participants ?? []).length,
    me: { id: meId, joined },
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: z.infer<typeof PatchSchema>
  try { body = PatchSchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }) }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await sb
    .from('challenges')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, challenge: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { error } = await sb.from('challenges').delete().eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
