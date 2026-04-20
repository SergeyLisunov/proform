import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PostSchema = z.object({
  expires_in_days: z.number().int().min(1).max(365).optional(),
})

function newToken(): string {
  // URL-safe, 22 chars (≈132 bits of entropy)
  return randomBytes(16).toString('base64url')
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  if (!workoutId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await sb
    .from('workout_shares')
    .select('token, workout_id, created_by, created_at, expires_at, revoked_at')
    .eq('workout_id', workoutId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, shares: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  if (!workoutId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  let body: z.infer<typeof PostSchema> = {}
  if (req.headers.get('content-length')) {
    try { body = PostSchema.parse(await req.json()) }
    catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }) }
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string }

  const token = newToken()
  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 86400_000).toISOString()
    : null

  const { data, error } = await sb
    .from('workout_shares')
    .insert({
      token,
      workout_id: workoutId,
      created_by: meRow.id,
      expires_at: expiresAt,
    })
    .select('token, workout_id, created_by, created_at, expires_at, revoked_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, share: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  if (!workoutId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  let q = sb
    .from('workout_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('workout_id', workoutId)
    .is('revoked_at', null)

  if (token) q = q.eq('token', token)

  const { error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
