'use client'

/**
 * <ChildClaimSection /> — tenant refactor #4b-v follow-up.
 *
 * Видна в /settings только если у user'а есть хотя бы один активный
 * parent_links (child_id = me, status='active') — то есть аккаунт был создан
 * родителем через #4b-ii. Позволяет ребёнку самостоятельно попросить родителя
 * выдать claim-link (POST /api/child/request-claim) — родитель получает
 * уведомление и в /parent/dashboard уже видит кнопку «Выдать доступ» (#177).
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  myUserId: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }                                        // нет parent_links
  | { kind: 'ready'; parentCount: number }
  | { kind: 'submitting' }
  | { kind: 'sent'; sentTo: number; skipped: number }
  | { kind: 'error'; message: string }

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default function ChildClaimSection({ myUserId }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!myUserId) { setState({ kind: 'hidden' }); return }
    let cancelled = false
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (sb() as any)
        .from('parent_links')
        .select('id', { count: 'exact', head: true })
        .eq('child_id', myUserId)
        .eq('status', 'active')
      if (cancelled) return
      const n = count ?? 0
      setState(n > 0 ? { kind: 'ready', parentCount: n } : { kind: 'hidden' })
    })()
    return () => { cancelled = true }
  }, [myUserId])

  async function requestClaim() {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/api/child/request-claim', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'failed')
      setState({ kind: 'sent', sentTo: json.sent_to ?? 0, skipped: json.skipped_recent ?? 0 })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'failed' })
    }
  }

  if (state.kind === 'loading' || state.kind === 'hidden') return null

  return (
    <section style={{
      borderRadius: 20, border: '1px solid #FBC1A0', background: '#FEF0E7',
      padding: 18, marginTop: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i className="ki-filled ki-key text-base" style={{ color: '#F35703' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#B03D04', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>
            Свой логин и пароль
          </p>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: '4px 0 6px' }}>
            Хотите управлять аккаунтом самостоятельно?
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--muted-foreground)', margin: 0 }}>
            Ваш аккаунт сейчас связан с родителем. Если вы готовы заходить сами — попросите родителя
            выдать вам персональную ссылку: после её открытия зададите свой email и пароль.
          </p>

          {state.kind === 'ready' && (
            <button
              type="button"
              onClick={requestClaim}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <i className="ki-filled ki-message-text-2 text-xs" />
              Попросить родителя
            </button>
          )}

          {state.kind === 'submitting' && (
            <button disabled className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white opacity-70">
              <span className="pf-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
              Отправляем…
            </button>
          )}

          {state.kind === 'sent' && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-2xs leading-relaxed text-green-800">
              {state.sentTo > 0
                ? `Запрос отправлен (${state.sentTo}). Родитель увидит уведомление и сможет выдать вам ссылку.`
                : 'Запрос уже отправлен недавно — родителю придёт повторное уведомление позже.'}
            </div>
          )}

          {state.kind === 'error' && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-2xs leading-relaxed text-red-700">
              Не удалось отправить запрос: {state.message}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
