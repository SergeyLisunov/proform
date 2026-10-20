'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/Icon'
import { invitedAsLabel } from '@/lib/connections/types'
import { roleMeta } from '@/lib/roles'

type ApiOk = {
  ok: true
  invite: { email: string; connection_type: string; message: string | null; expires_at: string }
  inviter: { id: string; name: string | null; nickname: string | null; role: string; avatar_url: string | null } | null
}
type ApiErr = { ok: false; error: string; email?: string }
type ClaimError = { error: string; requiredRole?: string }

const INVITE_STATE_TEXT: Record<string, string> = {
  not_found: 'Приглашение не найдено',
  expired:   'Срок действия приглашения истёк',
  claimed:   'Это приглашение уже принято',
  revoked:   'Приглашение отозвано',
}

/**
 * Кем подключается приглашённый. Направление считается от роли
 * пригласившего: одна связь specialist_athlete зовёт и спортсмена, и
 * специалиста, и подпись в одну сторону сбивала бы одного из них.
 */
function invitedAs(connectionType: string, inviterRole: string | null | undefined): string | null {
  if (connectionType === 'parent_link') return 'родителя / опекуна'
  return invitedAsLabel(connectionType, inviterRole)
}

function claimErrorText({ error, requiredRole }: ClaimError): string {
  if (error === 'role_mismatch') {
    return requiredRole
      ? `Приглашение для аккаунта с ролью «${roleMeta(requiredRole).label}» — войдите под таким аккаунтом`
      : 'Приглашение для аккаунта с другой ролью — войдите под подходящим аккаунтом'
  }
  if (error === 'self_referral_not_allowed') return 'Нельзя принять собственное приглашение'
  if (error === 'unauthorized') return 'Войдите, чтобы принять приглашение'
  return INVITE_STATE_TEXT[error] ?? 'Не удалось принять приглашение. Попробуйте ещё раз.'
}

function inviterName(i: ApiOk['inviter']): string {
  return i?.name?.trim() || i?.nickname?.trim() || 'Приглашающий'
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''

  const [state, setState] = useState<ApiOk | ApiErr | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ ok: true } | ({ ok: false } & ClaimError) | null>(null)

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
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; required_role?: string }
      if (res.ok && json.ok) {
        setClaimResult({ ok: true })
        setTimeout(() => router.push('/connections'), 1200)
      } else {
        setClaimResult({ ok: false, error: json.error ?? 'claim_failed', requiredRole: json.required_role })
      }
    } catch {
      setClaimResult({ ok: false, error: 'claim_failed' })
    } finally {
      setClaiming(false)
    }
  }

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-sm text-muted-foreground">Загружаем приглашение…</div>
      </main>
    )
  }

  if (!state.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <Icon name="ki-information-2" className="text-2xl" />
          </div>
          <h1 className="text-xl font-bold text-navy-500 mb-2">{INVITE_STATE_TEXT[state.error] ?? 'Ошибка'}</h1>
          <p className="text-sm text-muted-foreground mb-6">Свяжитесь с тем, кто отправил вам это приглашение, чтобы получить новую ссылку.</p>
          <button onClick={() => router.push('/')} className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">На главную</button>
        </div>
      </main>
    )
  }

  const name = inviterName(state.inviter)
  const inviterRole = state.inviter?.role ?? null
  const joinAs = invitedAs(state.invite.connection_type, inviterRole)

  if (claimResult?.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
            <Icon name="ki-check-circle" className="text-2xl" />
          </div>
          <h1 className="text-xl font-bold text-navy-500 mb-2">Связь установлена</h1>
          <p className="text-sm text-muted-foreground">Переходим к списку подключений…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600 mb-3">Sporteo · Приглашение</p>
        <h1 className="text-2xl font-bold text-navy-500 mb-1">Вас приглашают</h1>
        <p className="text-sm text-muted-foreground mb-6">
          <strong className="text-foreground">{name}</strong>
          {inviterRole && <> ({roleMeta(inviterRole).label.toLowerCase()})</>}
          {' '}приглашает вас подключиться
          {joinAs
            ? <> в качестве <span className="text-foreground font-semibold">{joinAs}</span>.</>
            : <> в Sporteo.</>}
        </p>

        {state.invite.message && (
          <div className="rounded-xl bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 whitespace-pre-wrap text-sm text-orange-900">
            {state.invite.message}
          </div>
        )}

        <div className="rounded-xl border border-border bg-background p-4 mb-6 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-semibold">{state.invite.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Действительно до:</span><span className="font-semibold">{new Date(state.invite.expires_at).toLocaleDateString('ru-RU')}</span></div>
          {/* Регистрация роль из приглашения не подставляет — подсказываем,
              какой аккаунт нужен, иначе принятие упадёт на role_mismatch. */}
          {joinAs && state.invite.connection_type !== 'parent_link' && (
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Принять можно:</span><span className="font-semibold text-right">из аккаунта {joinAs}</span></div>
          )}
        </div>

        {signedIn === null ? (
          <div className="text-xs text-muted-foreground text-center py-4">Проверяем статус…</div>
        ) : signedIn ? (
          <button onClick={handleAccept} disabled={claiming} aria-busy={claiming}
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
          <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
            {claimErrorText(claimResult)}
          </div>
        )}
      </div>
    </main>
  )
}
