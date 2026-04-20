import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedMany, contentHash } from '@/lib/ai/embeddings'

type Row = {
  source_type: 'note' | 'workout'
  source_id: string
  text: string
  preview: string
}

function clipPreview(text: string, max = 240): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1) + '…'
}

// POST /api/diary/index  — (re)build embeddings for caller's notes + workouts.
export async function POST() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

  // 1. Gather note sources.
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, content, note_date')
    .eq('user_id', me.id)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .limit(500)

  const noteRows: Row[] = (notes ?? [])
    .map(n => {
      const body = `${n.title ? n.title + '\n' : ''}${n.content ?? ''}`.trim()
      if (!body) return null
      return {
        source_type: 'note' as const,
        source_id: n.id as string,
        text: body,
        preview: clipPreview(body),
      }
    })
    .filter((r): r is Row => !!r)

  // 2. Gather workout sources (anything with a description or meaningful metrics).
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, description, workout_time_of_day')
    .eq('athlete_id', me.id)
    .order('event_date', { ascending: false })
    .limit(500)

  const workoutRows: Row[] = (workouts ?? [])
    .map(w => {
      const parts: string[] = []
      if (w.activity_type) parts.push(String(w.activity_type))
      if (w.event_date) parts.push(String(w.event_date))
      if (w.workout_time_of_day) parts.push(String(w.workout_time_of_day))
      if (w.activity_duration_min) parts.push(`${w.activity_duration_min} мин`)
      if (w.activity_strain != null) parts.push(`strain ${w.activity_strain}`)
      if (w.avg_heart_rate != null) parts.push(`чсс ${w.avg_heart_rate}`)
      if (w.description) parts.push(String(w.description))
      const body = parts.join(' · ').trim()
      if (!body) return null
      return {
        source_type: 'workout' as const,
        source_id: w.id as string,
        text: body,
        preview: clipPreview(body),
      }
    })
    .filter((r): r is Row => !!r)

  const allRows = [...noteRows, ...workoutRows]
  if (allRows.length === 0) {
    return NextResponse.json({ ok: true, indexed: 0, skipped: 0, total: 0 })
  }

  // 3. Filter rows whose hash already matches existing embedding.
  const { data: existing } = await supabase
    .from('diary_embeddings')
    .select('source_type, source_id, content_hash')
    .eq('user_id', me.id)

  const existingMap = new Map<string, string>()
  for (const r of (existing ?? []) as Array<{ source_type: string; source_id: string; content_hash: string }>) {
    existingMap.set(`${r.source_type}:${r.source_id}`, r.content_hash)
  }

  const rowsWithHash = await Promise.all(
    allRows.map(async r => ({ ...r, hash: await contentHash(r.text) }))
  )

  const toEmbed = rowsWithHash.filter(r => existingMap.get(`${r.source_type}:${r.source_id}`) !== r.hash)

  if (toEmbed.length === 0) {
    return NextResponse.json({ ok: true, indexed: 0, skipped: allRows.length, total: allRows.length })
  }

  // 4. Embed in batches.
  const BATCH = 16
  const MAX_CHARS = 1500
  let indexed = 0
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH)
    const inputs = batch.map(b => b.text.slice(0, MAX_CHARS))
    let vectors: number[][]
    try {
      vectors = await embedMany(inputs)
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'EMBED_FAILED', indexed },
        { status: 502 }
      )
    }

    const payload = batch.map((b, idx) => ({
      user_id: me.id,
      source_type: b.source_type,
      source_id: b.source_id,
      content_hash: b.hash,
      content_preview: b.preview,
      embedding: vectors[idx] as unknown as string, // supabase-js accepts number[] for vector columns
      updated_at: new Date().toISOString(),
    }))

    const { error: upErr } = await (supabase.from('diary_embeddings') as any).upsert(payload, {
      onConflict: 'user_id,source_type,source_id',
    })
    if (upErr) {
      return NextResponse.json(
        { ok: false, error: upErr.message, indexed },
        { status: 500 }
      )
    }
    indexed += batch.length
  }

  return NextResponse.json({
    ok: true,
    indexed,
    skipped: allRows.length - toEmbed.length,
    total: allRows.length,
  })
}
