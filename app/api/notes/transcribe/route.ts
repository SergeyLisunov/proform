import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HF_MODEL_PRIMARY = 'openai/whisper-large-v3-turbo'
const HF_MODEL_FALLBACK = 'openai/whisper-large-v3'
const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
])

function normalizeMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase()
}

async function callHuggingFace(audioBlob: Blob, model: string): Promise<string> {
  const token = process.env.HF_API_TOKEN
  if (!token) throw new Error('HF_API_TOKEN not configured')

  const arrayBuffer = await audioBlob.arrayBuffer()

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': audioBlob.type || 'audio/webm',
      'X-Wait-For-Model': 'true',
    },
    body: arrayBuffer,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HuggingFace ${res.status}: ${text}`)
  }

  const json = await res.json() as { text?: string; error?: string }
  if (json.error) throw new Error(json.error)
  if (typeof json.text !== 'string') throw new Error('Unexpected HF response format')

  return json.text.trim()
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse FormData
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audioEntry = formData.get('audio')
  if (!audioEntry || !(audioEntry instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio field' }, { status: 400 })
  }

  // Size check
  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio too large (max ${MAX_AUDIO_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    )
  }

  // Empty recording check
  if (audioEntry.size < 100) {
    return NextResponse.json({ error: 'Audio recording too short' }, { status: 400 })
  }

  // MIME type check
  const baseMime = normalizeMime(audioEntry.type)
  if (audioEntry.type && !ALLOWED_MIME_TYPES.has(audioEntry.type) && !ALLOWED_MIME_TYPES.has(baseMime)) {
    return NextResponse.json(
      { error: `Unsupported audio format: ${audioEntry.type}` },
      { status: 415 }
    )
  }

  // Try primary model, fall back on error
  let transcript: string
  try {
    transcript = await callHuggingFace(audioEntry, HF_MODEL_PRIMARY)
  } catch (primaryErr) {
    console.error('[transcribe] primary model failed:', primaryErr)
    try {
      transcript = await callHuggingFace(audioEntry, HF_MODEL_FALLBACK)
    } catch (fallbackErr) {
      console.error('[transcribe] fallback model failed:', fallbackErr)
      return NextResponse.json(
        { error: 'Speech recognition unavailable, try again later' },
        { status: 503 }
      )
    }
  }

  if (!transcript) {
    return NextResponse.json({ error: 'No speech detected' }, { status: 422 })
  }

  return NextResponse.json({ transcript })
}
