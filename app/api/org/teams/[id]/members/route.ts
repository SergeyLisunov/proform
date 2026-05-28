import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/org/teams/[id]/members
 * Body: { athlete_id }
 * RLS allows org_admin/org_owner of host org OR head_coach of group.
 *
 * DELETE /api/org/teams/[id]/members?athlete_id=...
 * Same authorization. Soft-delete not supported on M2M — direct delete.
 */

const AddSchema = z.object({ athlete_id: z.string().uuid() })

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let body: z.infer<typeof AddSchema>
  try {
    body = AddSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('org_group_members').insert({
    group_id:   params.id,
    athlete_id: body.athlete_id,
  })
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'ALREADY_MEMBER' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'INSERT_FAILED', details: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const url = new URL(req.url)
  const athleteId = url.searchParams.get('athlete_id')
  if (!athleteId) return NextResponse.json({ ok: false, error: 'athlete_id required' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { error } = await sb
    .from('org_group_members')
    .delete()
    .eq('group_id', params.id)
    .eq('athlete_id', athleteId)
  if (error) {
    return NextResponse.json({ ok: false, error: 'DELETE_FAILED', details: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
