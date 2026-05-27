import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  name:          z.string().trim().min(1).max(160).optional(),
  activity_type: z.string().trim().max(60).nullable().optional(),
  duration_min:  z.number().int().min(1).max(600).nullable().optional(),
  description:   z.string().trim().max(4000).nullable().optional(),
  segments:      z.any().optional(),
  is_public:     z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await sb
    .from('workout_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  if (!data)  return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true, template: data })
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
    .from('workout_templates')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  return NextResponse.json({ ok: true, template: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { error } = await sb.from('workout_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
