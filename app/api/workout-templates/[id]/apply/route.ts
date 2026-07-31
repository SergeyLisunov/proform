import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),        // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  title_override: z.string().trim().max(160).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }) }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string }

  const { data: tpl, error: tplErr } = await sb
    .from('workout_templates')
    .select('id, name, activity_type, duration_min, description')
    .eq('id', templateId)
    .maybeSingle()
  if (tplErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  if (!tpl)   return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
  const tplRow = tpl as {
    id: string; name: string; activity_type: string | null; duration_min: number | null; description: string | null
  }

  // Compute end_time from start_time + duration_min if provided
  let endTime: string | null = null
  if (body.time && tplRow.duration_min) {
    const [h, m] = body.time.split(':').map(Number)
    const total  = h * 60 + m + tplRow.duration_min
    const eh     = Math.floor(total / 60) % 24
    const em     = total % 60
    endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  }

  const { data, error } = await sb
    .from('calendar_events')
    .insert({
      owner_id:    meRow.id,
      title:       body.title_override ?? tplRow.name,
      // P1: здесь стояло 'training' — значения, которого НЕТ в
      // calendar_events_event_type_check. Применение шаблона в календарь
      // падало всегда (23514), молча ломая единственный быстрый путь
      // планирования тренировки. Словарь уже содержит нужный термин.
      event_type:  'workout',
      start_date:  body.date,
      event_date:  body.date,
      start_time:  body.time ?? null,
      end_time:    endTime,
      description: tplRow.description,
      notes:       tplRow.activity_type ? `Активность: ${tplRow.activity_type}` : null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  return NextResponse.json({ ok: true, event_id: data.id })
}
