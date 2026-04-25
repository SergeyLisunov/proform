'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listMyDeviceConnections, triggerSync, type DeviceConnection,
} from '@/services/devices.service'
import { providerMeta } from '@/lib/integrations/providers'

function fmtSync(iso: string | null): string {
  if (!iso) return 'ещё не было'
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1)   return 'только что'
  if (minutes < 60)  return `${minutes} мин назад`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ч назад`
  return `${Math.floor(minutes / 1440)} дн назад`
}

/**
 * Статус подключённых устройств. Если подключений нет — показывает
 * приглашение настроить (минимально, без давления).
 */
export default function AthleteDeviceStatus({ athleteId }: { athleteId: string }) {
  void athleteId  // RLS уже фильтрует по own
  const [conns, setConns] = useState<DeviceConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setConns(await listMyDeviceConnections()) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return null

  const connected = conns.filter(c => c.status === 'connected')
  const primary = connected.find(c => c.is_primary) ?? connected[0]

  if (connected.length === 0) {
    return (
      <Link href="/settings?tab=devices"
        className="block rounded-2xl border border-dashed border-border bg-card/40 p-4 hover:border-purple-300 hover:bg-purple-50/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl">⌚</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">Подключите носимое устройство</div>
            <div className="text-[11px] text-muted-foreground">Garmin, WHOOP или Apple Health — метрики будут считаться сами.</div>
          </div>
          <i className="ki-filled ki-arrow-right text-xs text-muted-foreground" />
        </div>
      </Link>
    )
  }

  const meta = primary ? providerMeta(primary.provider) : null

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {meta && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
              {meta.icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">{meta?.name ?? 'Устройство'}</span>
              <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                ● онлайн
              </span>
              {connected.length > 1 && (
                <span className="text-[11px] text-muted-foreground">+{connected.length - 1}</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Синхронизация: {fmtSync(primary?.last_sync_at ?? null)}
              {primary?.last_sync_error && (
                <span className="ml-2 text-red-600">· ошибка</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {primary && (
            <button disabled={!!syncing}
              onClick={async () => {
                setSyncing(primary.provider); setMsg(null)
                const r = await triggerSync(primary.provider)
                setMsg(r.ok ? `Синхронизировано: ${r.count}` : `Ошибка: ${r.error}`)
                await load()
                setSyncing(null)
              }}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50">
              {syncing ? 'Синхронизация…' : '↻ Синхронизировать'}
            </button>
          )}
          <Link href="/settings?tab=devices"
            className="rounded-lg border border-border bg-background hover:bg-muted px-3 py-1.5 text-[11px] font-semibold">
            Управление
          </Link>
        </div>
      </div>
      {msg && <div className="mt-2 text-[11px] text-muted-foreground">{msg}</div>}
    </div>
  )
}
