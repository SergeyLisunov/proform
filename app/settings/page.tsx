'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── типы ──────────────────────────────────────────────────────────────────────

type AthleteProfile = {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  birth_date:            string | null
  gender:                string | null
  phone:                 string | null
  city:                  string | null
  country:               string | null
  bio:                   string | null
  height_cm:             number | null
  weight_kg:             number | null
  primary_sport:         string | null
  fitness_level:         string | null
  goal:                  string | null
  weekly_training_hours: number | null
  max_heart_rate:        number | null
  hrv_baseline:          number | null
  rhr_baseline:          number | null
  vo2max:                number | null
  profile_public:        boolean
  workouts_public:       boolean
}

type FormData = {
  first_name:            string
  last_name:             string
  birth_date:            string
  gender:                string
  phone:                 string
  email:                 string
  city:                  string
  country:               string
  bio:                   string
  height_cm:             string
  weight_kg:             string
  primary_sport:         string
  fitness_level:         string
  goal:                  string
  weekly_training_hours: string
  max_heart_rate:        string
  hrv_baseline:          string
  rhr_baseline:          string
  vo2max:                string
  profile_public:        boolean
  workouts_public:       boolean
}

// ── константы ──────────────────────────────────────────────────────────────────

const SPORTS = [
  'Бег', 'Велоспорт', 'Плавание', 'Триатлон', 'Силовые', 'Кроссфит',
  'Футбол', 'Баскетбол', 'Волейбол', 'Теннис', 'Лёгкая атлетика',
  'Лыжи', 'Борьба', 'Единоборства', 'Другое',
]

const FITNESS_LEVELS = [
  { value: 'beginner',     label: 'Новичок',         desc: 'Начинаю заниматься спортом' },
  { value: 'recreational', label: 'Любитель',         desc: 'Тренируюсь регулярно для удовольствия' },
  { value: 'competitive',  label: 'Соревновательный', desc: 'Участвую в соревнованиях' },
  { value: 'elite',        label: 'Элитный',          desc: 'Профессиональный спортсмен' },
]

const GOALS = [
  { value: 'health',       label: 'Здоровье и самочувствие' },
  { value: 'weight_loss',  label: 'Снижение веса' },
  { value: 'performance',  label: 'Улучшение результатов' },
  { value: 'competition',  label: 'Подготовка к соревнованиям' },
  { value: 'recovery',     label: 'Реабилитация' },
]

// ── утилиты ────────────────────────────────────────────────────────────────────

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate + 'T00:00:00')
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function profileToForm(p: AthleteProfile, email: string): FormData {
  return {
    first_name:            p.first_name            ?? '',
    last_name:             p.last_name             ?? '',
    birth_date:            p.birth_date            ?? '',
    gender:                p.gender                ?? '',
    phone:                 p.phone                 ?? '',
    email,
    city:                  p.city                  ?? '',
    country:               p.country               ?? '',
    bio:                   p.bio                   ?? '',
    height_cm:             p.height_cm             != null ? String(p.height_cm)             : '',
    weight_kg:             p.weight_kg             != null ? String(p.weight_kg)             : '',
    primary_sport:         p.primary_sport         ?? '',
    fitness_level:         p.fitness_level         ?? '',
    goal:                  p.goal                  ?? '',
    weekly_training_hours: p.weekly_training_hours != null ? String(p.weekly_training_hours) : '',
    max_heart_rate:        p.max_heart_rate        != null ? String(p.max_heart_rate)        : '',
    hrv_baseline:          p.hrv_baseline          != null ? String(p.hrv_baseline)          : '',
    rhr_baseline:          p.rhr_baseline          != null ? String(p.rhr_baseline)          : '',
    vo2max:                p.vo2max                != null ? String(p.vo2max)                : '',
    profile_public:        p.profile_public  ?? false,
    workouts_public:       p.workouts_public ?? false,
  }
}

function formToPayload(f: FormData, userId: string) {
  return {
    id:                    userId,
    first_name:            f.first_name   || null,
    last_name:             f.last_name    || null,
    birth_date:            f.birth_date   || null,
    gender:                f.gender       || null,
    phone:                 f.phone        || null,
    city:                  f.city         || null,
    country:               f.country      || null,
    bio:                   f.bio          || null,
    height_cm:             f.height_cm             ? parseFloat(f.height_cm)             : null,
    weight_kg:             f.weight_kg             ? parseFloat(f.weight_kg)             : null,
    primary_sport:         f.primary_sport         || null,
    fitness_level:         f.fitness_level         || null,
    goal:                  f.goal                  || null,
    weekly_training_hours: f.weekly_training_hours ? parseFloat(f.weekly_training_hours) : null,
    max_heart_rate:        f.max_heart_rate        ? parseInt(f.max_heart_rate, 10)      : null,
    hrv_baseline:          f.hrv_baseline          ? parseFloat(f.hrv_baseline)          : null,
    rhr_baseline:          f.rhr_baseline          ? parseFloat(f.rhr_baseline)          : null,
    vo2max:                f.vo2max                ? parseFloat(f.vo2max)                : null,
    profile_public:        f.profile_public,
    workouts_public:       f.workouts_public,
    updated_at:            new Date().toISOString(),
  }
}

// ── валидация ──────────────────────────────────────────────────────────────────

type Errors = Partial<Record<keyof FormData, string>>

function validate(f: FormData): Errors {
  const e: Errors = {}
  if (f.height_cm) {
    const v = parseFloat(f.height_cm)
    if (isNaN(v) || v < 100 || v > 250) e.height_cm = 'Рост: от 100 до 250 см'
  }
  if (f.weight_kg) {
    const v = parseFloat(f.weight_kg)
    if (isNaN(v) || v < 30 || v > 300) e.weight_kg = 'Вес: от 30 до 300 кг'
  }
  if (f.birth_date) {
    const d = new Date(f.birth_date)
    const now = new Date()
    if (isNaN(d.getTime())) e.birth_date = 'Неверный формат даты'
    else if (d > now) e.birth_date = 'Дата рождения не может быть в будущем'
    else if (now.getFullYear() - d.getFullYear() > 100) e.birth_date = 'Проверьте год рождения'
  }
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    e.email = 'Неверный формат email'
  }
  if (f.max_heart_rate) {
    const v = parseInt(f.max_heart_rate, 10)
    if (isNaN(v) || v < 100 || v > 250) e.max_heart_rate = 'ЧСС макс: от 100 до 250'
  }
  if (f.rhr_baseline) {
    const v = parseInt(f.rhr_baseline, 10)
    if (isNaN(v) || v < 30 || v > 120) e.rhr_baseline = 'ЧСС покоя: от 30 до 120'
  }
  if (f.hrv_baseline) {
    const v = parseFloat(f.hrv_baseline)
    if (isNaN(v) || v < 1 || v > 200) e.hrv_baseline = 'HRV: от 1 до 200'
  }
  if (f.vo2max) {
    const v = parseFloat(f.vo2max)
    if (isNaN(v) || v < 20 || v > 100) e.vo2max = 'VO2max: от 20 до 100'
  }
  if (f.weekly_training_hours) {
    const v = parseFloat(f.weekly_training_hours)
    if (isNaN(v) || v < 0 || v > 60) e.weekly_training_hours = 'Часов тренировок: от 0 до 60'
  }
  return e
}

// ── компоненты ─────────────────────────────────────────────────────────────────

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
        <i className={`ki-filled ${icon} text-orange-500 text-sm`} />
      </div>
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  )
}

function Field({
  label, name, type = 'text', value, onChange, error, placeholder, hint, min, max, step,
}: {
  label: string
  name: keyof FormData
  type?: string
  value: string
  onChange: (name: keyof FormData, value: string) => void
  error?: string
  placeholder?: string
  hint?: string
  min?: string
  max?: string
  step?: string
}) {
  return (
    <div>
      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={[
          'w-full px-3 py-2.5 rounded-xl border bg-background text-sm text-foreground',
          'placeholder:text-muted-foreground/50 outline-none transition-all',
          error
            ? 'border-red-400 focus:ring-2 focus:ring-red-200'
            : 'border-input focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10',
        ].join(' ')}
      />
      {error && <p className="text-2xs text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

function OptionGrid<T extends string>({
  label, options, value, onChange, cols = 2,
}: {
  label: string
  options: { value: T; label: string; desc?: string }[]
  value: T | ''
  onChange: (v: T | '') => void
  cols?: 2 | 3
}) {
  return (
    <div>
      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? '' as T : o.value)}
            className={[
              'flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all',
              value === o.value
                ? 'border-orange-400 bg-orange-50'
                : 'border-border hover:border-orange-200 hover:bg-accent/30',
            ].join(' ')}
          >
            <span className={`text-2xs font-semibold leading-tight ${value === o.value ? 'text-orange-600' : 'text-foreground'}`}>
              {o.label}
            </span>
            {o.desc && (
              <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{o.desc}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function BMICard({ height, weight }: { height: string; weight: string }) {
  const h = parseFloat(height)
  const w = parseFloat(weight)
  if (!h || !w || h < 100 || w < 30) return null
  const bmi = w / ((h / 100) ** 2)
  const category =
    bmi < 18.5 ? { label: 'Недостаточный вес', color: 'text-blue-600 bg-blue-50 border-blue-200' } :
    bmi < 25   ? { label: 'Норма',             color: 'text-green-600 bg-green-50 border-green-200' } :
    bmi < 30   ? { label: 'Избыточный вес',    color: 'text-yellow-600 bg-yellow-50 border-yellow-200' } :
                 { label: 'Ожирение',          color: 'text-red-600 bg-red-50 border-red-200' }
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${category.color}`}>
      <div>
        <div className="text-2xs font-semibold uppercase tracking-wider opacity-70">BMI</div>
        <div className="pf-num text-xl leading-none">{bmi.toFixed(1)}</div>
      </div>
      <div className="w-px h-8 bg-current opacity-20" />
      <div>
        <div className="text-2xs font-semibold opacity-70">Категория</div>
        <div className="text-sm font-semibold">{category.label}</div>
      </div>
    </div>
  )
}

// ── ОСНОВНОЙ КОМПОНЕНТ ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useUser()
  const [profile, setProfile]   = useState<AthleteProfile | null>(null)
  const [form, setForm]         = useState<FormData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState<Errors>({})
  const [toast, setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'personal' | 'sports' | 'physio' | 'privacy'>('personal')

  // Смена пароля — отдельный стейт
  const [pwCurrent,  setPwCurrent]  = useState('')
  const [pwNew,      setPwNew]      = useState('')
  const [pwConfirm,  setPwConfirm]  = useState('')
  const [pwSaving,   setPwSaving]   = useState(false)
  const [pwError,    setPwError]    = useState('')
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew,     setShowPwNew]     = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  // ── загрузка профиля ──────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data } = await sb()
        .from('athletes')
        .select('*')
        .eq('id', user.id)
        .single()

      const email = user.email ?? ''

      if (data) {
        setProfile(data as AthleteProfile)
        setForm(profileToForm(data as AthleteProfile, email))
      } else {
        const empty: AthleteProfile = {
          id: user.id, first_name: null, last_name: null, birth_date: null,
          gender: null, phone: null, city: null, country: null, bio: null,
          height_cm: null, weight_kg: null, primary_sport: null,
          fitness_level: null, goal: null, weekly_training_hours: null,
          max_heart_rate: null, hrv_baseline: null, rhr_baseline: null,
          vo2max: null, profile_public: false, workouts_public: false,
        }
        setProfile(empty)
        setForm(profileToForm(empty, email))
      }
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.email])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleChange = useCallback((name: keyof FormData, value: string | boolean) => {
    setForm(prev => prev ? { ...prev, [name]: value } : prev)
    setErrors(prev => { const e = { ...prev }; delete e[name]; return e })
  }, [])

  // ── сохранение профиля ────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !user?.id) return

    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      // 1. Сохраняем athletes таблицу
      const payload = formToPayload(form, user.id)
      const { error: athleteError } = await sb()
        .from('athletes')
        .upsert(payload, { onConflict: 'id' })
      if (athleteError) throw athleteError

      // 2. Обновляем email и имя в users таблице если изменились
      const updates: Record<string, string> = {}
      if (form.email && form.email !== user.email) updates.email = form.email
      const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ')
      if (fullName) updates.name = fullName

      if (Object.keys(updates).length > 0) {
        // Обновляем в таблице users
        await sb().from('users').update(updates).eq('id', user.id)
        // Если email изменился — обновляем через auth
        if (updates.email) {
          await sb().auth.updateUser({ email: updates.email })
        }
      }

      setProfile(prev => prev ? { ...prev, ...payload } as AthleteProfile : prev)
      showToast('success', 'Профиль успешно сохранён')
    } catch (err: any) {
      console.error('save profile error:', err)
      showToast('error', err?.message ?? 'Не удалось сохранить профиль')
    } finally {
      setSaving(false)
    }
  }

  // ── смена пароля ──────────────────────────────────────────────────────────────
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')

    if (!pwNew) { setPwError('Введите новый пароль'); return }
    if (pwNew.length < 8) { setPwError('Минимум 8 символов'); return }
    if (!/[A-Z]/.test(pwNew)) { setPwError('Нужна хотя бы одна заглавная буква'); return }
    if (!/[0-9]/.test(pwNew)) { setPwError('Нужна хотя бы одна цифра'); return }
    if (pwNew !== pwConfirm) { setPwError('Пароли не совпадают'); return }

    setPwSaving(true)
    try {
      const { error } = await sb().auth.updateUser({ password: pwNew })
      if (error) throw error
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      showToast('success', 'Пароль успешно изменён')
    } catch (err: any) {
      setPwError(err?.message ?? 'Не удалось изменить пароль')
    } finally {
      setPwSaving(false)
    }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  if (user && user.role !== 'athlete' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <i className="ki-filled ki-lock text-3xl text-muted-foreground/30 mb-3 block" />
          <p className="text-muted-foreground text-2sm">Эта страница доступна только для атлетов</p>
        </div>
      </div>
    )
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  const age = calcAge(form.birth_date || null)
  const completeness = calcCompleteness(form)

  return (
    <div className="flex flex-col gap-6 pf-enter max-w-3xl mx-auto w-full">

      {/* ── Заголовок ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground hover:text-foreground transition-colors mb-2 no-underline">
            <i className="ki-filled ki-left text-[10px]" /> На главную
          </Link>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Настройки</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Профиль атлета</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xs text-muted-foreground mb-1">Заполнено</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${completeness}%` }} />
              </div>
              <span className="text-2xs font-bold text-foreground">{completeness}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Карточка с краткой сводкой ── */}
      {profile && (profile.first_name || profile.height_cm || profile.primary_sport) && (
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-5 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
            <span className="pf-num text-xl text-orange-500">
              {[profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
               user?.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-foreground">
              {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || user?.name || '—'}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {profile.primary_sport && (
                <span className="text-2xs font-medium text-muted-foreground">{profile.primary_sport}</span>
              )}
              {profile.fitness_level && (
                <span className="text-2xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-semibold">
                  {FITNESS_LEVELS.find(f => f.value === profile.fitness_level)?.label ?? profile.fitness_level}
                </span>
              )}
              {age !== null && <span className="text-2xs text-muted-foreground">{age} лет</span>}
              {profile.city && (
                <span className="text-2xs text-muted-foreground">
                  <i className="ki-filled ki-map text-[10px] mr-0.5" />{profile.city}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {profile.height_cm && (
              <div className="text-center">
                <div className="pf-num text-xl text-foreground leading-none">{profile.height_cm}</div>
                <div className="text-2xs text-muted-foreground">см</div>
              </div>
            )}
            {profile.weight_kg && (
              <div className="text-center">
                <div className="pf-num text-xl text-foreground leading-none">{profile.weight_kg}</div>
                <div className="text-2xs text-muted-foreground">кг</div>
              </div>
            )}
            {profile.vo2max && (
              <div className="text-center">
                <div className="pf-num text-xl text-foreground leading-none">{profile.vo2max}</div>
                <div className="text-2xs text-muted-foreground">VO₂max</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Табы ── */}
      <div className="flex items-center gap-0.5 p-1 bg-card border border-border rounded-lg self-start">
        {([
          { id: 'personal', label: 'Личные данные', icon: 'ki-profile-circle' },
          { id: 'sports',   label: 'Спорт',          icon: 'ki-abstract-26' },
          { id: 'physio',   label: 'Физиология',     icon: 'ki-heart' },
          { id: 'privacy',  label: 'Приватность',    icon: 'ki-shield' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-2sm font-medium transition-all',
              activeTab === t.id ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}>
            <i className={`ki-filled ${t.icon} text-xs`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Форма ── */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ── ЛИЧНЫЕ ДАННЫЕ ── */}
        {activeTab === 'personal' && (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5 pf-enter">
            <SectionTitle title="Личные данные" icon="ki-profile-circle" />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Имя"     name="first_name" value={form.first_name} onChange={handleChange} placeholder="Иван"   error={errors.first_name} />
              <Field label="Фамилия" name="last_name"  value={form.last_name}  onChange={handleChange} placeholder="Иванов" error={errors.last_name} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Дата рождения
                  {age !== null && <span className="ml-2 font-normal text-muted-foreground normal-case tracking-normal">({age} лет)</span>}
                </label>
                <input type="date" value={form.birth_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => handleChange('birth_date', e.target.value)}
                  className={[
                    'w-full px-3 py-2.5 rounded-xl border bg-background text-sm outline-none transition-all',
                    errors.birth_date ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-input focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10',
                  ].join(' ')} />
                {errors.birth_date && <p className="text-2xs text-red-500 mt-1">{errors.birth_date}</p>}
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Пол</label>
                <select value={form.gender} onChange={e => handleChange('gender', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all">
                  <option value="">— Выбрать —</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Другой</option>
                  <option value="prefer_not_to_say">Не указывать</option>
                </select>
              </div>
            </div>

            {/* Телефон + Email */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Телефон" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+7 900 000 00 00" error={errors.phone} />
              <Field label="Email"   name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" error={errors.email} hint="Изменение потребует подтверждения" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Город" name="city" value={form.city} onChange={handleChange} placeholder="Москва" error={errors.city} />
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Страна</label>
                <select value={form.country} onChange={e => handleChange('country', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all">
                  <option value="">— Выбрать —</option>
                  <option value="RU">Россия</option>
                  <option value="UA">Украина</option>
                  <option value="BY">Беларусь</option>
                  <option value="KZ">Казахстан</option>
                  <option value="DE">Германия</option>
                  <option value="US">США</option>
                  <option value="other">Другая</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">О себе</label>
              <textarea value={form.bio} onChange={e => handleChange('bio', e.target.value)}
                rows={3} placeholder="Расскажите о себе, опыте, целях…"
                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all resize-none" />
            </div>

            {/* Антропометрия */}
            <div className="pt-2 border-t border-border">
              <SectionTitle title="Антропометрия" icon="ki-abstract-31" />
              <div className="grid grid-cols-2 gap-4 mb-3">
                <Field label="Рост (см)" name="height_cm" type="number" value={form.height_cm}
                  onChange={handleChange} placeholder="175" error={errors.height_cm}
                  min="100" max="250" step="0.1" hint="100 – 250 см" />
                <Field label="Вес (кг)" name="weight_kg" type="number" value={form.weight_kg}
                  onChange={handleChange} placeholder="70" error={errors.weight_kg}
                  min="30" max="300" step="0.1" hint="30 – 300 кг" />
              </div>
              <BMICard height={form.height_cm} weight={form.weight_kg} />
            </div>
          </div>
        )}

        {/* ── СПОРТИВНЫЙ ПРОФИЛЬ ── */}
        {activeTab === 'sports' && (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5 pf-enter">
            <SectionTitle title="Спортивный профиль" icon="ki-abstract-26" />

            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Основной вид спорта
              </label>
              <select value={form.primary_sport} onChange={e => handleChange('primary_sport', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all">
                <option value="">— Выбрать —</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <OptionGrid
              label="Уровень подготовки"
              options={FITNESS_LEVELS}
              value={form.fitness_level as any}
              onChange={v => handleChange('fitness_level', v)}
            />

            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Основная цель
              </label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g.value} type="button"
                    onClick={() => handleChange('goal', form.goal === g.value ? '' : g.value)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-2xs font-semibold border transition-all',
                      form.goal === g.value
                        ? 'border-orange-400 bg-orange-50 text-orange-600'
                        : 'border-border text-muted-foreground hover:border-orange-200',
                    ].join(' ')}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Часов тренировок в неделю" name="weekly_training_hours" type="number"
              value={form.weekly_training_hours} onChange={handleChange}
              placeholder="8" error={errors.weekly_training_hours}
              min="0" max="60" step="0.5" hint="0 – 60 часов" />
          </div>
        )}

        {/* ── ФИЗИОЛОГИЧЕСКИЕ ПОКАЗАТЕЛИ ── */}
        {activeTab === 'physio' && (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5 pf-enter">
            <SectionTitle title="Физиологические показатели" icon="ki-heart" />
            <p className="text-2xs text-muted-foreground -mt-2">
              Базовые физиологические параметры. Используются для расчёта зон нагрузки и персональных рекомендаций.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="ЧСС макс (уд/мин)" name="max_heart_rate" type="number"
                value={form.max_heart_rate} onChange={handleChange}
                placeholder="185" error={errors.max_heart_rate}
                min="100" max="250" hint="Обычно 180–210" />
              <Field label="ЧСС покоя (уд/мин)" name="rhr_baseline" type="number"
                value={form.rhr_baseline} onChange={handleChange}
                placeholder="52" error={errors.rhr_baseline}
                min="30" max="120" hint="Измерить утром в покое" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="HRV базовый (мс)" name="hrv_baseline" type="number"
                value={form.hrv_baseline} onChange={handleChange}
                placeholder="65" error={errors.hrv_baseline}
                min="1" max="200" hint="Средний показатель вариабельности" />
              <Field label="VO₂max (мл/кг/мин)" name="vo2max" type="number"
                value={form.vo2max} onChange={handleChange}
                placeholder="52" error={errors.vo2max}
                min="20" max="100" step="0.1" hint="Из теста или устройства" />
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <i className="ki-filled ki-information-2 text-blue-500 text-sm mt-0.5 shrink-0" />
                <p className="text-2xs text-blue-700 leading-relaxed">
                  Если вы не знаете точных значений — оставьте поля пустыми. ProForm использует стандартные формулы расчёта зон пульса, если базовые показатели не указаны.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ПРИВАТНОСТЬ ── */}
        {activeTab === 'privacy' && (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 pf-enter">
            <SectionTitle title="Приватность" icon="ki-shield" />
            <p className="text-2xs text-muted-foreground -mt-1">
              Управляйте тем, что видят другие пользователи.
            </p>

            {[
              {
                key: 'profile_public' as const,
                label: 'Публичный профиль',
                desc: 'Другие атлеты и тренеры смогут видеть ваш профиль',
              },
              {
                key: 'workouts_public' as const,
                label: 'Публичные тренировки',
                desc: 'Тренеры в вашей организации смогут видеть ваши тренировки',
              },
            ].map(item => (
              <label key={item.key}
                className="flex items-start gap-4 p-4 rounded-xl border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
                <div className="relative shrink-0 mt-0.5">
                  <input type="checkbox" checked={form[item.key]}
                    onChange={e => handleChange(item.key, e.target.checked as any)}
                    className="sr-only" />
                  <div className={['w-10 h-6 rounded-full transition-colors', form[item.key] ? 'bg-orange-500' : 'bg-border'].join(' ')} />
                  <div className={['absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', form[item.key] ? 'translate-x-5' : 'translate-x-1'].join(' ')} />
                </div>
              </label>
            ))}
          </div>
        )}

        {/* ── Кнопка сохранения ── */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-60">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full pf-spin" /> Сохранение…</>
            ) : (
              <><i className="ki-filled ki-check text-xs" /> Сохранить изменения</>
            )}
          </button>
          <button type="button" onClick={loadProfile}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all font-medium">
            Сбросить
          </button>
        </div>
      </form>

      {/* ── СМЕНА ПАРОЛЯ ── отдельная форма, не в submit основной ── */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <i className="ki-filled ki-lock text-red-500 text-sm" />
          </div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Смена пароля</h3>
        </div>

        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          {/* Новый пароль */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Новый пароль
              </label>
              <div className="relative">
                <input
                  type={showPwNew ? 'text' : 'password'}
                  value={pwNew}
                  onChange={e => { setPwNew(e.target.value); setPwError('') }}
                  placeholder="Минимум 8 символов"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
                <button type="button" onClick={() => setShowPwNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <i className={`ki-filled ${showPwNew ? 'ki-eye-slash' : 'ki-eye'} text-sm`} />
                </button>
              </div>
              {/* Индикатор силы */}
              {pwNew && (
                <div className="flex gap-1 mt-1.5">
                  {[
                    pwNew.length >= 8,
                    /[A-Z]/.test(pwNew),
                    /[0-9]/.test(pwNew),
                    /[^A-Za-z0-9]/.test(pwNew),
                  ].map((ok, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-orange-400' : 'bg-border'}`} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Повторите пароль
              </label>
              <div className="relative">
                <input
                  type={showPwConfirm ? 'text' : 'password'}
                  value={pwConfirm}
                  onChange={e => { setPwConfirm(e.target.value); setPwError('') }}
                  placeholder="Повторите новый пароль"
                  className={[
                    'w-full px-3 py-2.5 pr-10 rounded-xl border bg-background text-sm outline-none transition-all',
                    pwConfirm && pwConfirm !== pwNew
                      ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                      : 'border-input focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10',
                  ].join(' ')}
                />
                <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <i className={`ki-filled ${showPwConfirm ? 'ki-eye-slash' : 'ki-eye'} text-sm`} />
                </button>
              </div>
              {pwConfirm && pwConfirm !== pwNew && (
                <p className="text-2xs text-red-500 mt-1">Пароли не совпадают</p>
              )}
            </div>
          </div>

          {/* Требования */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { ok: pwNew.length >= 8,          label: '8+ символов' },
              { ok: /[A-Z]/.test(pwNew),         label: 'Заглавная буква' },
              { ok: /[0-9]/.test(pwNew),         label: 'Цифра' },
              { ok: /[^A-Za-z0-9]/.test(pwNew),  label: 'Спецсимвол' },
            ].map(r => (
              <span key={r.label} className={`flex items-center gap-1 text-[11px] transition-colors ${pwNew ? (r.ok ? 'text-green-600' : 'text-muted-foreground') : 'text-muted-foreground'}`}>
                <i className={`ki-filled ${r.ok && pwNew ? 'ki-check-circle text-green-500' : 'ki-information-2'} text-[10px]`} />
                {r.label}
              </span>
            ))}
          </div>

          {pwError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-2xs">
              <i className="ki-filled ki-information-5 text-sm shrink-0" />
              {pwError}
            </div>
          )}

          <div>
            <button type="submit" disabled={pwSaving || !pwNew || pwNew !== pwConfirm}
              className="px-5 py-2.5 rounded-xl bg-foreground hover:bg-foreground/80 text-background text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-40">
              {pwSaving ? (
                <><span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full pf-spin" /> Сохранение…</>
              ) : (
                <><i className="ki-filled ki-lock text-xs" /> Изменить пароль</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={[
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pf-enter',
          toast.type === 'success' ? 'bg-foreground text-background' : 'bg-red-500 text-white',
        ].join(' ')}>
          <i className={`ki-filled ${toast.type === 'success' ? 'ki-check-circle text-green-400' : 'ki-information-5 text-white'}`} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── вычисление процента заполненности ─────────────────────────────────────────
function calcCompleteness(f: FormData): number {
  const fields: (keyof FormData)[] = [
    'first_name', 'last_name', 'birth_date', 'gender',
    'height_cm', 'weight_kg',
    'primary_sport', 'fitness_level', 'goal',
    'city', 'email',
  ]
  const filled = fields.filter(k => {
    const v = f[k]
    return typeof v === 'boolean' ? true : Boolean(v)
  }).length
  return Math.round((filled / fields.length) * 100)
}
