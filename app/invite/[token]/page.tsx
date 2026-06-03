'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ApiOk = {
  ok: true
  invite: { email: string; connection_type: string; message: string | null; expires_at: string }
  inviter: { id: string; name: string | null; first_name: string | null; last_name: string | null; nickname: string | null; role: string; avatar_url: string | null } | null
}
type ApiErr = { ok: false; error: string; email?: string }

const TYPE_LABEL: Record<string, string> = {
  coach_athlete:  'Тренер → Атлет',
  org_coach:      'Организация → Тренер',
  org_athlete:    'Организация → Атлет',
  doctor_athlete: 'Врач → Атлет',
  coach_doctor:   'Тренер ↔ Врач',
  org_doctor:     'Организация ↔ Врач',
  admin_doctor:   'Админ → Врач',
}

function inviterName(i: ApiOk['inviter']): string {
  if (!i) return 'Приглашающий'
  return (i.name
    ?? [i.first_name, i.last_name].filter(Boolean).join(' ')
    ?? i.nickname
    ?? 'Приглашающий').trim() || 'Приглашающий'
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''

  const [state, setState] = useState<ApiOk | ApiErr | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ ok: true } | { ok: false; error: string } | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/invite/${token}`).then(r => r.json()).then(setState).catch(e => {
      setState({ ok: false, error: e instanceof Error ? e.message : String(e) })
    })
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => setSignedIn(!!data.user))
  }, [token])

  async function handleAccept() {
    if (signedIn === false) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`)
      return
    }
    setClaiming(true)
    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setClaimResult({ ok: true })
        setTimeout(() => router.push('/connections'), 1200)
      } else {
        setClaimResult({ ok: false, error: json.error ?? 'claim_failed' })
      }
    } finally {
      setClaiming(false)
    }
  }

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Загружаем приглашение…</div>
      </main>
    )
  }

  if (!state.ok) {
    const msg: Record<string, string> = {
      not_found: 'Приглашение не найдено',
      expired:   'Срок действия приглашения истёк',
      claimed:   'Это приглашение уже принято',
      revoked:   'Приглашение отозвано',
    }
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <i className="ki-filled ki-information-2 text-2xl"/>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{msg[state.error] ?? 'Ошибка'}</h1>
          <p className="text-sm text-muted-foreground mb-6">Свяжитесь с тем, кто отправил вам это приглашение, чтобы получить новую ссылку.</p>
          <button onClick={() => router.push('/')} className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">На главную</button>
        </div>
      </main>
    )
  }

  const name = inviterName(state.inviter)
  const type = TYPE_LABEL[state.invite.connection_type] ?? state.invite.connection_type

  if (claimResult?.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
            <i className="ki-filled ki-check-circle text-2xl"/>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Связь установлена</h1>
          <p className="text-sm text-muted-foreground">Переходим к списку подключений…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600 mb-3">Sporteo · Приглашение</p>
        <h1 className="text-2xl font-bold text-foreground mb-1">Вас приглашают</h1>
        <p className="text-sm text-muted-foreground mb-6">
          <strong className="text-foreground">{name}</strong> хочет подключиться с вами в роли <span className="text-foreground font-semibold">{type.toLowerCase()}</span>.
        </p>

        {state.invite.message && (
          <div className="rounded-xl bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 whitespace-pre-wrap text-sm text-orange-900">
            {state.invite.message}
          </div>
        )}

        <div className="rounded-xl border border-border bg-background p-4 mb-6 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-semibold">{state.invite.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Действительно до:</span><span className="font-semibold">{new Date(state.invite.expires_at).toLocaleDateString('ru-RU')}</span></div>
        </div>

        {signedIn === null ? (
          <div className="text-xs text-muted-foreground text-center py-4">Проверяем статус…</div>
        ) : signedIn ? (
          <button onClick={handleAccept} disabled={claiming}
            className="w-full rounded-xl bg-orange-500 text-white px-5 py-3 text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
            {claiming ? 'Принимаем…' : 'Принять приглашение'}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/auth/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`)}
              className="w-full rounded-xl bg-orange-500 text-white px-5 py-3 text-sm font-bold hover:bg-orange-600">
              Войти и принять
            </button>
            <button
              onClick={() => router.push(`/auth/register?redirectTo=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(state.invite.email)}`)}
              className="w-full rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold hover:bg-muted">
              Нет аккаунта — зарегистрироваться
            </button>
          </div>
        )}

        {claimResult && !claimResult.ok && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
            Ошибка: {claimResult.error}
          </div>
        )}
      </div>
    </main>
  )
}
