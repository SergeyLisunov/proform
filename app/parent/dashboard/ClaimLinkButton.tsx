'use client'

/**
 * <ClaimLinkButton /> — client island в /parent/dashboard.
 *
 * Родитель нажимает «Дать ребёнку доступ» → POST /api/parent/issue-claim-link
 * → модалка с готовой ссылкой (copy-to-clipboard) для передачи ребёнку.
 * Ссылка ведёт на /auth/claim-child/<token>, где ребёнок задаёт свой email +
 * пароль и привязывает себе аккаунт.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  childId:   string
  childName: string
}

export default function ClaimLinkButton({ childId, childName }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [url, setUrl]         = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)

  async function issue() {
    setLoading(true); setError(''); setCopied(false)
    try {
      const res = await fetch('/api/parent/issue-claim-link', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ child_id: childId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'failed')
      setUrl(json.url)
      setExpiresAt(json.expires_at ?? '')
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Скопируйте ссылку:', url)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={issue}
        disabled={loading}
        title="Выдать ребёнку ссылку для самостоятельного входа"
        className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-2xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <i className="ki-filled ki-key text-[10px]" />
        {loading ? 'Выдаём…' : 'Выдать доступ'}
      </button>

      {error && (
        <p className="mt-1 text-2xs text-red-500">Не удалось выдать ссылку: {error}</p>
      )}

      {open && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: 460, maxWidth: '100vw', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Ссылка для входа</p>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: '3px 0 0' }}>{childName}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>
                Передайте эту ссылку ребёнку. Открыв её, он задаст свой email и пароль —
                и сможет входить в Sporteo сам.
              </p>
              <input
                readOnly value={url}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copy}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                  <i className="ki-filled ki-copy text-xs" />
                  {copied ? 'Скопировано!' : 'Скопировать ссылку'}
                </button>
                <button onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  Закрыть
                </button>
              </div>
              {expiresAt && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  Ссылка действует до {new Date(expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.
                  Если устарела — выдайте новую.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
