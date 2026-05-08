/**
 * PATCH /api/org/teams/[id]   — update team fields
 * DELETE /api/org/teams/[id]  — soft-archive (sets is_active=false)
 *
 * Sprint W3 Day 17 (PR #32) — completes the team-detail drill-down.
 * Sibling endpoint to /api/org/teams/[id]/members which handles M2M
 * insert/delete on the org_group_members join table.
 *
 * RLS handles authorization:
 *   - org_admin / org_owner of the host org can update/archive any team
 *   - head_coach of the team can update their own team only
 *   - Anyone else gets a 403 from Postgres which we surface as 500
 *     unless RLS denies are reported at the query level — we trust the
 *     existing policies from migration 054.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'pro', 'recreational'])

const PatchSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  description:    z.string().max(2000).nullable().optional(),
  age_min:        z.number().int().min(3).max(120).nullable().optional(),
  age_max:        z.number().int().min(3).max(120).nullable().optional(),
  level:          SkillLevelSchema.nullable().optional(),
  head_coach_id:  z.string().uuid().nullable().optional(),
  color:          z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
}).refine(
  (data) => {
    if (typeof data.age_min === 'number' && typeof data.age_max === 'number') {
      return data.age_min <= data.age_max
    }
    return true
  },
  { message: 'age_min must be ≤ age_max', path: ['age_min'] },
)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY', details: (e as Error).message },
      { status: 400 },
    )
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ ok: false, error: 'EMPTY_PATCH' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Trim string fields. RLS policy enforces who can update.
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined)          patch.name          = body.name.trim()
  if (body.description !== undefined)   patch.description   = body.description?.trim() || null
  if (body.age_min !== undefined)       patch.age_min       = body.age_min
  if (body.age_max !== undefined)       patch.age_max       = body.age_max
  if (body.level !== undefined)         patch.level         = body.level
  if (body.head_coach_id !== undefined) patch.head_coach_id = body.head_coach_id
  if (body.color !== undefined)         patch.color         = body.color

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('org_groups')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    // 23505 = unique violation (name conflict per org)
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, error: 'NAME_CONFLICT', details: 'Команда с таким именем уже существует в организации' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { ok: false, error: 'UPDATE_FAILED', details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Soft-archive: preserve team in audit history.
  const { error } = await sb
    .from('org_groups')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'ARCHIVE_FAILED', details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
