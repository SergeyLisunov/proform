import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const DaySchema = z.object({
  day_offset:  z.number().int().min(0).max(6),
  activity:    z.string(),
  headline:    z.string(),
  duration_min:z.number().int().min(0).max(240),
  intensity:   z.string(),
})

const BodySchema = z.object({
  days: z.array(DaySchema).length(7),
})

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const userId = (me as { id: string }).id

  const base = new Date()
  base.setDate(base.getDate() + 1) // starts tomorrow

  const events = body.days.map(d => {
    const day = new Date(base)
    day.setDate(base.getDate() + d.day_offset)
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const dd = String(day.getDate()).padStart(2, '0')
    return {
      owner_id:   userId,
      event_date: `${y}-${m}-${dd}`,
      event_type: d.activity === 'Отдых' ? 'rest' : 'workout',
      title:      d.headline,
      notes:      `AI-план · ${d.activity} · ${d.duration_min} мин · ${d.intensity}`,
      start_time: null,
      end_time:   null,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('calendar_events').insert(events)
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, inserted: events.length })
}
