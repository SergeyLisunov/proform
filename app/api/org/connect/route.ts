/**
 * POST /api/org/connect — tenant refactor #3 (on-behalf edge creation).
 *
 * Lets an organization owner link two of its OWN members: a coach↔athlete or
 * doctor↔athlete connection. Creating the connection (active) lets the existing
 * migration-085 trigger project it into `trainer_athletes`, which is what grants
 * the coach/doctor access to that athlete's data.
 *
 * Security rule (validated in code with the admin client AFTER auth, rather than
 * via a gnarly RLS write policy):
 *   - caller must be role='organization' (their user.id == org_id; 1 owner = 1
 *     org model). admins are rejected — they don't own an org.
 *   - BOTH parties must be `active` members of the caller's org (org_members).
 *   - global roles must match: athlete is role='athlete'; provider is role='coach'
 *     (for coach_athlete) or role='doctor' (for doctor_athlete).
 *
 * Idempotent: an existing connection (either direction, same type) is reactivated
 * rather than duplicated.
 *
 * Body: { athlete_id: uuid, provider_id: uuid, provider_kind: 'coach' | 'doctor' }
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  athlete_id:    z.string().uuid(),
  provider_id:   z.string().uuid(),
  provider_kind: z.enum(['coach', 'doctor']),
})

export async function POST(req: Request) {
  // ── Auth: caller must be an organization owner ──────────────────────────
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  if ((me as { role: string }).role !== 'organization') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const orgId = (me as { id: string }).id

  // ── Validate body ───────────────────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  const { athlete_id, provider_id, provider_kind } = body
  if (athlete_id === provider_id) {
    return NextResponse.json({ ok: false, error: 'same_user' }, { status: 422 })
  }

  const connectionType = provider_kind === 'coach' ? 'coach_athlete' : 'doctor_athlete'
  const admin = createAdminClient()

  // ── Both parties must be ACTIVE members of THIS org ─────────────────────
  const { data: memberships } = await admin
    .from('org_members')
    .select('user_id, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .in('user_id', [athlete_id, provider_id])
  const activeIds = new Set((memberships ?? []).map((m: { user_id: string }) => m.user_id))
  if (!activeIds.has(athlete_id) || !activeIds.has(provider_id)) {
    return NextResponse.json({ ok: false, error: 'not_org_members' }, { status: 422 })
  }

  // ── Global roles must match the edge ────────────────────────────────────
  const { data: roleRows } = await admin
    .from('users')
    .select('id, role')
    .in('id', [athlete_id, provider_id])
  const roleOf = new Map((roleRows ?? []).map((r: { id: string; role: string }) => [r.id, r.role]))
  if (roleOf.get(athlete_id) !== 'athlete' || roleOf.get(provider_id) !== provider_kind) {
    return NextResponse.json({ ok: false, error: 'role_mismatch' }, { status: 422 })
  }

  // ── Idempotent upsert of the connection (initiator = provider) ──────────
  const { data: existing } = await admin
    .from('connections')
    .select('id, status')
    .or(
      `and(initiator_id.eq.${provider_id},recipient_id.eq.${athlete_id}),` +
      `and(initiator_id.eq.${athlete_id},recipient_id.eq.${provider_id})`,
    )
    .eq('connection_type', connectionType)
    .maybeSingle()

  let connectionId: string
  if (existing) {
    connectionId = (existing as { id: string }).id
    if ((existing as { status: string }).status !== 'active') {
      await admin
        .from('connections')
        .update({ status: 'active', responded_at: new Date().toISOString() })
        .eq('id', connectionId)
    }
  } else {
    const { data: created, error: cErr } = await (admin as any)
      .from('connections')
      .insert({
        initiator_id:    provider_id,
        recipient_id:    athlete_id,
        connection_type: connectionType,
        status:          'active',
        responded_at:    new Date().toISOString(),
      })
      .select('id')
      .single()
    if (cErr || !created) {
      return NextResponse.json({ ok: false, error: 'connection_failed' }, { status: 500 })
    }
    connectionId = created.id
  }

  // The migration-085 trigger projects an active coach_athlete connection into
  // trainer_athletes automatically — no manual sync needed here.

  return NextResponse.json({ ok: true, connection_id: connectionId })
}
