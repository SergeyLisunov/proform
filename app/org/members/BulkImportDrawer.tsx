'use client'
/**
 * BulkImportDrawer — Sprint W3 Day 16 (PR #31).
 *
 * CSV → batch email invitations to org. Mirrors the visual style of
 * InviteDrawer (in page.tsx) so the two entry points feel cohesive.
 *
 * Flow:
 *   1. Pick role (athlete / coach)
 *   2. Paste CSV OR upload .csv file
 *   3. Live preview shows parsed rows (uses /lib/csv/parse — same parser
 *      as the server, so what user sees == what server processes)
 *   4. Optional message included in every email
 *   5. Submit → POST /api/org/bulk-invite → render summary
 *
 * No tokenized claim here — the bulk endpoint creates email_invites with
 * connection_type='org_athlete'/'org_coach', and the existing /invite/:token
 * page handles the rest.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { parseCsv, isValidEmail } from '@/lib/csv/parse'
import { Accordion } from '@/components/ui/metronic'

type MemberRole = 'athlete' | 'coach'

const ROLE_CFG = {
  athlete: { label: 'Атлет',  icon: 'ki-abstract-26',  color: '#F35703', bg: '#FFF7ED', border: '#FED7AA' },
  coach:   { label: 'Тренер', icon: 'ki-notepad-edit', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

interface ApiSummary {
  parsed: number
  invited: number
  skipped_member: number
  skipped_self: number
  invalid_email: number
  failed: number
  email_sent: number
}

interface ApiDetail {
  email: string
  line: number
  status: 'invited' | 'skipped_member' | 'skipped_self' | 'invalid_email' | 'failed'
  reason?: string
}

interface ApiResponse {
  ok: true
  summary: ApiSummary
  details: ApiDetail[]
}

const SAMPLE_CSV = `email,name
ivan@example.com,Иван Петров
maria@example.com,Мария Иванова
sergei@example.com,Сергей Новиков`

export function BulkImportDrawer({ onClose, onComplete }: {
  onClose: () => void
  onComplete: (summary: ApiSummary) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [role, setRole]     = useState<MemberRole>('athlete')
  const [csvText, setCsv]   = useState('')
  const [message, setMsg]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Mount + escape handling ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  // ── Live preview (client-side using same parser as the server) ──────
  const preview = useMemo(() => {
    if (!csvText.trim()) return null
    const parsed = parseCsv(csvText)
    // Dedup within file
    const seen = new Set<string>()
    const unique: typeof parsed.rows = []
    let dupes = 0
    for (const r of parsed.rows) {
      if (seen.has(r.email)) { dupes++; continue }
      seen.add(r.email)
      unique.push(r)
    }
    const invalid = unique.filter(r => !isValidEmail(r.email)).length
    const valid   = unique.length - invalid
    return { rows: unique, valid, invalid, dupes, separator: parsed.separator }
  }, [csvText])

  // ── File upload ─────────────────────────────────────────────────────
  function handleFile(file: File | null | undefined) {
    if (!file) return
    if (!/\.csv$|\.txt$/i.test(file.name) && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setErr('Поддерживаются только .csv / .txt файлы')
      return
    }
    if (file.size > 256 * 1024) {
      setErr('Файл слишком большой (макс 256 КБ)')
      return
    }
    setErr('')
    file.text().then(t => setCsv(t)).catch(() => setErr('Не удалось прочитать файл'))
  }

  // ── Submit ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!preview || preview.valid === 0) {
      setErr('Нет валидных адресов для отправки')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/org/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: csvText,
          member_role: role,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(typeof data?.error === 'string' ? errorLabel(data.error) : 'Ошибка отправки')
        return
      }
      setResult(data as ApiResponse)
      onComplete((data as ApiResponse).summary)
    } catch {
      setErr('Сеть недоступна. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', opacity: visible ? 1 : 0, transition: 'opacity 0.26s' }} />

      {/* Drawer */}
      <div style={{ position: 'relative', width: 560, maxWidth: '100vw', height: '100%', background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)', boxShadow: '-12px 0 48px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#2563EB,#1E40AF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ki-filled ki-cloud-add text-white text-base" />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Импорт CSV</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>Массовое приглашение</h2>
            </div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {result ? (
            <ResultPanel result={result} />
          ) : (
            <>
              {/* Role */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Роль приглашаемых</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['athlete', 'coach'] as MemberRole[]).map(r => {
                    const cfg = ROLE_CFG[r]; const sel = role === r
                    return (
                      <button key={r} type="button" onClick={() => setRole(r)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                        borderRadius: 14, border: `2px solid ${sel ? cfg.border : 'var(--border)'}`,
                        background: sel ? cfg.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                          <i className={`ki-filled ${cfg.icon} text-sm`} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: sel ? cfg.color : 'var(--foreground)' }}>{cfg.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r === 'athlete' ? 'Тренировки, метрики' : 'Наблюдение, пометки'}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* CSV input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    CSV-данные
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setCsv(SAMPLE_CSV)}
                      style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Пример
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: 11, fontWeight: 600, color: '#F35703', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Загрузить .csv
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
                      onChange={e => handleFile(e.target.files?.[0])} />
                  </div>
                </div>
                <textarea value={csvText} onChange={e => setCsv(e.target.value)}
                  placeholder={'email,name\nivan@example.com,Иван Петров\nmaria@example.com,Мария Иванова'}
                  rows={8}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: '12px 14px', fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace', outline: 'none', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box', resize: 'vertical', minHeight: 140 }}
                />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5, lineHeight: 1.5 }}>
                  Формат: одна почта на строку. Опционально вторая колонка с именем. Разделитель — запятая, точка с запятой или таб (определяется автоматически).
                </p>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--accent)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>Будет отправлено: {preview.valid}</span>
                      {preview.invalid > 0 && (
                        <span style={{ color: '#DC2626' }}>· неверных {preview.invalid}</span>
                      )}
                      {preview.dupes > 0 && (
                        <span style={{ color: '#CA8A04' }}>· дубли {preview.dupes}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>
                      sep: {preview.separator === '\t' ? 'TAB' : preview.separator}
                    </span>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--background)' }}>
                    {preview.rows.slice(0, 50).map((r, idx) => {
                      const ok = isValidEmail(r.email)
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                          <span style={{ color: 'var(--muted-foreground)', fontFamily: 'monospace', width: 28, flexShrink: 0, fontSize: 10 }}>
                            #{r.raw_line}
                          </span>
                          <i className={`ki-filled ${ok ? 'ki-check-circle' : 'ki-cross-circle'}`} style={{ fontSize: 12, color: ok ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.email}
                          </span>
                          {r.name && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.name}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {preview.rows.length > 50 && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic', textAlign: 'center' }}>
                        … и ещё {preview.rows.length - 50}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Optional message */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
                  Сообщение в письме (необязательно)
                </label>
                <textarea value={message} onChange={e => setMsg(e.target.value)} rows={3}
                  placeholder="Например: «Добро пожаловать в команду Atlet Pro»"
                  maxLength={500}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: '11px 14px', fontSize: 13, outline: 'none', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box', resize: 'vertical' }}
                />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>
                  Будет показано в каждом приглашении · {message.length}/500
                </p>
              </div>

              {/* Error */}
              {err && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <i className="ki-filled ki-information-5 shrink-0" style={{ color: '#DC2626', marginTop: 1 }} />
                  {err}
                </div>
              )}

              {/* Info */}
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--accent)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <i className="ki-filled ki-information-5 shrink-0" style={{ color: '#2563EB', marginTop: 1 }} />
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.55 }}>
                  Каждый получит письмо со ссылкой-приглашением. Если у пользователя ещё нет аккаунта — он зарегистрируется по той же ссылке, и связь установится автоматически.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {result ? (
            <button onClick={handleClose} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#16A34A,#15803D)', color: 'white',
              fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(22,163,74,0.35)',
            }}>
              <i className="ki-filled ki-check text-sm mr-2" />Готово
            </button>
          ) : (
            <>
              <button type="button" onClick={handleSubmit} disabled={busy || !preview || preview.valid === 0} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12, border: 'none',
                cursor: (busy || !preview || preview.valid === 0) ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg,#2563EB,#1E40AF)', color: 'white',
                fontSize: 14, fontWeight: 700, opacity: (busy || !preview || preview.valid === 0) ? 0.5 : 1,
                transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
              }}>
                {busy
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Отправляю…</>
                  : <><i className="ki-filled ki-send text-sm" />Отправить {preview ? `(${preview.valid})` : ''}</>}
              </button>
              <button onClick={handleClose} style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Отмена
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Result panel ────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: ApiResponse }) {
  const s = result.summary
  const tiles = [
    { label: 'Приглашено',    value: s.invited,        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: 'ki-check-circle' },
    { label: 'Уже в команде', value: s.skipped_member, color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A', icon: 'ki-people' },
    { label: 'Невалидных',    value: s.invalid_email,  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'ki-cross-circle' },
    { label: 'Ошибок',        value: s.failed,         color: '#9333EA', bg: '#FAF5FF', border: '#E9D5FF', icon: 'ki-information-5' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero */}
      <div style={{ padding: '20px', borderRadius: 18, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #BBF7D0', textAlign: 'center' }}>
        <div style={{ fontSize: 28 }}>✉️</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#15803D', margin: '8px 0 4px' }}>
          {s.email_sent === s.invited && s.invited > 0 ? 'Все письма отправлены' : `Отправлено ${s.email_sent} из ${s.invited}`}
        </h3>
        <p style={{ fontSize: 13, color: '#16A34A', margin: 0 }}>
          Получатели увидят приглашение в почте в течение нескольких минут.
        </p>
      </div>

      {/* Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ padding: '12px 14px', borderRadius: 14, background: t.bg, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.color }} className="pf-num">{t.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.color, marginTop: 2 }}>{t.label}</div>
              </div>
              <i className={`ki-filled ${t.icon}`} style={{ fontSize: 22, color: t.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Failed details */}
      {result.details.some(d => d.status === 'failed' || d.status === 'invalid_email') && (
        <Accordion
          items={[{
            id: 'failed-rows',
            title: 'Подробности по проблемным строкам',
            content: (
              <div style={{ maxHeight: 200, overflowY: 'auto', margin: '0 -20px' }}>
                {result.details
                  .filter(d => d.status === 'failed' || d.status === 'invalid_email')
                  .map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 14px', fontSize: 11, fontFamily: 'monospace', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--muted-foreground)', width: 30 }}>#{d.line}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</span>
                      <span style={{ color: '#DC2626' }}>{d.status === 'invalid_email' ? 'не email' : (d.reason ?? 'ошибка')}</span>
                    </div>
                  ))}
              </div>
            ),
          }]}
        />
      )}
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

function errorLabel(code: string): string {
  switch (code) {
    case 'Unauthorized':       return 'Войдите в аккаунт'
    case 'forbidden_role':     return 'Доступно только роли «Организация»'
    case 'invalid_body':       return 'Неверный формат данных'
    case 'no_valid_rows':      return 'CSV не содержит ни одной валидной строки'
    case 'too_many_rows':      return 'Слишком много строк (максимум 500)'
    default:                   return code
  }
}
