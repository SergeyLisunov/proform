/**
 * POST /api/doctor/clearance — clearance #2 (Doctor write API).
 *
 * Доктор выставляет/обновляет допуск к нагрузке атлету. Append-only — каждый
 * вызов создаёт новую строку clearances, current = LATEST per athlete.
 *
 * Body:
 *   athlete_id:  uuid
 *   status:      'full' | 'limited' | 'light_only' | 'banned'
 *   note:        string?            — короткая заметка тренеру (НЕ диагноз)
 *   valid_until: ISO date string?    — обязателен для не-full; default +30 дней
 *
 * RLS (миграция 092) обеспечивает: caller — doctor + active doctor_athlete
 * connection с athlete. Серверный route не дублирует проверки (RLS WITH CHECK
 * политика clearances_doctor_insert падает на нарушение), только нормализует
 * входные данные и обрабатывает auto valid_until.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_DURATION_DAYS = 30

const BodySchema = z.object({
  athlete_id:  z.string().uuid(),
  status:      z.enum(['full', 'limited', 'light_only', 'banned']),
  note:        z.string().trim().max(500).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id, role').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const doctorId = (meRow as { id: string }).id
  const role     = (meRow as { role: string }).role

  if (role !== 'doctor') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 }) }

  // Auto valid_until for non-full clearances if not provided.
  let validUntil: string | null = body.valid_until ?? null
  if (body.status !== 'full' && !validUntil) {
    const d = new Date()
    d.setDate(d.getDate() + DEFAULT_DURATION_DAYS)
    validUntil = d.toISOString()
  }
  // For 'full', explicit valid_until is kept if provided (e.g. limited-time
  // full clearance for a tournament window), otherwise NULL (no expiry).

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertErr } = await (supabase as any)
    .from('clearances')
    .insert({
      athlete_id:  body.athlete_id,
      doctor_id:   doctorId,
      status:      body.status,
      note:        body.note ?? null,
      valid_until: validUntil,
    })
    .select('id, status, valid_until, created_at')
    .single()

  if (insertErr || !created) {
    // RLS WITH CHECK violation (e.g. doctor not connected to athlete) surfaces
    // as a generic insert error.
    const msg = insertErr?.message ?? ''
    const isAccess = /policy|rls|permission/i.test(msg)
    return NextResponse.json(
      { ok: false, error: isAccess ? 'not_connected' : 'insert_failed' },
      { status: isAccess ? 403 : 500 },
    )
  }

  // P0: замыкаем петлю светофора. Раньше выставление/смена допуска не слала
  // уведомлений НИКОМУ — атлет, тренеры и родитель узнавали о смене статуса,
  // только открыв страницу с badge. Теперь notify всем трём сторонам.
  // Admin-клиент: batch INSERT в notifications атомарен, а can_notify
  // (care-team предикаты) не содержит пары doctor↔parent — одна
  // заблокированная строка провалила бы весь batch. Это доверенный
  // серверный код после успешной RLS-проверки INSERT самого clearance.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = createAdminClient() as any
    const STATUS_LABEL: Record<string, string> = {
      full:       'Полный допуск',
      limited:    'Ограниченный допуск',
      light_only: 'Только лёгкая нагрузка',
      banned:     'Тренировки запрещены',
    }
    const label = STATUS_LABEL[body.status] ?? body.status
    const [{ data: coachLinks }, { data: parentLinks }] = await Promise.all([
      adminAny.from('trainer_athletes')
        .select('trainer_id').eq('athlete_id', body.athlete_id).eq('status', 'accepted'),
      adminAny.from('parent_links')
        .select('parent_id').eq('child_id', body.athlete_id).eq('status', 'active'),
    ])
    const base = {
      type:        'broadcast',
      title:       `Допуск обновлён: ${label}`,
      body:        body.note ?? null,
      entity_type: 'clearance',
      entity_id:   created.id,
    }
    const targets = [
      { ...base, user_id: body.athlete_id, action_url: '/dashboard' },
      ...((coachLinks ?? []) as Array<{ trainer_id: string }>).map(l => (
        { ...base, user_id: l.trainer_id, action_url: '/athletes' }
      )),
      ...((parentLinks ?? []) as Array<{ parent_id: string }>).map(l => (
        { ...base, user_id: l.parent_id, action_url: '/parent/dashboard' }
      )),
    ]
    if (targets.length > 0) await adminAny.from('notifications').insert(targets)
  } catch (e) {
    console.warn('[clearance.notify]', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true, clearance: created })
}
