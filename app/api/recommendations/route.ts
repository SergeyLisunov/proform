import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/recommendations — create new structured recommendation.
 *
 * Auth: caller must be logged in. RLS enforces doctor_id = me at INSERT,
 * so any role can call this endpoint but only doctor/specialist with
 * matching internal user_id will succeed. We additionally short-circuit
 * with role check (coach/athlete attempting will get 403 before hitting RLS).
 *
 * Body validated via Zod. Notifications dispatched server-side after
 * successful insert.
 */

const CreateSchema = z.object({
  athlete_id:           z.string().uuid(),
  organization_id:      z.string().uuid().optional().nullable(),
  coach_id:             z.string().uuid().optional().nullable(),
  title:                z.string().min(3).max(120),
  body:                 z.string().max(4000).optional().nullable(),
  category: z.enum([
    'load_restriction','activity_restriction','recovery','observation',
    'consultation_request','clearance','nutrition','general','referral',
  ]),
  severity:             z.enum(['low','moderate','high','critical']).optional(),
  visibility_level:     z.enum(['athlete_only','coach_only','coach_and_athlete','org_full']).optional(),
  valid_from:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valid_until:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  referred_to_specialty: z.enum([
    'physician','physio','massage','nutrition','psychiatry','other',
  ]).optional().nullable(),
  referred_to_user_id:  z.string().uuid().optional().nullable(),
  send:                 z.boolean().optional(),
})

export async function POST(req: Request) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const meRow = me as { id: string; role: string | null } | null
  if (!meRow) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  if (meRow.role !== 'doctor' && meRow.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  // P0: раньше проверялась ТОЛЬКО роль автора, а athlete_id брался из тела —
  // врач мог завести медицинскую рекомендацию любому спортсмену платформы,
  // включая чужой клуб. Требуем подтверждённую связь врач↔пациент, как это
  // делает /api/ai/medical-summary. БД дублирует проверку политикой
  // recommendations_doctor_insert (миграция 105).
  if (meRow.role === 'doctor') {
    const { data: link } = await sb
      .from('connections')
      .select('id')
      .eq('connection_type', 'doctor_athlete')
      .eq('status', 'active')
      .or(
        `and(initiator_id.eq.${meRow.id},recipient_id.eq.${body.athlete_id}),` +
        `and(initiator_id.eq.${body.athlete_id},recipient_id.eq.${meRow.id})`
      )
      .maybeSingle()
    if (!link) {
      return NextResponse.json(
        { ok: false, error: 'NOT_YOUR_PATIENT' },
        { status: 403 }
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (sb as any)
    .from('recommendations')
    .insert({
      doctor_id:             meRow.id,
      athlete_id:            body.athlete_id,
      organization_id:       body.organization_id ?? null,
      coach_id:              body.coach_id ?? null,
      title:                 body.title.trim(),
      body:                  body.body?.trim() || null,
      category:              body.category,
      severity:              body.severity ?? 'moderate',
      visibility_level:      body.visibility_level ?? 'coach_and_athlete',
      status:                body.send === false ? 'draft' : 'sent',
      valid_from:            body.valid_from ?? new Date().toISOString().slice(0, 10),
      valid_until:           body.valid_until ?? null,
      referred_to_specialty: body.referred_to_specialty ?? null,
      referred_to_user_id:   body.referred_to_user_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'INSERT_FAILED' }, { status: 500 })
  }

  // Dispatch notifications via simple inline logic (avoid module import
  // round-trip in API route). Notifications best-effort — don't fail
  // request on notification error.
  if (body.send !== false) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any
      const targets: Array<{ user_id: string; type: string; title: string; body: string | null; entity_type: string; entity_id: string; action_url: string | null }> = []
      const isCoachVisible = ['coach_only','coach_and_athlete','org_full'].includes(r.visibility_level)
      const isAthleteVisible = ['athlete_only','coach_and_athlete','org_full'].includes(r.visibility_level)

      if (isAthleteVisible) {
        targets.push({
          user_id:     r.athlete_id,
          type:        'broadcast',
          title:       'Рекомендация от врача',
          body:        r.title,
          entity_type: 'recommendation',
          entity_id:   r.id,
          action_url:  '/dashboard',
        })
      }

      if (isCoachVisible) {
        if (r.coach_id) {
          targets.push({
            user_id:     r.coach_id,
            type:        'broadcast',
            title:       'Медотметка для тренера',
            body:        r.title,
            entity_type: 'recommendation',
            entity_id:   r.id,
            action_url:  `/athletes/${r.athlete_id}`,
          })
        } else {
          // Fan-out to all linked coaches
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: links } = await (sb as any)
            .from('trainer_athletes')
            .select('trainer_id')
            .eq('athlete_id', r.athlete_id)
            .eq('status', 'accepted')
          for (const l of ((links ?? []) as Array<{ trainer_id: string }>)) {
            targets.push({
              user_id:     l.trainer_id,
              type:        'broadcast',
              title:       'Медотметка для тренера',
              body:        r.title,
              entity_type: 'recommendation',
              entity_id:   r.id,
              action_url:  `/athletes/${r.athlete_id}`,
            })
          }
        }
      }

      if (r.referred_to_user_id) {
        targets.push({
          user_id:     r.referred_to_user_id,
          type:        'broadcast',
          title:       'Направление к специалисту',
          body:        r.title,
          entity_type: 'recommendation',
          entity_id:   r.id,
          action_url:  '/dashboard',
        })
      }

      if (targets.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb as any).from('notifications').insert(targets)
      }
    } catch (notifyErr) {
      console.warn('[recommendations.notify]', notifyErr)
    }
  }

  return NextResponse.json({ ok: true, data: row })
}

/**
 * GET /api/recommendations?athlete_id=… — list recommendations for one
 * athlete. RLS filters automatically (athlete sees own; coach sees if
 * linked + visibility allows; doctor sees own; org_admin sees org).
 */
export async function GET(req: Request) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const url = new URL(req.url)
  const athleteId = url.searchParams.get('athlete_id')

  let q = sb.from('recommendations').select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (athleteId) q = q.eq('athlete_id', athleteId)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })

  // P1: RLS пускает администрацию клуба к строкам рекомендаций, чтобы она
  // видела ФАКТ и операционную важность ограничения. Но выдача отдавала
  // строку целиком — включая клинический текст записей с
  // visibility_level='athlete_only', адресованных только спортсмену.
  // Скрываем содержательные поля от всех, кому запись не адресована;
  // автор-врач и сам спортсмен видят её полностью.
  const { data: meRow } = await sb
    .from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string | null } | null

  type Rec = {
    id: string; athlete_id: string; doctor_id: string | null; coach_id: string | null
    visibility_level: string; body: string | null; title: string
    [k: string]: unknown
  }

  const redacted = ((data ?? []) as Rec[]).map(r => {
    if (!me || me.role === 'admin') return r
    const isAuthor  = r.doctor_id === me.id
    const isAthlete = r.athlete_id === me.id
    const isCoach   = r.coach_id === me.id
    if (isAuthor || isAthlete) return r

    const coachMayRead = ['coach_only', 'coach_and_athlete', 'org_full'].includes(r.visibility_level)
    if (isCoach && coachMayRead) return r
    if (r.visibility_level === 'org_full') return r

    // Остальным (в т.ч. администрации клуба) — только факт и метаданные.
    return { ...r, body: null, title: 'Медицинское ограничение', redacted: true }
  })

  return NextResponse.json({ ok: true, data: redacted })
}
