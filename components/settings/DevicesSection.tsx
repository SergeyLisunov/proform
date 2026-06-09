'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import { allProviders, type DeviceProvider } from '@/lib/integrations/providers'
import { Badge, Alert, type BadgeVariant } from '@/components/ui/metronic'
import {
  listMyDeviceConnections, setPrimaryDevice, disconnectDevice, triggerSync,
  type DeviceConnection,
} from '@/services/devices.service'

/**
 * Секция «Устройства» в настройках профиля. Три карточки: Garmin, Whoop,
 * Apple Health. Одна из них может быть «основной» — метрики с неё
 * подгружаются в дашборд и дневник.
 */

function Status({ s }: { s: DeviceConnection['status'] }) {
  const map: Record<DeviceConnection['status'], { label: string; variant: BadgeVariant }> = {
    connected: { label: 'Подключено',  variant: 'success' },
    pending:   { label: 'Ожидает',     variant: 'primary' },
    failed:    { label: 'Ошибка',      variant: 'destructive' },
    revoked:   { label: 'Отключено',   variant: 'secondary' },
  }
  const m = map[s]
  return (
    <Badge variant={m.variant} size="sm" className="uppercase tracking-wider">
      {m.label}
    </Badge>
  )
}

function fmtSync(iso: string | null): string {
  if (!iso) return 'ещё не было'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DevicesSection() {
  const { confirm } = useDialog()
  const [conns, setConns] = useState<DeviceConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState<{ level: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setConns(await listMyDeviceConnections()) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // URL-параметры после OAuth-callback
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const connected = p.get('device_connected')
    const error = p.get('device_error')
    if (connected) {
      setMsg({ level: 'ok', text: `Устройство ${connected} успешно подключено` })
      window.history.replaceState({}, '', window.location.pathname + '?tab=devices')
    } else if (error) {
      setMsg({ level: 'err', text: `Ошибка подключения: ${error}` })
      window.history.replaceState({}, '', window.location.pathname + '?tab=devices')
    }
  }, [])

  const byProvider = new Map<DeviceProvider, DeviceConnection>()
  for (const c of conns) byProvider.set(c.provider, c)

  const primary = conns.find(c => c.is_primary && c.status === 'connected')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-orange-50 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700">
              ⌚ Носимые устройства
            </span>
            <h2 className="text-lg font-bold text-navy-500 mt-2">Выберите носимое устройство</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Подключите Garmin, WHOOP или Apple Health — метрики восстановления,
              HRV, сна и тренировок будут автоматически подгружаться в ваш
              дашборд и видны вашему тренеру.
            </p>
          </div>
          {primary && (
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Основное устройство</div>
              <div className="text-lg font-bold text-purple-700">{providerLabelOf(primary.provider)}</div>
              <div className="text-[10px] text-muted-foreground">синхронизация {fmtSync(primary.last_sync_at)}</div>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <Alert variant={msg.level === 'ok' ? 'success' : 'destructive'}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            className="float-right text-xs opacity-60 hover:opacity-100">×</button>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {allProviders().map(meta => {
          const conn = byProvider.get(meta.id)
          const isConnected = conn?.status === 'connected'
          const isPrimary   = !!conn?.is_primary && isConnected
          return (
            <div key={meta.id}
              className="kt-card rounded-2xl border bg-card p-4 flex flex-col gap-3 transition-all hover:shadow-sm"
              style={{ borderColor: isPrimary ? meta.brandColor : meta.border }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{meta.name}</span>
                    {conn && <Status s={conn.status} />}
                    {isPrimary && (
                      <span className="kt-badge rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                        основное
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{meta.tagline}</div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-snug">
                {meta.description}
              </p>

              <div className="flex flex-wrap gap-1">
                {meta.syncs.map(s => (
                  <span key={s} className="rounded-full bg-muted/40 border border-border text-[9px] font-semibold px-1.5 py-0.5 text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>

              {conn?.last_sync_at && (
                <div className="text-[10px] text-muted-foreground">
                  Последняя синхронизация: <strong>{fmtSync(conn.last_sync_at)}</strong>
                </div>
              )}
              {conn?.last_sync_error && (
                <div className="text-[10px] text-red-600">
                  Ошибка: {conn.last_sync_error}
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-1.5">
                {isConnected ? (
                  <>
                    {!isPrimary && (
                      <button disabled={!!busy[meta.id]}
                        onClick={async () => {
                          setBusy(b => ({ ...b, [meta.id]: true }))
                          await setPrimaryDevice(meta.id); await load()
                          setBusy(b => ({ ...b, [meta.id]: false }))
                        }}
                        className="rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50">
                        Сделать основным
                      </button>
                    )}
                    <button disabled={!!busy[meta.id]}
                      onClick={async () => {
                        setBusy(b => ({ ...b, [meta.id]: true }))
                        const r = await triggerSync(meta.id)
                        setMsg(r.ok
                          ? { level: 'ok', text: `Синхронизировано ${r.count} записей` }
                          : { level: 'err', text: `Ошибка: ${r.error}` })
                        await load()
                        setBusy(b => ({ ...b, [meta.id]: false }))
                      }}
                      className="rounded-lg bg-orange-500 text-white hover:bg-orange-600 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50">
                      <i className="ki-filled ki-arrows-circle text-[10px] mr-1" />
                      {busy[meta.id] ? 'Синхронизация…' : 'Синхронизировать'}
                    </button>
                    <button disabled={!!busy[meta.id]}
                      onClick={async () => {
                        if (!(await confirm(`Отключить ${meta.name}? Токены будут удалены.`))) return
                        setBusy(b => ({ ...b, [meta.id]: true }))
                        await disconnectDevice(meta.id); await load()
                        setBusy(b => ({ ...b, [meta.id]: false }))
                      }}
                      className="rounded-lg bg-background text-red-600 border border-border hover:bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50">
                      Отключить
                    </button>
                  </>
                ) : meta.comingSoon ? (
                  <div className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-amber-800"
                    title="Интеграция ждёт одобрения Garmin Health API Partner Program. Подключить пока нельзя — мы не показываем фейковые данные.">
                    <i className="ki-filled ki-information-2 text-[14px]" />
                    <span className="text-[12px] font-bold uppercase tracking-wider">Скоро</span>
                  </div>
                ) : meta.connectMode === 'oauth' ? (
                  <a href={`/api/integrations/${meta.id}/start`}
                    className="w-full rounded-lg text-white px-3 py-2 text-sm font-semibold text-center"
                    style={{ background: meta.brandColor }}>
                    Подключить →
                  </a>
                ) : (
                  <AppleHealthUploader onDone={load} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Alert variant="info" icon="ki-shield-tick" title="Приватность">
        Мы храним только OAuth-токены и агрегированные метрики
        (recovery, HRV, сон, strain). Исходные данные остаются у провайдера.
        Отключение в любой момент удаляет токены.
      </Alert>
    </div>
  )
}

function providerLabelOf(p: DeviceProvider): string {
  return { garmin: 'Garmin', whoop: 'WHOOP', apple_health: 'Apple Health' }[p]
}

function AppleHealthUploader({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setBusy(true); setErr(null)
    try {
      // 1. Ensure connection row exists (POST /start initialises).
      await fetch('/api/integrations/apple_health/start', { method: 'POST' })
      // 2. Upload the file.
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/integrations/apple_health/sync', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setErr(json.error ?? `HTTP ${res.status}`)
      else onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="w-full flex flex-col gap-1">
      <button onClick={() => ref.current?.click()} disabled={busy}
        className="w-full rounded-lg bg-red-500 text-white hover:bg-red-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">
        {busy ? 'Загружаем…' : 'Загрузить health-data.zip'}
      </button>
      <input ref={ref} type="file" className="hidden" accept=".zip,.xml"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
      {err && <div className="text-[10px] text-red-600">Ошибка: {err}</div>}
    </div>
  )
}
