'use client'
import Link from 'next/link'
import { useRef } from 'react'

type Tab = { id: string; label: string; icon: string; color: string }

export function ProfileShell(props: {
  title: string
  subtitle: string
  roleBadge?: string
  /** 0–100. When defined, the header shows a "Заполнено N%" progress bar
   * matching the athlete settings page. Color shifts red < 40, orange < 80,
   * emerald otherwise. */
  completionPct?: number
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  avatarUrl: string | null
  uploadingAvatar: boolean
  onAvatarUpload: (file: File) => void
  onAvatarDelete: () => void
  saving: boolean
  saved: boolean
  saveError: string | null
  onSave: () => void
  children: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Same scale the athlete page uses, kept here so coach/doctor/org get
  // a visually identical progress bar without re-implementing it.
  const pct = props.completionPct
  const pctColor =
    pct == null ? null
      : pct < 40 ? '#DC2626'
      : pct < 80 ? '#F35703'
      : '#16A34A'

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          aria-label="Вернуться на главную"
          title="Вернуться на главную"
          className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground no-underline transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-500"
        >
          <i className="ki-filled ki-left text-[13px]" />
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Настройки
            </div>
            <h1 className="pf-num mt-2 flex flex-wrap items-center gap-3 text-[clamp(1.7rem,5vw,2rem)] leading-tight text-navy-500">
              {props.title}
              {props.roleBadge && (
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {props.roleBadge}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
          </div>

          {pct != null && pctColor != null && (
            <div className="w-full sm:w-[200px] shrink-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Заполнено
                </span>
                <span className="pf-num text-sm font-bold" style={{ color: pctColor }}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: pctColor }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs — wrap on narrow viewport (was flex flex-wrap; horizontal-scroll
          variant in PR #7 caused the bar to render empty for some users).
          Two-row wrap reads cleaner than off-screen tabs and matches the
          original athlete settings page. */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1">
        {props.tabs.map(t => {
          const active = t.id === props.activeTab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => props.onTabChange(t.id)}
              className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:min-w-[140px] sm:px-4 ${
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={active ? { color: t.color } : undefined}
            >
              <i className={`ki-filled ${t.icon} text-[14px]`} />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Avatar block */}
      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
            <i className="ki-filled ki-picture text-base text-orange-500" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Фото профиля
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
            {props.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                <i className="ki-filled ki-user" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-foreground">Загрузить фото</div>
            <div className="mt-0.5 text-xs text-muted-foreground">JPG, PNG или WebP · Макс. 2 МБ</div>
            <div className="mt-3 flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) props.onAvatarUpload(f)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              />
              <button
                type="button"
                disabled={props.uploadingAvatar}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600 hover:bg-orange-100 disabled:opacity-50"
              >
                <i className="ki-filled ki-picture text-xs" />
                {props.uploadingAvatar ? 'Загрузка…' : 'Выбрать файл'}
              </button>
              {props.avatarUrl && (
                <button
                  type="button"
                  onClick={props.onAvatarDelete}
                  className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      {props.children}

      {/* Save bar */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {props.saveError ? (
            <span className="text-red-600">{props.saveError}</span>
          ) : props.saved ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600">Сохранено <i className="ki-filled ki-check" /></span>
          ) : (
            'Не забудьте сохранить изменения'
          )}
        </div>
        <button
          type="button"
          onClick={props.onSave}
          disabled={props.saving}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {props.saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export function FormSection({
  title,
  icon,
  iconBg,
  iconColor,
  children,
}: {
  title: string
  icon: string
  iconBg: string
  iconColor: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <i className={`ki-filled ${icon} text-base`} style={{ color: iconColor }} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function Field(props: {
  label: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={props.full ? 'md:col-span-2' : undefined}>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {props.label}
      </label>
      {props.children}
      {props.hint && <p className="mt-1 text-[11px] text-muted-foreground">{props.hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      onChange={e => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className={inputClass}
    />
  )
}

export function TextArea(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={props.value}
      onChange={e => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 3}
      className={`${inputClass} resize-none`}
    />
  )
}

export function Select(props: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={props.value}
      onChange={e => props.onChange(e.target.value)}
      className={inputClass}
    >
      {props.options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Chips(props: {
  value: string[]
  options: { value: string; label: string }[]
  onChange: (v: string[]) => void
}) {
  const set = new Set(props.value)
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map(o => {
        const active = set.has(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              const next = new Set(set)
              if (active) next.delete(o.value); else next.add(o.value)
              props.onChange(Array.from(next))
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-border bg-background text-muted-foreground hover:border-orange-300 hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle(props: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{props.label}</div>
        {props.hint && <div className="mt-0.5 text-xs text-muted-foreground">{props.hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.value}
        onClick={() => props.onChange(!props.value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          props.value ? 'bg-orange-500' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            props.value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}
