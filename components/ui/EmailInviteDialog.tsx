'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { sendEmailInvite, type InviteConnectionType } from '@/services/email-invites.service'

type Role = 'athlete' | 'coach' | 'organization' | 'doctor' | 'admin'

/** Which connection_type options are valid for a given inviter role. */
const OPTIONS_BY_ROLE: Record<Role, Array<{ value: InviteConnectionType; label: string }>> = {
  coach:        [
    { value: 'coach_athlete', label: 'Атлета'    },
    { value: 'coach_doctor',  label: 'Врача'     },
  ],
  doctor:       [
    { value: 'doctor_athlete', label: 'Атлета'   },
    { value: 'coach_doctor',   label: 'Тренера'  },
  ],
  organization: [
    { value: 'org_athlete', label: 'Атлета'      },
    { value: 'org_coach',   label: 'Тренера'     },
    { value: 'org_doctor',  label: 'Врача'       },
  ],
  admin:        [
    { value: 'admin_doctor', label: 'Врача'      },
  ],
  athlete:      [
    // P2 tenant refactor #4a — first-class B2C athlete↔personal-trainer link.
    // The backend (/api/invite + /api/invite/[token]) already accepts these
    // combos from the athlete side via the symmetric role check; this just
    // enables the UI surface so an athlete can invite a personal coach/doctor
    // without going through an organization.
    { value: 'coach_athlete',  label: 'Тренера'  },
    { value: 'doctor_athlete', label: 'Врача'    },
    // #4b-iii — athlete invites a parent/guardian. parent_link is NOT a
    // connection_type pair (parent isn't a role); the claim route creates a
    // parent_links row instead of a connections row.
    { value: 'parent_link',    label: 'Родителя / опекуна' },
  ],
}

export function EmailInviteDialog({
  myRole, onClose, onSent,
}: {
  myRole: Role
  onClose: () => void
  onSent?: (token: string, url: string) => void
}) {
  const options = OPTIONS_BY_ROLE[myRole] ?? []
  const [email, setEmail] = useState('')
  const [connType, setConnType] = useState<InviteConnectionType>(options[0]?.value ?? 'coach_athlete')
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: true; url: string } | { ok: false; error: string } | null>(null)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const handleSubmit = async () => {
    setSending(true)
    const res = await sendEmailInvite({ email, connection_type: connType, message: message || null })
    setSending(false)
    if (res.ok) {
      setResult({ ok: true, url: res.url })
      onSent?.(res.token, res.url)
    } else {
      setResult({ ok: false, error: res.error })
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}/>
      <div
        onClick={e => e.stopPropagation()}
        className={`relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border transition-all ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Приглашение</p>
            <h3 className="text-lg font-semibold text-navy-500">По email</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        {result?.ok ? (
          <div className="px-5 py-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <i className="ki-filled ki-check text-lg"/>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Приглашение отправлено</div>
                <div className="text-xs text-muted-foreground">Ссылка скопирована ниже — можно также поделиться ею вручную.</div>
              </div>
            </div>
            <input readOnly value={result.url} onClick={e => (e.target as HTMLInputElement).select()}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono"/>
            <button onClick={handleClose}
              className="w-full rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-600">
              Готово
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {options.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Вашей роли нельзя создавать email-приглашения.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] text-orange-800">
                  <i className="ki-filled ki-gift text-[11px] text-orange-800" /> <strong>Бонус:</strong> за каждого принявшего — <strong>+1 месяц Pro</strong> вам
                  автоматически.
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Пригласить как</label>
                  <div className="mt-1 grid grid-cols-1 gap-1.5">
                    {options.map(o => (
                      <button key={o.value} type="button" onClick={() => setConnType(o.value)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                          connType === o.value
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-border bg-background text-muted-foreground hover:border-orange-200'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сообщение (опц.)</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                    placeholder="Пара слов — чтобы получатель понял от кого и зачем."
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
                </div>
                {result && !result.ok && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
                    Ошибка: {result.error}
                  </div>
                )}
                <button onClick={handleSubmit} disabled={sending || !email.trim() || !connType}
                  className="w-full rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Отправить приглашение'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
