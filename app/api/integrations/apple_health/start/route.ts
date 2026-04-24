import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/apple_health/start
 * Apple Health не имеет web-OAuth — интеграция работает через экспорт
 * health-data.zip из приложения «Здоровье» на iPhone. Этот endpoint
 * создаёт/обновляет запись-подключение в pending-состоянии, чтобы
 * UI показывал пользователю инструкцию по экспорту. После того как
 * пользователь загрузит ZIP через /api/integrations/apple_health/sync —
 * статус перейдёт в connected.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meId = (me as { id: string }).id

  const admin = createAdminClient()
  await admin.from('user_device_connections').upsert({
    user_id: meId,
    provider: 'apple_health',
    status: 'pending',
    is_primary: true,
    last_sync_at: null,
    last_sync_error: null,
  }, { onConflict: 'user_id,provider' })

  // Снять is_primary с остальных.
  await admin.from('user_device_connections')
    .update({ is_primary: false })
    .eq('user_id', meId).neq('provider', 'apple_health')

  return NextResponse.json({
    ok: true,
    next_step: 'upload',
    instructions: [
      'Откройте приложение «Здоровье» на iPhone → профиль → «Экспортировать медицинские данные».',
      'Сохраните архив health-data.zip на телефон / в iCloud Drive.',
      'Загрузите архив через кнопку ниже (до 20 МБ).',
    ],
  })
}
