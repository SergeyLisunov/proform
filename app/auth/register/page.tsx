'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── типы ──────────────────────────────────────────────────────────────────────

type Role = 'athlete' | 'coach' | 'organization'
type Step = 'role' | 'account' | 'athlete_profile' | 'done'

const ROLES: { value: Role; label: string; desc: string; icon: string; bg: string; text: string; border: string }[] = [
  {
    value: 'athlete',
    label: 'Атлет',
    desc: 'Веду дневник тренировок, отслеживаю прогресс и метрики',
    icon: 'ki-abstract-26',
    bg: '#FFF7ED', text: '#F97316', border: '#FED7AA',
  },
  {
    value: 'coach',
    label: 'Тренер',
    desc: 'Наблюдаю за атлетами, оставляю пометки, анализирую нагрузку',
    icon: 'ki-notepad-edit',
    bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0',
  },
  {
    value: 'organization',
    label: 'Организация',
    desc: 'Управляю участниками, рассылками и стеной событий',
    icon: 'ki-office-bag',
    bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE',
  },
]

const SPORTS = [
  'Бег', 'Велоспорт', 'Плавание', 'Триатлон', 'Силовые', 'Кроссфит',
  'Футбол', 'Баскетбол', 'Теннис', 'Лёгкая атлетика', 'Лыжи', 'Другое',
]

const FITNESS_LEVELS = [
  { value: 'beginner',      label: 'Новичок',          desc: 'Начинаю заниматься спортом' },
  { value: 'recreational',  label: 'Любитель',          desc: 'Тренируюсь регулярно для удовольствия' },
  { value: 'competitive',   label: 'Соревновательный',  desc: 'Участвую в соревнованиях' },
  { value: 'elite',         label: 'Элитный',           desc: 'Профессиональный / национальная сборная' },
]

const GOALS = [
  { value: 'health',        label: 'Здоровье и самочувствие' },
  { value: 'weight_loss',   label: 'Снижение веса' },
  { value: 'performance',   label: 'Улучшение результатов' },
  { value: 'competition',   label: 'Подготовка к соревнованиям' },
  { value: 'recovery',      label: 'Реабилитация и восстановление' },
]

// ── валидация ──────────────────────────────────────────────────────────────────
function validatePassword(pwd: string): string {
  if (pwd.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(pwd)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(pwd)) return 'Нужна хотя бы одна цифра'
  return ''
}

// ── компоненты ─────────────────────────────────────────────────────────────────
function StepIndicator({ current, role }: { current: Step; role: Role | null }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'role', label: 'Роль' },
    { id: 'account', label: 'Аккаунт' },
    ...(role === 'athlete' ? [{ id: 'athlete_profile' as Step, label: 'Профиль' }] : []),
  ]
  const currentIdx = steps.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={[
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            i < currentIdx ? 'bg-orange-500 text-white' :
            i === currentIdx ? 'bg-orange-500 text-white ring-2 ring-orange-200' :
            'bg-border text-muted-foreground',
          ].join(' ')}>
            {i < currentIdx ? <i className="ki-filled ki-check text-[10px]" /> : i + 1}
          </div>
          <span className={`text-2xs font-semibold ${i <= currentIdx ? 'text-foreground' : 'text-muted-foreground'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className={`h-px w-8 ${i < currentIdx ? 'bg-orange-400' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  )
}

// ── ГЛАВНЫЙ КОМПОНЕНТ ─────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [step, setStep] = useState<Step>('role')

  // Шаг 1: роль
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  // Шаг 2: аккаунт
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // ID созданного пользователя (нужен для шага 3)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)

  // Шаг 3: антропометрия атлета
  const [athleteForm, setAthleteForm] = useState({
    first_name:          '',
    last_name:           '',
    birth_date:          '',
    gender:              '',
    height_cm:           '',
    weight_kg:           '',
    primary_sport:       '',
    fitness_level:       '',
    goal:                '',
    weekly_training_hours: '',
    city:                '',
  })
  const [athleteSaving, setAthleteSaving] = useState(false)
  const [athleteError, setAthleteError]   = useState('')

  // ── Шаг 1 → 2 ──────────────────────────────────────────────────────────────
  function handleRoleNext() {
    if (!selectedRole) return
    setStep('account')
  }

  // ── Шаг 2: создание аккаунта ────────────────────────────────────────────────
  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pwdErr = validatePassword(password)
    if (pwdErr) { setPwdError(pwdErr); return }
    setPwdError('')
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: selectedRole },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Ждём появления пользователя в public.users (триггер)
    const userId = data.user?.id
    if (userId) setCreatedUserId(userId)

    setLoading(false)

    if (selectedRole === 'athlete') {
      setStep('athlete_profile')
    } else {
      setStep('done')
    }
  }

  // ── Шаг 3: сохранение антропометрии ─────────────────────────────────────────
  async function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAthleteSaving(true)
    setAthleteError('')

    try {
      const supabase = createClient()

      // Находим public.users.id по auth_id
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!userRow?.id) throw new Error('Пользователь не найден. Попробуйте войти позже.')

      const payload: Record<string, string | number | null> = {
        id: userRow.id,
        first_name:   athleteForm.first_name || null,
        last_name:    athleteForm.last_name  || null,
        birth_date:   athleteForm.birth_date || null,
        gender:       athleteForm.gender     || null,
        height_cm:    athleteForm.height_cm  ? parseFloat(athleteForm.height_cm)  : null,
        weight_kg:    athleteForm.weight_kg  ? parseFloat(athleteForm.weight_kg)  : null,
        primary_sport: athleteForm.primary_sport || null,
        fitness_level: athleteForm.fitness_level || null,
        goal:          athleteForm.goal          || null,
        weekly_training_hours: athleteForm.weekly_training_hours ? parseFloat(athleteForm.weekly_training_hours) : null,
        city:          athleteForm.city || null,
      }

      // UPSERT в таблицу athletes
      const { error: upsertErr } = await supabase
        .from('athletes')
        .upsert(payload, { onConflict: 'id' })

      if (upsertErr) throw upsertErr

      setStep('done')
    } catch (err: any) {
      setAthleteError(err?.message ?? 'Не удалось сохранить профиль')
    } finally {
      setAthleteSaving(false)
    }
  }

  function skipAthleteProfile() {
    setStep('done')
  }

  // ── рендер ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-[920px] flex rounded-2xl overflow-hidden border border-border bg-card shadow-lg shadow-black/5">

        {/* Левая панель */}
        <div className="hidden lg:flex w-[340px] shrink-0 flex-col bg-zinc-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-transparent" />
          <div className="relative flex items-center gap-2.5 p-10 pb-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <i className="ki-filled ki-abstract-26 text-white text-[15px]" />
            </div>
            <span className="pf-num text-[22px] text-white tracking-wide">ProForm</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-center px-10">
            <p className="pf-num text-[44px] text-white leading-[1.05] mb-4">
              JOIN<br /><span className="text-orange-500">PRO</span><br />FORM.
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Создай аккаунт и начни отслеживать тренировки, прогресс и восстановление.
            </p>
          </div>
          <div className="relative flex gap-8 px-10 pb-10">
            {[{ value: '100K', label: 'Records' }, { value: '286', label: 'Athletes' }, { value: '39', label: 'Metrics' }].map(s => (
              <div key={s.label}>
                <div className="pf-num text-[28px] text-white leading-none">{s.value}</div>
                <div className="text-2xs text-zinc-600 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Правая панель */}
        <div className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-12 overflow-y-auto max-h-screen">
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <i className="ki-filled ki-abstract-26 text-white text-sm" />
            </div>
            <span className="pf-num text-xl text-foreground">ProForm</span>
          </div>

          <StepIndicator current={step} role={selectedRole} />

          {/* ── ШАГ 1: выбор роли ─────────────────────────────────────────── */}
          {step === 'role' && (
            <div className="pf-enter">
              <h1 className="pf-num text-[32px] text-foreground leading-none mb-1">Кто вы?</h1>
              <p className="text-2sm text-muted-foreground mb-6">Выберите роль — от неё зависит функциональность вашего аккаунта</p>
              <div className="flex flex-col gap-3 mb-6">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: selectedRole === r.value ? r.border : 'var(--border)',
                      background:  selectedRole === r.value ? r.bg : 'transparent',
                    }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.bg, border: `1px solid ${r.border}` }}>
                      <i className={`ki-filled ${r.icon} text-base`} style={{ color: r.text }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{r.label}</div>
                      <div className="text-2xs text-muted-foreground mt-0.5">{r.desc}</div>
                    </div>
                    {selectedRole === r.value && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: r.text }}>
                        <i className="ki-filled ki-check text-white text-[10px]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={handleRoleNext} disabled={!selectedRole}
                className="w-full px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                Продолжить <i className="ki-filled ki-right text-xs" />
              </button>
              <p className="text-2sm text-muted-foreground mt-4 text-center">
                Уже есть аккаунт?{' '}
                <Link href="/auth/login" className="text-orange-500 font-semibold hover:text-orange-600 no-underline">Войти</Link>
              </p>
            </div>
          )}

          {/* ── ШАГ 2: данные аккаунта ────────────────────────────────────── */}
          {step === 'account' && (
            <div className="pf-enter">
              <button onClick={() => setStep('role')} className="flex items-center gap-1.5 text-2xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                <i className="ki-filled ki-left text-[10px]" /> Назад
              </button>
              <h1 className="pf-num text-[32px] text-foreground leading-none mb-1">Создать аккаунт</h1>
              <p className="text-2sm text-muted-foreground mb-6">
                Регистрация как <span className="font-semibold text-foreground">{ROLES.find(r => r.value === selectedRole)?.label}</span>
              </p>
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4">
                  <i className="ki-filled ki-information-4 text-red-400" />{error}
                </div>
              )}
              <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Имя *</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email *</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Пароль *</label>
                  <input type="password" required value={password} onChange={e => { setPassword(e.target.value); setPwdError('') }} placeholder="••••••••"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 transition-all ${pwdError ? 'border-red-400 focus:ring-red-200' : 'border-input focus:border-orange-400 focus:ring-orange-500/10'}`} />
                  {pwdError && <p className="text-2xs text-red-500 mt-1">{pwdError}</p>}
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: '8+ символов', ok: password.length >= 8 },
                      { label: 'Заглавная', ok: /[A-Z]/.test(password) },
                      { label: 'Цифра', ok: /[0-9]/.test(password) },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-border'}`} />
                        <span className={`text-[10px] ${r.ok ? 'text-green-600' : 'text-muted-foreground'}`}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="mt-1 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full pf-spin" /> Создание аккаунта…</>
                  ) : (
                    <>{selectedRole === 'athlete' ? 'Продолжить' : 'Создать аккаунт'} <i className="ki-filled ki-right text-xs" /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── ШАГ 3: антропометрия атлета ──────────────────────────────── */}
          {step === 'athlete_profile' && (
            <div className="pf-enter">
              <h1 className="pf-num text-[28px] text-foreground leading-none mb-1">Профиль атлета</h1>
              <p className="text-2sm text-muted-foreground mb-5">
                Эти данные помогут персонализировать аналитику и рекомендации. Все поля необязательны.
              </p>
              {athleteError && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4">
                  <i className="ki-filled ki-information-4 text-red-400" />{athleteError}
                </div>
              )}
              <form onSubmit={handleAthleteSubmit} className="flex flex-col gap-5">

                {/* Личные данные */}
                <section>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Личные данные</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Имя</label>
                      <input type="text" value={athleteForm.first_name} onChange={e => setAthleteForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Иван"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Фамилия</label>
                      <input type="text" value={athleteForm.last_name} onChange={e => setAthleteForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Иванов"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Дата рождения</label>
                      <input type="date" value={athleteForm.birth_date} onChange={e => setAthleteForm(f => ({ ...f, birth_date: e.target.value }))} max={new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Пол</label>
                      <select value={athleteForm.gender} onChange={e => setAthleteForm(f => ({ ...f, gender: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all">
                        <option value="">— Выбрать —</option>
                        <option value="male">Мужской</option>
                        <option value="female">Женский</option>
                        <option value="other">Другой</option>
                        <option value="prefer_not_to_say">Не указывать</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Антропометрия */}
                <section>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Антропометрия</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Рост (см)</label>
                      <input type="number" min="100" max="250" step="0.1" value={athleteForm.height_cm}
                        onChange={e => setAthleteForm(f => ({ ...f, height_cm: e.target.value }))} placeholder="175"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Вес (кг)</label>
                      <input type="number" min="30" max="300" step="0.1" value={athleteForm.weight_kg}
                        onChange={e => setAthleteForm(f => ({ ...f, weight_kg: e.target.value }))} placeholder="70"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                    </div>
                  </div>
                </section>

                {/* Спорт */}
                <section>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Спортивный профиль</div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Основной вид спорта</label>
                      <select value={athleteForm.primary_sport} onChange={e => setAthleteForm(f => ({ ...f, primary_sport: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all">
                        <option value="">— Выбрать —</option>
                        {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Уровень подготовки</label>
                      <div className="grid grid-cols-2 gap-2">
                        {FITNESS_LEVELS.map(fl => (
                          <button key={fl.value} type="button" onClick={() => setAthleteForm(f => ({ ...f, fitness_level: fl.value }))}
                            className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all ${athleteForm.fitness_level === fl.value ? 'border-orange-400 bg-orange-50' : 'border-border hover:border-orange-200'}`}>
                            <span className={`text-2xs font-semibold ${athleteForm.fitness_level === fl.value ? 'text-orange-600' : 'text-foreground'}`}>{fl.label}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{fl.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Основная цель</label>
                      <div className="flex flex-wrap gap-2">
                        {GOALS.map(g => (
                          <button key={g.value} type="button" onClick={() => setAthleteForm(f => ({ ...f, goal: g.value }))}
                            className={`px-3 py-1.5 rounded-lg text-2xs font-semibold border transition-all ${athleteForm.goal === g.value ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-border text-muted-foreground hover:border-orange-200'}`}>
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Часов тренировок в неделю</label>
                        <input type="number" min="0" max="40" step="0.5" value={athleteForm.weekly_training_hours}
                          onChange={e => setAthleteForm(f => ({ ...f, weekly_training_hours: e.target.value }))} placeholder="8"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Город</label>
                        <input type="text" value={athleteForm.city} onChange={e => setAthleteForm(f => ({ ...f, city: e.target.value }))} placeholder="Москва"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={athleteSaving}
                    className="flex-1 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {athleteSaving ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full pf-spin" /> Сохранение…</>
                    ) : (
                      <><i className="ki-filled ki-check text-xs" /> Сохранить и войти</>
                    )}
                  </button>
                  <button type="button" onClick={skipAthleteProfile}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all font-medium">
                    Пропустить
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── ШАГ done: успех ───────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="pf-enter text-center flex flex-col items-center gap-5 py-6">
              <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                <i className="ki-filled ki-check-circle text-3xl text-green-500" />
              </div>
              <div>
                <h2 className="pf-num text-[28px] text-foreground leading-none mb-2">Аккаунт создан!</h2>
                <p className="text-2sm text-muted-foreground">
                  Проверьте почту <span className="font-semibold text-foreground">{email}</span> и подтвердите адрес, затем войдите в приложение.
                </p>
              </div>
              <Link href="/auth/login"
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all no-underline inline-flex items-center gap-2">
                Войти в ProForm <i className="ki-filled ki-right text-xs" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
