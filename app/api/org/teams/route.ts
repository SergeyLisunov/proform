import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/org/teams — create org_group.
 *
 * Auth: organization role + active org_admin/org_owner membership in
 * target org. RLS enforces (handled at DB).
 */
const CreateSchema = z.object({
  organization_id: z.string().uuid(),
  name:            z.string().min(1).max(100),
  description:     z.string().max(2000).optional().nullable(),
  age_min:         z.number().int().min(3).max(120).optional().nullable(),
  age_max:         z.number().int().min(3).max(120).optional().nullable(),
  level:           z.enum(['beginner','intermediate','advanced','pro','recreational']).optional().nullable(),
  head_coach_id:   z.string().uuid().optional().nullable(),
  color:           z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
})

export async function POST(req: Request) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  // Logical invariant: age_min <= age_max
  if (typeof body.age_min === 'number' && typeof body.age_max === 'number' && body.age_min > body.age_max) {
    return NextResponse.json({ ok: false, error: 'AGE_RANGE_INVALID' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('org_groups')
    .insert({
      organization_id: body.organization_id,
      name:            body.name.trim(),
      description:     body.description?.trim() || null,
      age_min:         body.age_min ?? null,
      age_max:         body.age_max ?? null,
      level:           body.level ?? null,
      head_coach_id:   body.head_coach_id ?? null,
      color:           body.color ?? null,
      is_active:       true,
    })
    .select()
    .single()
  if (error) {
    return NextResponse.json({ ok: false, error: 'INSERT_FAILED', details: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data })
}
