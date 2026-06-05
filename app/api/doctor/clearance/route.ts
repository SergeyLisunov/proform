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

  return NextResponse.json({ ok: true, clearance: created })
}
