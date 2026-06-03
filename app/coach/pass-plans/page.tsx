'use client'
/**
 * /coach/pass-plans — Sprint W8 Day 38 (PR #56).
 *
 * Mirror of /coach/services (W7 Day 34) but for multi-session
 * subscriptions (`coach_pass_plans`). Coaches can sell packages
 * like "10 тренировок за 30 дней · 30000₽" through this UI.
 *
 * Schema diffs vs /coach/services:
 *   - price entered in whole RUB at form layer; stored as cents
 *   - 2 numeric fields: total_sessions + period_days
 *   - 4 service_type presets (training_pack default / monthly_access /
 *     group_pass / rehab_pack)
 *   - No format (online/offline/hybrid) — abonement format is implicit
 *   - No updated_at column (don't display "обновлено N")
 *
 * Marketplace already lists both via listOfferings (W6 Day 32) — no
 * marketplace changes needed here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyPassPlans, createPassPlan, updatePassPlan, archivePassPlan,
  reactivatePassPlan, deletePassPlan,
  PASS_SERVICE_TYPE_META,
  type CoachPassPlan, type PassServiceType,
} from '@/services/coach-pass-plans.service'
import { Card, Badge, Alert } from '@/components/ui/metronic'

type FilterTab = 'active' | 'archived' | 'all'

interface EditState {
  mode: 'create' | 'edit'
  id?: string
  title: string
  description: string
  total_sessions: number
  period_days: number
  price_rub: number
  service_type: PassServiceType
  seller_specialty: string
}

const EMPTY_EDIT: EditState = {
  mode:             'create',
  title:            '',
  description:      '',
  total_sessions:   10,
  period_days:      30,
  price_rub:        15000,
  service_type:     'training_pack',
  seller_specialty: '',
}

function fmtMoneyFromCents(cents: number, currency = 'RUB'): string {
  const rub = cents / 100
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(rub)
  } catch { return `${rub} ${currency}` }
}

function fmtPerSession(cents: number, sessions: number, currency = 'RUB'): string {
  if (sessions <= 0) return '—'
  const perSession = Math.round((cents / 100) / sessions)
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(perSession)
  } catch { return `${perSession} ${currency}` }
}

export default function CoachPassPlansPage() {
  const { user, loading: userLoading } = useUser()
  const [plans, setPlans]       = useState<CoachPassPlan[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterTab>('active')

  const [editor, setEditor]     = useState<EditState | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listMyPassPlans()
    setPlans(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user || (user.role !== 'coach')) {
      setLoading(false); return
    }
    load()
  }, [user, userLoading, load])

  function openCreate() {
    setFormError(null)
    setEditor({ ...EMPTY_EDIT })
  }
  function openEdit(p: CoachPassPlan) {
    setFormError(null)
    setEditor({
      mode:             'edit',
      id:               p.id,
      title:            p.title,
      description:      p.description ?? '',
      total_sessions:   p.total_sessions,
      period_days:      p.period_days,
      price_rub:        Math.round(p.price_cents / 100),
      service_type:     p.service_type,
      seller_specialty: p.seller_specialty ?? '',
    })
  }
  function closeEditor() { setEditor(null); setFormError(null) }
  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSubmit() {
    if (!editor) return
    setFormError(null)
    if (editor.title.trim().length < 3) { setFormError('Минимум 3 символа в названии'); return }
    if (editor.title.trim().length > 120) { setFormError('Максимум 120 символов в названии'); return }
    if (!Number.isInteger(editor.total_sessions) || editor.total_sessions < 1 || editor.total_sessions > 365) {
      setFormError('Количество сессий: 1-365'); return
    }
    if (!Number.isInteger(editor.period_days) || editor.period_days < 1) {
      setFormError('Период: минимум 1 день'); return
    }
    if (editor.period_days < editor.total_sessions) {
      setFormError('Период короче количества сессий — нельзя'); return
    }
    if (!Number.isFinite(editor.price_rub) || editor.price_rub < 0 || editor.price_rub > 1_000_000) {
      setFormError('Цена: 0 до 1 000 000 ₽'); return
    }

    setSaving(true)
    try {
      const payload = {
        title:            editor.title,
        description:      editor.description || null,
        total_sessions:   editor.total_sessions,
        period_days:      editor.period_days,
        price_rub:        editor.price_rub,
        service_type:     editor.service_type,
        seller_specialty: editor.seller_specialty || null,
      }
      const result = editor.mode === 'create'
        ? await createPassPlan(payload)
        : editor.id ? await updatePassPlan(editor.id, payload) : null
      if (!result) {
        setFormError(`Не удалось ${editor.mode === 'create' ? 'создать' : 'обновить'} абонемент. Проверьте роль и поля.`)
        return
      }
      showToast(true, editor.mode === 'create' ? 'Абонемент создан' : 'Изменения сохранены')
      closeEditor()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Скрыть абонемент из каталога?')) return
    setBusyId(id)
    try {
      const ok = await archivePassPlan(id)
      showToast(ok, ok ? 'Абонемент скрыт' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }
  async function handleReactivate(id: string) {
    setBusyId(id)
    try {
      const ok = await reactivatePassPlan(id)
      showToast(ok, ok ? 'Абонемент снова в каталоге' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }
  async function handleDelete(id: string) {
    if (!confirm('Удалить абонемент навсегда? Это действие нельзя отменить.')) return
    setBusyId(id)
    try {
      const ok = await deletePassPlan(id)
      showToast(ok, ok ? 'Абонемент удалён' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }

  const filtered = useMemo(() => {
    if (filter === 'active')   return plans.filter(p => p.is_active)
    if (filter === 'archived') return plans.filter(p => !p.is_active)
    return plans
  }, [plans, filter])

  const counts = useMemo(() => ({
    active:   plans.filter(p => p.is_active).length,
    archived: plans.filter(p => !p.is_active).length,
    all:      plans.length,
  }), [plans])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user || (user.role !== 'coach')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ тренера</p>
        <Link href="/dashboard" className="text-sm text-orange-600 font-semibold hover:underline">← На главную</Link>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Тренер · Абонементы</p>
          <h1 className="text-3xl font-bold text-navy-500">Coach Pass Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Создавайте абонементы для marketplace: пакеты тренировок, безлимит на месяц, групповые блоки.
            Также см. одноразовые услуги в <Link href="/coach/services" className="text-orange-600 font-semibold hover:underline">/coach/services</Link>.
          </p>
        </div>
        <button onClick={openCreate}
          className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 text-sm font-bold shadow-md inline-flex items-center gap-1.5">
          <i className="ki-filled ki-plus text-sm" />
          Создать абонемент
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['active', 'archived', 'all'] as FilterTab[]).map(t => {
          const active = filter === t
          const label = t === 'active' ? 'Активные' : t === 'archived' ? 'Архив' : 'Все'
          return (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                active
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-border bg-background hover:border-orange-200 text-muted-foreground'
              }`}>
              {label} · {counts[t]}
            </button>
          )
        })}
      </div>

      {/* Plans list */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-cup text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-navy-500">
            {filter === 'archived' ? 'В архиве пусто' : 'Абонементов пока нет'}
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте первый абонемент — например, «10 тренировок за 30 дней — 30 000 ₽».
            Атлеты смогут купить его через marketplace.
          </p>
          {filter !== 'archived' && (
            <button onClick={openCreate}
              className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold">
              + Создать первый абонемент
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(p => {
            const tm = PASS_SERVICE_TYPE_META[p.service_type]
            return (
              <Card key={p.id}
                className={`p-4 ${p.is_active ? '' : 'border-dashed bg-accent/30 opacity-75'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge variant="primary" size="sm" className="uppercase tracking-wider">
                        {tm.emoji} {tm.label}
                      </Badge>
                      <Badge variant="secondary" size="sm" className="uppercase tracking-wider bg-violet-50 text-violet-700">
                        {p.total_sessions} сессий
                      </Badge>
                      <Badge variant="info" size="sm" className="uppercase tracking-wider">
                        {p.period_days} дн
                      </Badge>
                      {!p.is_active && (
                        <Badge variant="secondary" size="sm" className="uppercase tracking-wider">
                          Архив
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-navy-500 truncate">{p.title}</h3>
                    {p.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-2xl font-bold text-foreground">{fmtMoneyFromCents(p.price_cents, p.currency)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      ≈ {fmtPerSession(p.price_cents, p.total_sessions, p.currency)}/сессию
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border">
                  <button onClick={() => openEdit(p)} disabled={busyId === p.id}
                    className="rounded-lg border border-border bg-background hover:bg-muted text-foreground px-3 py-1.5 text-xs font-semibold">
                    Редактировать
                  </button>
                  {p.is_active ? (
                    <button onClick={() => handleArchive(p.id)} disabled={busyId === p.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-semibold">
                      Скрыть
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleReactivate(p.id)} disabled={busyId === p.id}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 text-xs font-semibold">
                        Восстановить
                      </button>
                      <button onClick={() => handleDelete(p.id)} disabled={busyId === p.id}
                        className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-semibold">
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={closeEditor}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-500">
                {editor.mode === 'create' ? 'Новый абонемент' : 'Редактировать абонемент'}
              </h3>
              <button onClick={closeEditor} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground" aria-label="Закрыть">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Название *</label>
                <input type="text" value={editor.title}
                  onChange={e => setEditor({ ...editor, title: e.target.value })}
                  placeholder="Например: 10 тренировок за месяц"
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <p className="mt-1 text-[10px] text-muted-foreground">{editor.title.length}/120</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Тип абонемента</label>
                <select value={editor.service_type}
                  onChange={e => setEditor({ ...editor, service_type: e.target.value as PassServiceType })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-orange-400">
                  {(Object.entries(PASS_SERVICE_TYPE_META) as Array<[PassServiceType, typeof PASS_SERVICE_TYPE_META[PassServiceType]]>).map(([k, v]) =>
                    <option key={k} value={k}>{v.emoji} {v.label} — {v.hint}</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Сессий *</label>
                  <input type="number" value={editor.total_sessions}
                    onChange={e => setEditor({ ...editor, total_sessions: Number.parseInt(e.target.value, 10) || 0 })}
                    min={1} max={365} step={1}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 pf-num" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Период (дней) *</label>
                  <input type="number" value={editor.period_days}
                    onChange={e => setEditor({ ...editor, period_days: Number.parseInt(e.target.value, 10) || 0 })}
                    min={1} max={3650} step={1}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 pf-num" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Цена (RUB) *</label>
                <input type="number" value={editor.price_rub}
                  onChange={e => setEditor({ ...editor, price_rub: Number.parseInt(e.target.value, 10) || 0 })}
                  min={0} max={1000000} step={500}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 pf-num" />
                {editor.total_sessions > 0 && editor.price_rub > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    ≈ {Math.round(editor.price_rub / editor.total_sessions).toLocaleString('ru-RU')} ₽/сессию
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Описание</label>
                <textarea value={editor.description}
                  onChange={e => setEditor({ ...editor, description: e.target.value })}
                  rows={4} maxLength={1000}
                  placeholder="Что входит в абонемент? Формат сессий, периодичность, что получит атлет."
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 resize-vertical" />
                <p className="mt-1 text-[10px] text-muted-foreground">{editor.description.length}/1000</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Специализация (опц.)</label>
                <input type="text" value={editor.seller_specialty}
                  onChange={e => setEditor({ ...editor, seller_specialty: e.target.value })}
                  placeholder="Например: марафон, плавание, силовой тренинг"
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {formError && (
                <Alert variant="destructive">{formError}</Alert>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button onClick={handleSubmit} disabled={saving || editor.title.trim().length < 3}
                className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Сохраняем…' : (editor.mode === 'create' ? 'Создать' : 'Сохранить')}
              </button>
              <button onClick={closeEditor} disabled={saving}
                className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[99] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg"
          style={toast.ok
            ? { background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }
            : { background: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
