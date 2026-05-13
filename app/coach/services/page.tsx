'use client'
/**
 * /coach/services — Sprint W7 Day 34 (PR #52).
 *
 * Coach service builder UI. Marketplace's "coach onramp" — real
 * coaches can now create offerings without a migration. Pattern
 * matches /coach/inquiries (W5 Day 26): single page with list +
 * modal create/edit, no separate route shuffling.
 *
 * Layout:
 *   - Hero header with "Создать услугу" CTA
 *   - Filter tabs: Active | Archived | All
 *   - Cards: title, type/format badges, price, description preview,
 *     edit/archive/reactivate buttons
 *   - Modal: full form for create OR edit (same component, mode prop)
 *
 * RLS does the heavy lifting — service-layer just shapes input and
 * dispatches notifications (no notify needed here, marketplace is
 * pull-not-push).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyServices, createService, updateService, archiveService,
  reactivateService, deleteService,
  SERVICE_TYPE_META, FORMAT_META,
  type CoachService, type ServiceType, type ServiceFormat,
} from '@/services/coach-services.service'

type FilterTab = 'active' | 'archived' | 'all'

interface EditState {
  mode: 'create' | 'edit'
  id?: string
  title: string
  description: string
  price_amount: number
  duration_days: string   // user types string; convert on submit
  format: ServiceFormat | ''
  service_type: ServiceType
  seller_specialty: string
}

const EMPTY_EDIT: EditState = {
  mode:             'create',
  title:            '',
  description:      '',
  price_amount:     1000,
  duration_days:    '',
  format:           'online',
  service_type:     'consultation',
  seller_specialty: '',
}

function fmtMoney(v: number, currency = 'RUB'): string {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  } catch { return `${v} ${currency}` }
}

export default function CoachServicesPage() {
  const { user, loading: userLoading } = useUser()
  const [services, setServices] = useState<CoachService[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterTab>('active')

  const [editor, setEditor]     = useState<EditState | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listMyServices()
    setServices(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user || (user.role !== 'coach' && user.role !== 'trainer')) {
      setLoading(false); return
    }
    load()
  }, [user, userLoading, load])

  function openCreate() {
    setFormError(null)
    setEditor({ ...EMPTY_EDIT })
  }
  function openEdit(s: CoachService) {
    setFormError(null)
    setEditor({
      mode:             'edit',
      id:               s.id,
      title:            s.title,
      description:      s.description ?? '',
      price_amount:     s.price_amount,
      duration_days:    s.duration_days?.toString() ?? '',
      format:           s.format ?? '',
      service_type:     s.service_type,
      seller_specialty: s.seller_specialty ?? '',
    })
  }
  function closeEditor() {
    setEditor(null)
    setFormError(null)
  }
  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSubmit() {
    if (!editor) return
    setFormError(null)
    if (editor.title.trim().length < 3) { setFormError('Минимум 3 символа в названии'); return }
    if (editor.title.trim().length > 120) { setFormError('Максимум 120 символов в названии'); return }
    if (!Number.isFinite(editor.price_amount) || editor.price_amount < 0) { setFormError('Цена должна быть ≥ 0'); return }
    if (editor.price_amount > 10_000_000) { setFormError('Цена слишком большая'); return }
    const duration = editor.duration_days.trim()
      ? Number.parseInt(editor.duration_days, 10)
      : null
    if (duration !== null && (!Number.isFinite(duration) || duration < 1 || duration > 3650)) {
      setFormError('Длительность: 1-3650 дней или пусто')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title:            editor.title,
        description:      editor.description || null,
        price_amount:     editor.price_amount,
        duration_days:    duration,
        format:           editor.format || null,
        service_type:     editor.service_type,
        seller_specialty: editor.seller_specialty || null,
      }
      const result = editor.mode === 'create'
        ? await createService(payload)
        : editor.id ? await updateService(editor.id, payload) : null
      if (!result) {
        setFormError(`Не удалось ${editor.mode === 'create' ? 'создать' : 'обновить'} услугу. Проверьте роль (coach) и поля.`)
        return
      }
      showToast(true, editor.mode === 'create' ? 'Услуга создана' : 'Изменения сохранены')
      closeEditor()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Скрыть услугу из каталога?')) return
    setBusyId(id)
    try {
      const ok = await archiveService(id)
      showToast(ok, ok ? 'Услуга скрыта' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }

  async function handleReactivate(id: string) {
    setBusyId(id)
    try {
      const ok = await reactivateService(id)
      showToast(ok, ok ? 'Услуга снова в каталоге' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить услугу навсегда? Это действие нельзя отменить.')) return
    setBusyId(id)
    try {
      const ok = await deleteService(id)
      showToast(ok, ok ? 'Услуга удалена' : 'Ошибка')
      if (ok) await load()
    } finally { setBusyId(null) }
  }

  const filtered = useMemo(() => {
    if (filter === 'active')   return services.filter(s => s.is_active)
    if (filter === 'archived') return services.filter(s => !s.is_active)
    return services
  }, [services, filter])

  const counts = useMemo(() => ({
    active:   services.filter(s => s.is_active).length,
    archived: services.filter(s => !s.is_active).length,
    all:      services.length,
  }), [services])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user || (user.role !== 'coach' && user.role !== 'trainer')) {
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
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Тренер · Услуги</p>
          <h1 className="text-3xl font-bold text-foreground">Coach Services</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Создавайте offerings для marketplace: консультации, планы тренировок, оценки.
            Активные карточки появятся в каталоге <Link href="/marketplace" className="text-orange-600 font-semibold hover:underline">/marketplace</Link>.
          </p>
        </div>
        <button onClick={openCreate}
          className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 text-sm font-bold shadow-md inline-flex items-center gap-1.5">
          <i className="ki-filled ki-plus text-sm" />
          Создать услугу
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

      {/* Services list */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-shop text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {filter === 'archived' ? 'В архиве пусто' : 'Услуг пока нет'}
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте первое offering — например, разовую видео-консультацию на 60 минут.
            Атлеты смогут купить её через marketplace.
          </p>
          {filter !== 'archived' && (
            <button onClick={openCreate}
              className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold">
              + Создать первую услугу
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(s => {
            const tm = SERVICE_TYPE_META[s.service_type] ?? SERVICE_TYPE_META.general
            const fm = s.format ? FORMAT_META[s.format] : null
            return (
              <div key={s.id}
                className={`rounded-2xl border p-4 ${s.is_active ? 'border-border bg-card' : 'border-dashed border-border bg-accent/30 opacity-75'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {tm.emoji} {tm.label}
                      </span>
                      {fm && (
                        <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {fm.emoji} {fm.label}
                        </span>
                      )}
                      {s.duration_days && (
                        <span className="rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {s.duration_days} дн
                        </span>
                      )}
                      {!s.is_active && (
                        <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Архив
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground truncate">{s.title}</h3>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-2xl font-bold text-foreground">{fmtMoney(s.price_amount, s.currency)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Обновлено {new Date(s.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border">
                  <button onClick={() => openEdit(s)} disabled={busyId === s.id}
                    className="rounded-lg border border-border bg-background hover:bg-muted text-foreground px-3 py-1.5 text-xs font-semibold">
                    Редактировать
                  </button>
                  {s.is_active ? (
                    <button onClick={() => handleArchive(s.id)} disabled={busyId === s.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-semibold">
                      Скрыть
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleReactivate(s.id)} disabled={busyId === s.id}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 text-xs font-semibold">
                        Восстановить
                      </button>
                      <button onClick={() => handleDelete(s.id)} disabled={busyId === s.id}
                        className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-semibold">
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </div>
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
              <h3 className="text-lg font-semibold text-foreground">
                {editor.mode === 'create' ? 'Новая услуга' : 'Редактировать услугу'}
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
                  placeholder="Например: Видео-консультация · 60 мин"
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <p className="mt-1 text-[10px] text-muted-foreground">{editor.title.length}/120</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Тип</label>
                  <select value={editor.service_type}
                    onChange={e => setEditor({ ...editor, service_type: e.target.value as ServiceType })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-orange-400">
                    {(Object.entries(SERVICE_TYPE_META) as Array<[ServiceType, typeof SERVICE_TYPE_META[ServiceType]]>).map(([k, v]) =>
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Формат</label>
                  <select value={editor.format}
                    onChange={e => setEditor({ ...editor, format: e.target.value as ServiceFormat | '' })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-orange-400">
                    <option value="">— не указан —</option>
                    {(Object.entries(FORMAT_META) as Array<[ServiceFormat, typeof FORMAT_META[ServiceFormat]]>).map(([k, v]) =>
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Цена (RUB) *</label>
                  <input type="number" value={editor.price_amount}
                    onChange={e => setEditor({ ...editor, price_amount: Number.parseInt(e.target.value, 10) || 0 })}
                    min={0} max={10000000} step={100}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 pf-num" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Длительность (дни)</label>
                  <input type="number" value={editor.duration_days}
                    onChange={e => setEditor({ ...editor, duration_days: e.target.value })}
                    placeholder="например: 30"
                    min={1} max={3650}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 pf-num" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Описание</label>
                <textarea value={editor.description}
                  onChange={e => setEditor({ ...editor, description: e.target.value })}
                  rows={4} maxLength={1000}
                  placeholder="Что входит в услугу? Какой результат получит атлет? Сколько занимает по времени?"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 resize-vertical" />
                <p className="mt-1 text-[10px] text-muted-foreground">{editor.description.length}/1000</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Специализация (опц.)</label>
                <input type="text" value={editor.seller_specialty}
                  onChange={e => setEditor({ ...editor, seller_specialty: e.target.value })}
                  placeholder="Например: марафон, триатлон, силовая"
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
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
