import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// GET /api/notes?from=&to=&search=&limit=&offset=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const params = req.nextUrl.searchParams
  const from   = params.get('from')
  const to     = params.get('to')
  const search = params.get('search')
  const limit  = Math.min(parseInt(params.get('limit') ?? '100'), 200)
  const offset = parseInt(params.get('offset') ?? '0')

  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', me.id)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from) query = query.gte('note_date', from)
  if (to)   query = query.lte('note_date', to)
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/notes
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { content, title, note_date } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > 50000) {
    return NextResponse.json({ error: 'content too long (max 50000 chars)' }, { status: 400 })
  }
  if (title && title.length > 255) {
    return NextResponse.json({ error: 'title too long (max 255 chars)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id:   me.id,
      note_date: note_date ?? todayISO(),
      title:     title ?? null,
      content:   content.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data }, { status: 201 })
}
