'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/lib/hooks/useToast'

type Author = { id: string; name: string | null; nickname: string | null; avatar_url: string | null }

type Template = {
  id: string
  user_id: string
  name: string
  activity_type: string | null
  duration_min: number | null
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  author: Author | null
}

const ACTIVITY_OPTIONS = ['Бег', 'Велоспорт', 'Плавание', 'Силовые', 'Ходьба', 'Другое']

function authorLabel(a: Author | null): string {
  if (!a) return '—'
  return a.nickname || a.name || '—'
}

function toLocalISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TemplatesPage() {
  const { success, error } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [meId, setMeId]           = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [scope, setScope]         = useState<'all' | 'mine' | 'public'>('all')

  const [form, setForm] = useState({
    name: '',
    activity_type: '',
    duration_min: '',
    description: '',
    is_public: false,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [formOpen, setFormOpen]   = useState(false)

  const [applyFor, setApplyFor]   = useState<Template | null>(null)
  const [applyDate, setApplyDate] = useState(toLocalISO(new Date(Date.now() + 86400_000)))
  const [applyTime, setApplyTime] = useState('')
  const [applying, setApplying]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workout-templates?scope=${scope}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setTemplates(json.templates as Template[])
      // discover own id
      const meRes = await fetch('/api/workout-templates?scope=mine', { cache: 'no-store' })
      const meJson = await meRes.json()
      if (meJson.ok && meJson.templates.length > 0) setMeId(meJson.templates[0].user_id)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [scope, error])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ name: '', activity_type: '', duration_min: '', description: '', is_public: false })
    setEditingId(null)
    setFormOpen(false)
  }

  function openCreate() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(t: Template) {
    setForm({
      name: t.name,
      activity_type: t.activity_type ?? '',
      duration_min: t.duration_min?.toString() ?? '',
      description: t.description ?? '',
      is_public: t.is_public,
    })
    setEditingId(t.id)
    setFormOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        activity_type: form.activity_type || null,
        duration_min:  form.duration_min ? Number(form.duration_min) : null,
        description:   form.description.trim() || null,
        is_public:     form.is_public,
      }
      const res = editingId
        ? await fetch(`/api/workout-templates/${editingId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/workout-templates', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'SAVE_ERROR')
      success(editingId ? 'Шаблон обновлён' : 'Шаблон создан')
      resetForm()
      await load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Удалить шаблон «${t.name}»?`)) return
    try {
      const res = await fetch(`/api/workout-templates/${t.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'DELETE_ERROR')
      success('Шаблон удалён')
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  async function applyTemplate() {
    if (!applyFor || applying) return
    setApplying(true)
    try {
      const res = await fetch(`/api/workout-templates/${applyFor.id}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date: applyDate,
          time: applyTime || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'APPLY_ERROR')
      success('Добавлено в календарь')
      setApplyFor(null)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Шаблоны
            </div>
            <h1 className="pf-num text-[32px] leading-none text-foreground">Библиотека тренировок</h1>
            <p className="mt-2 max-w-[560px] text-sm text-muted-foreground">
              Сохраняйте любимые сессии, делитесь ими с публичной лентой или применяйте к календарю одной кнопкой.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="flex rounded-full border border-border bg-background p-1 text-xs font-semibold">
              {(['all', 'mine', 'public'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-full px-3 py-1.5 transition-all ${
                    scope === s ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'all' ? 'Все' : s === 'mine' ? 'Мои' : 'Публичные'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-orange-600"
            >
              + Новый шаблон
            </button>
          </div>
        </div>
      </section>

      {/* Form */}
      {formOpen && (
        <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
            <div className="md:col-span-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={160}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400"
                placeholder="Интервалы 5×1000"
              />
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Активность</label>
              <select
                value={form.activity_type}
                onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400"
              >
                <option value="">—</option>
                {ACTIVITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Длительность, мин</label>
              <input
                type="number"
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                min={1}
                max={600}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Описание / план</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400"
                placeholder="Разминка 10 мин, 5×1000м через 2 мин отдыха, заминка 10 мин..."
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              Опубликовать в общедоступной библиотеке
            </label>
            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:border-border/80"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="rounded-full bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? 'Сохраняю…' : editingId ? 'Сохранить изменения' : 'Создать шаблон'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* List */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <i className="ki-filled ki-notepad-edit text-[20px]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Шаблонов пока нет</p>
              <p className="mt-1 text-xs text-muted-foreground">Создайте первый — он появится в подсказках при добавлении тренировки.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map(t => {
              const own = meId === t.user_id
              return (
                <div
                  key={t.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 transition-all hover:border-orange-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                        {t.activity_type && <span>{t.activity_type}</span>}
                        {t.activity_type && t.duration_min && <span className="h-1 w-1 rounded-full bg-border" />}
                        {t.duration_min && <span>{t.duration_min} мин</span>}
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>{authorLabel(t.author)}</span>
                        {t.is_public && (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-700">Публичный</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {t.description && (
                    <p className="line-clamp-3 text-2xs leading-relaxed text-muted-foreground">{t.description}</p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setApplyFor(t); setApplyDate(toLocalISO(new Date(Date.now() + 86400_000))); setApplyTime('') }}
                      className="rounded-full bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600"
                    >
                      В календарь
                    </button>
                    {own && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:border-orange-200 hover:text-orange-600"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(t)}
                          className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50"
                        >
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
      </section>

      <div className="text-center text-xs text-muted-foreground">
        <Link href="/calendar" className="hover:text-foreground">Открыть календарь →</Link>
      </div>

      {/* Apply modal */}
      {applyFor && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/35 backdrop-blur-sm"
          onClick={() => !applying && setApplyFor(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Применить шаблон
            </div>
            <h3 className="mt-1 text-lg font-bold text-foreground">{applyFor.name}</h3>
            {applyFor.duration_min && (
              <p className="text-xs text-muted-foreground">{applyFor.duration_min} мин</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Дата</label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={e => setApplyDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Время</label>
                <input
                  type="time"
                  value={applyTime}
                  onChange={e => setApplyTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !applying && setApplyFor(null)}
                className="rounded-full border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:border-border/80"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={applyTemplate}
                disabled={applying}
                className="rounded-full bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {applying ? 'Добавляю…' : 'В календарь'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
