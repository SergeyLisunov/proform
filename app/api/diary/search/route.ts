import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedOne } from '@/lib/ai/embeddings'

type Hit = {
  source_type: 'note' | 'workout'
  source_id: string
  content_preview: string | null
  similarity: number
}

type NoteHit = Hit & {
  note?: { id: string; title: string | null; content: string; note_date: string } | null
}
type WorkoutHit = Hit & {
  workout?: {
    id: string
    event_date: string
    activity_type: string | null
    activity_duration_min: number | null
    activity_strain: number | null
    description: string | null
  } | null
}

// POST /api/diary/search  { query: string, k?: number }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: { query?: unknown; k?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return NextResponse.json({ ok: false, error: 'EMPTY_QUERY' }, { status: 400 })
  if (query.length > 500) return NextResponse.json({ ok: false, error: 'QUERY_TOO_LONG' }, { status: 400 })

  const kRaw = Number(body.k ?? 20)
  const k = Number.isFinite(kRaw) ? Math.min(Math.max(1, Math.floor(kRaw)), 50) : 20

  let vector: number[]
  try {
    vector = await embedOne(query)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'EMBED_FAILED' },
      { status: 502 }
    )
  }

  const { data: rows, error } = await (supabase as any).rpc('match_diary', {
    p_embedding: vector,
    p_limit: k,
  })
  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })

  const hits = (rows ?? []) as Hit[]
  if (hits.length === 0) return NextResponse.json({ ok: true, hits: [] })

  const noteIds = hits.filter(h => h.source_type === 'note').map(h => h.source_id)
  const workoutIds = hits.filter(h => h.source_type === 'workout').map(h => h.source_id)

  const [notesRes, workoutsRes] = await Promise.all([
    noteIds.length
      ? supabase
          .from('notes')
          .select('id, title, content, note_date')
          .in('id', noteIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string | null; content: string; note_date: string }> }),
    workoutIds.length
      ? supabase
          .from('workouts')
          .select('id, event_date, activity_type, activity_duration_min, activity_strain, description')
          .in('id', workoutIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string
            event_date: string
            activity_type: string | null
            activity_duration_min: number | null
            activity_strain: number | null
            description: string | null
          }>,
        }),
  ])

  const notesMap = new Map<string, NoteHit['note']>()
  for (const n of notesRes.data ?? []) notesMap.set(n.id as string, n as NonNullable<NoteHit['note']>)

  const workoutsMap = new Map<string, WorkoutHit['workout']>()
  for (const w of workoutsRes.data ?? []) workoutsMap.set(w.id as string, w as NonNullable<WorkoutHit['workout']>)

  const enriched = hits.map(h => {
    if (h.source_type === 'note') {
      return { ...h, note: notesMap.get(h.source_id) ?? null } as NoteHit
    }
    return { ...h, workout: workoutsMap.get(h.source_id) ?? null } as WorkoutHit
  }).filter(h => {
    if (h.source_type === 'note') return !!(h as NoteHit).note
    return !!(h as WorkoutHit).workout
  })

  return NextResponse.json({ ok: true, hits: enriched })
}
