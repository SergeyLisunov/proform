'use client'
/**
 * /org/health — Sprint W11 Day 54 (PR #75).
 *
 * Org Health Snapshot — sales-ready one-pager showing the organization's
 * state at a glance. Three audiences:
 *   1. Org owner: «как мы выглядим» summary
 *   2. Sales prospect: shareable demo report forwarded by sales rep
 *   3. Decision-maker (GM/board): one-page evidence of platform value
 *
 * Lead-gen lever: the «Поделиться отчётом» button copies the page URL
 * for forward via email/Telegram. Future enhancement (W12+): public
 * preview URL `/org/[slug]/health-preview` for unauthenticated viewing.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  getOrgHealthSnapshot,
  type OrgHealthSnapshot, type RiskBucket,
} from '@/services/org-snapshot.service'

const RISK_META: Record<RiskBucket, { label: string; color: string; bg: string }> = {
  low:      { label: 'В норме',  color: '#16A34A', bg: '#F0FDF4' },
  moderate: { label: 'Умеренный', color: '#D97706', bg: '#FFFBEB' },
  high:     { label: 'Высокий',  color: '#EA580C', bg: '#FFF7ED' },
  critical: { label: 'Критич.',  color: '#DC2626', bg: '#FEF2F2' },
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export default function OrgHealthPage() {
  const { user, loading: userLoading } = useUser()
  const [snapshot, setSnapshot] = useState<OrgHealthSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareToast, setShareToast] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    let cancelled = false
    void (async () => {
      const data = await getOrgHealthSnapshot()
      if (cancelled) return
      setSnapshot(data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user, userLoading])

  useEffect(() => {
    if (!shareToast) return
    const t = setTimeout(() => setShareToast(null), 2500)
    return () => clearTimeout(t)
  }, [shareToast])

  const onShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareToast('Ссылка скопирована')
    } catch {
      setShareToast('Не удалось скопировать — используйте адресную строку')
    }
  }, [])

  // W12 Day 59: trigger native print (browser «Save as PDF» pipeline).
  // Print stylesheet in globals.css hides interactive controls + forces
  // exact colors so gradients/risk bars survive.
  const onDownloadPdf = useCallback(() => {
    if (typeof window === 'undefined') return
    window.print()
  }, [])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 px-4 text-center">
        <p className="text-sm font-semibold text-foreground">Войдите чтобы увидеть Health Snapshot</p>
        <Link href="/auth/login" className="text-sm text-orange-600 font-semibold hover:underline">→ Войти</Link>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 px-4 text-center">
        <i className="ki-filled ki-office-bag text-3xl text-muted-foreground mb-1" />
        <p className="text-sm font-semibold text-foreground">Health Snapshot недоступен</p>
        <p className="text-xs text-muted-foreground max-w-md">
          Вы не привязаны к организации. Создайте организацию или попросите owner'а добавить вас в состав.
        </p>
        <Link href="/org" className="text-sm text-orange-600 font-semibold hover:underline">→ Перейти к организациям</Link>
      </div>
    )
  }

  const riskTotal = snapshot.risk.total
  const segments: { bucket: RiskBucket; count: number; pct: number }[] =
    (['low', 'moderate', 'high', 'critical'] as RiskBucket[])
      .map(b => ({
        bucket: b,
        count: snapshot.risk[b],
        pct: riskTotal > 0 ? (snapshot.risk[b] / riskTotal) * 100 : 0,
      }))

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div className="mb-1 print-hide">
        <Link href="/org"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          К организации
        </Link>
      </div>

      {/* W12 Day 59: print-only watermark banner (hidden on screen) */}
      <div className="print-only" style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #1D4ED8' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>
          ProForm · Health Snapshot
        </p>
        <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>
          Сгенерировано для «{snapshot.org_name}» · {new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Данные защищены RLS
        </p>
      </div>

      {/* Hero */}
      <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-2xs font-bold uppercase tracking-[0.24em] text-blue-700 mb-1">Health Snapshot</p>
            <h1 className="text-3xl font-bold text-foreground truncate">{snapshot.org_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Краткий портрет состояния организации на сегодня. Используйте для еженедельных
              обзоров и для переговоров со спонсорами / руководством.
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Создан {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 print-hide">
            <button
              onClick={onShare}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold shadow-sm"
              title="Скопировать ссылку — recipient видит ту же страницу, если у него доступ к организации"
            >
              <i className="ki-filled ki-copy text-sm" />
              Поделиться отчётом
            </button>
            <button
              onClick={onDownloadPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-blue-200 bg-card hover:bg-blue-50 text-blue-700 px-4 py-2.5 text-sm font-bold"
              title="Открывает диалог печати браузера — выберите «Сохранить как PDF»"
            >
              <i className="ki-filled ki-printer text-sm" />
              Скачать PDF
            </button>
          </div>
        </div>
      </section>

      {/* Members snapshot */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Всего участников', value: snapshot.members_total, icon: 'ki-people',         bg: 'bg-slate-50 text-slate-600' },
          { label: 'Атлеты',           value: snapshot.athletes_total, icon: 'ki-running-shoes', bg: 'bg-orange-50 text-orange-600' },
          { label: 'Тренеры',          value: snapshot.coaches_total,  icon: 'ki-cup',           bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Врачи',            value: snapshot.doctors_total,  icon: 'ki-medical-clinic', bg: 'bg-red-50 text-red-600' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="pf-num text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mt-1">{s.label}</div>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                <i className={`ki-filled ${s.icon} text-base`} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Risk distribution */}
      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Распределение риска</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              Готовность атлетов
              {snapshot.avg_recovery !== null && (
                <span className="ml-2 pf-num text-base font-normal text-emerald-700">{snapshot.avg_recovery}% средний</span>
              )}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Данные собраны по</div>
            <div className="pf-num text-sm font-semibold text-foreground">
              {snapshot.risk.total} {pluralize(snapshot.risk.total, ['атлет', 'атлета', 'атлетов'])}
            </div>
            {snapshot.risk.no_data > 0 && (
              <div className="text-[10px] text-muted-foreground">
                + {snapshot.risk.no_data} без данных
              </div>
            )}
          </div>
        </div>

        {riskTotal === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Нет метрик готовности. Атлеты ещё не передавали данные — попросите их связать устройства или вручную заполнить wellness check-in.
            </p>
          </div>
        ) : (
          <>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
              {segments.map(s => s.pct > 0 && (
                <div
                  key={s.bucket}
                  style={{ width: `${s.pct}%`, background: RISK_META[s.bucket].color }}
                  title={`${RISK_META[s.bucket].label}: ${s.count}`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {segments.map(s => (
                <div key={s.bucket}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2"
                  style={{ borderColor: s.count > 0 ? `${RISK_META[s.bucket].color}40` : undefined }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_META[s.bucket].color }} />
                    <span className="text-[11px] font-semibold text-muted-foreground">{RISK_META[s.bucket].label}</span>
                  </div>
                  <div className="pf-num text-lg font-bold text-foreground">
                    {s.count}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      ({Math.round(s.pct)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Adherence */}
      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Активность</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Атлеты с тренировкой за 7 дней</h2>
          </div>
          <div className="text-right">
            <div className="pf-num text-4xl font-bold text-foreground leading-none">{snapshot.adherence_pct}%</div>
          </div>
        </div>
        {snapshot.athletes_total === 0 ? (
          <p className="text-sm text-muted-foreground">В организации ещё нет атлетов.</p>
        ) : (
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${snapshot.adherence_pct}%`,
                background: snapshot.adherence_pct >= 70 ? '#16A34A'
                  : snapshot.adherence_pct >= 40 ? '#F59E0B' : '#DC2626',
              }}
            />
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {snapshot.adherence_pct >= 70
            ? 'Высокая вовлечённость. Поддерживайте текущий ритм коммуникации.'
            : snapshot.adherence_pct >= 40
              ? 'Половина состава активна. Поставьте напоминание тренерам прозвонить остальных.'
              : 'Большинство атлетов выпадают — план реактивации обязателен.'}
        </p>
      </section>

      {/* Coach utilization */}
      {snapshot.coach_utilization.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
          <div className="mb-3">
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Загрузка тренеров</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Кто сколько ведёт</h2>
          </div>
          <div className="space-y-2">
            {snapshot.coach_utilization.slice(0, 8).map(c => (
              <div key={c.coach_id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
                <div className="w-9 h-9 rounded-2xl bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700 overflow-hidden shrink-0">
                  {c.coach_avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.coach_avatar_url} alt="" className="w-full h-full object-cover" />
                    : (c.coach_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <Link href={`/profile/${c.coach_id}`} className="flex-1 min-w-0 text-sm font-semibold text-foreground hover:text-orange-700 truncate no-underline">
                  {c.coach_name ?? 'Тренер'}
                </Link>
                <div className="pf-num text-sm font-bold text-foreground">
                  {c.athletes_count}
                  <span className="text-[11px] text-muted-foreground font-normal ml-1">
                    {pluralize(c.athletes_count, ['атлет', 'атлета', 'атлетов'])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="rounded-2xl border border-dashed border-border bg-background/70 px-5 py-4 text-[12px] text-muted-foreground leading-relaxed print-hide">
        <strong className="text-foreground">Health Snapshot</strong> — наглядный отчёт для еженедельных
        обзоров и переговоров. Перешлите ссылку owner'у клуба или board'у — данные доступны только тем,
        кто залогинен в организацию (RLS). Кнопка «Скачать PDF» открывает диалог печати —
        сохраните файл и отправьте по email.
      </section>

      {/* W12 Day 59: print-only footer */}
      <div className="print-only" style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 9, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
          Этот отчёт сгенерирован платформой ProForm. Полные данные доступны на proform-delta.vercel.app для авторизованных членов организации.
        </p>
      </div>

      {/* Toast */}
      {shareToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-md bg-blue-600 text-white">
          <i className="ki-filled ki-check-circle text-sm" />
          {shareToast}
        </div>
      )}
    </div>
  )
}
