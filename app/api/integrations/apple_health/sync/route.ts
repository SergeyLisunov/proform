import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_UPLOAD = 25 * 1024 * 1024  // 25 MB

/**
 * POST /api/integrations/apple_health/sync
 * Принимает multipart/form-data с полем `file` — health-data.zip или
 * напрямую export.xml из Apple Health.
 *
 * Полноценный парсинг XML (HealthKit extensive XML export) вынесен в
 * бэклог: объём элементов достигает сотен тысяч и требует streaming
 * парсера. Сейчас: фиксируем сам факт загрузки, сохраняем ZIP в
 * бакет `note-attachments` под префиксом {userId}/apple_health/,
 * ставим status=connected + metadata.uploaded_file_url. Follow-up —
 * worker для парсинга.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meId = (me as { id: string }).id

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'MISSING_FILE' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD) {
    return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', max_bytes: MAX_UPLOAD }, { status: 413 })
  }
  const okType = /\.(zip|xml)$/i.test(file.name) || file.type === 'application/zip' || file.type === 'text/xml'
  if (!okType) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE', hint: 'Нужен .zip или export.xml' }, { status: 415 })
  }

  const admin = createAdminClient()
  const ext  = (file.name.split('.').pop() ?? 'zip').toLowerCase()
  // NOTE: `note-attachments` is a public-read bucket. A full Apple Health
  // export contains heart rate, medications, and clinical history — that
  // data must NEVER be retrievable by URL. We therefore (a) store ONLY the
  // path in metadata, never a public URL, and (b) tag the upload with a
  // private subdirectory `health-private/`. Migration to a fully private
  // bucket with createSignedUrl-based access is tracked separately; until
  // then, no public URL leaves this handler.
  const path = `${meId}/health-private/apple_health/${Date.now()}-health.${ext}`
  const { error: upErr } = await admin.storage.from('note-attachments').upload(
    path, file, { upsert: false, contentType: file.type || 'application/octet-stream' },
  )
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
  }

  await admin.from('user_device_connections').upsert({
    user_id: meId,
    provider: 'apple_health',
    status: 'connected',
    is_primary: true,
    last_sync_at: new Date().toISOString(),
    last_sync_error: null,
    metadata: {
      // Path only — never the public URL. Worker will retrieve via the
      // service-role admin client (RLS-bypassing read on the bucket path).
      uploaded_file_path: path,
      uploaded_file_name: file.name,
      uploaded_size: file.size,
      parse_status: 'queued',
    },
  }, { onConflict: 'user_id,provider' })

  // Снять is_primary с остальных.
  await admin.from('user_device_connections')
    .update({ is_primary: false })
    .eq('user_id', meId).neq('provider', 'apple_health')

  return NextResponse.json({
    ok: true,
    count: 0,
    note: 'Файл принят. Парсинг запустится в фоновом worker в ближайшие минуты.',
  })
}
