import { createClient } from '@/lib/supabase/client'
import type { DeviceProvider } from '@/lib/integrations/providers'

export type DeviceStatus = 'connected' | 'pending' | 'failed' | 'revoked'

export interface DeviceConnection {
  id: string
  user_id: string
  provider: DeviceProvider
  status: DeviceStatus
  is_primary: boolean
  provider_user_id: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Список подключений текущего пользователя (через RLS). */
export async function listMyDeviceConnections(): Promise<DeviceConnection[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('user_device_connections')
    .select('id, user_id, provider, status, is_primary, provider_user_id, last_sync_at, last_sync_error, metadata, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) { console.warn('[listMyDeviceConnections]', error.message); return [] }
  return (data ?? []) as DeviceConnection[]
}

/** Пометить конкретный провайдер как «основной» (is_primary = true). */
export async function setPrimaryDevice(provider: DeviceProvider): Promise<boolean> {
  const sb = createClient()
  // Сперва снимаем is_primary со всех моих записей, затем выставляем
  // на выбранную (partial-unique-index гарантирует атомарность через
  // уникальность).
  const { error: clearErr } = await (sb as any)
    .from('user_device_connections')
    .update({ is_primary: false })
    .eq('is_primary', true)
  if (clearErr) { console.warn('[setPrimaryDevice:clear]', clearErr.message); return false }
  const { error } = await (sb as any)
    .from('user_device_connections')
    .update({ is_primary: true })
    .eq('provider', provider)
  if (error) { console.warn('[setPrimaryDevice:set]', error.message); return false }
  return true
}

/** Разрывает подключение — статус revoked, токены очищены. */
export async function disconnectDevice(provider: DeviceProvider): Promise<boolean> {
  const sb = createClient()
  const { error } = await (sb as any)
    .from('user_device_connections')
    .update({
      status: 'revoked',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      is_primary: false,
      last_sync_error: null,
    })
    .eq('provider', provider)
  if (error) { console.warn('[disconnectDevice]', error.message); return false }
  return true
}

/** Триггерит синхронизацию через API-роут конкретного провайдера. */
export async function triggerSync(provider: DeviceProvider): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    return { ok: true, count: json.count ?? 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
