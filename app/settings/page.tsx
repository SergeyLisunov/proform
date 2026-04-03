'use client'
import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── Supabase ───────────────────────────────────────────────────────────────────
function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Типы ──────────────────────────────────────────────────────────────────────
type Tab = 'personal' | 'sport' | 'physio' | 'privacy'

type FormData = {
  // Личные
  first_name: string
  last_name: string
  birth_date: string
  gender: string
  phone: string
  email: string
  city: string
  country: string
  bio: string
  // Спорт
  primary_sport: string
  club: string
  fitness_level: string
  goal: string
  weekly_training_hours: string
  // Физиология
  height_cm: string
  weight_kg: string
  max_heart_rate: string
  lactate_threshold_hr: string
  vo2max: string
  hrv_baseline: string
  rhr_baseline: string
  // Приватность
  profile_public: boolean
  workouts_public: boolean
}

const EMPTY_FORM: FormData = {
  first_name: '', last_name: '', birth_date: '', gender: '', phone: '', email: '',
  city: '', country: '', bio: '',
  primary_sport: '', club: '', fitness_level: '', goal: '', weekly_training_hours: '',
  height_cm: '', weight_kg: '', max_heart_rate: '', lactate_threshold_hr: '',
  vo2max: '', hrv_baseline: '', rhr_baseline: '',
  profile_public: true, workouts_public: false,
}

// ── Конфиги ───────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: 'personal', label: 'Личные данные', icon: 'ki-profile-circle', color: '#F97316' },
  { id: 'sport',    label: 'Спорт',         icon: 'ki-abstract-26',    color: '#2563EB' },
  { id: 'physio',   label: 'Физиология',    icon: 'ki-heart',          color: '#E11D48' },
  { id: 'privacy',  label: 'Приватность',   icon: 'ki-shield-tick',    color: '#16A34A' },
]

const GENDERS = [
  { value: '', label: '— Выбрать —' },
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other', label: 'Другой' },
]

const COUNTRIES = [
  { value: '', label: '— Выбрать —' },
  { value: 'RU', label: '🇷🇺 Россия' },
  { value: 'BY', label: '🇧🇾 Беларусь' },
  { value: 'KZ', label: '🇰🇿 Казахстан' },
  { value: 'UA', label: '🇺🇦 Украина' },
  { value: 'US', label: '🇺🇸 США' },
  { value: 'DE', label: '🇩🇪 Германия' },
  { value: 'FR', label: '🇫🇷 Франция' },
  { value: 'GB', label: '🇬🇧 Великобритания' },
  { value: 'OTHER', label: '🌍 Другая' },
]

const SPORTS = [
  { value: '', label: '— Выбрать —' },
  // Циклические
  { value: 'Бег', label: '🏃 Бег' },
  { value: 'Велоспорт', label: '🚴 Велоспорт' },
  { value: 'Плавание', label: '🏊 Плавание' },
  { value: 'Триатлон', label: '🏅 Триатлон' },
  { value: 'Дуатлон', label: '🏅 Дуатлон' },
  { value: 'Ходьба', label: '🚶 Ходьба / Скандинавская ходьба' },
  { value: 'Лыжи', label: '⛷️ Лыжи (беговые)' },
  { value: 'Горные лыжи', label: '🎿 Горные лыжи / Сноуборд' },
  { value: 'Гребля', label: '🚣 Гребля / Каяк' },
  // Силовые и единоборства
  { value: 'Силовые', label: '🏋️ Силовые тренировки' },
  { value: 'Кроссфит', label: '💪 Кроссфит' },
  { value: 'Борьба', label: '🥋 Единоборства / Борьба' },
  { value: 'Бокс', label: '🥊 Бокс / Кикбоксинг' },
  // Командные
  { value: 'Футбол', label: '⚽ Футбол' },
  { value: 'Баскетбол', label: '🏀 Баскетбол' },
  { value: 'Волейбол', label: '🏐 Волейбол' },
  { value: 'Хоккей', label: '🏒 Хоккей' },
  { value: 'Регби', label: '🏉 Регби' },
  { value: 'Теннис', label: '🎾 Теннис' },
  { value: 'Настольный теннис', label: '🏓 Настольный теннис' },
  { value: 'Бадминтон', label: '🏸 Бадминтон' },
  // Прочее
  { value: 'Гимнастика', label: '🤸 Гимнастика / Акробатика' },
  { value: 'Йога', label: '🧘 Йога / Пилатес' },
  { value: 'Фитнес', label: '🏃 Фитнес / Аэробика' },
  { value: 'Скалолазание', label: '🧗 Скалолазание' },
  { value: 'Верховая езда', label: '🐎 Верховая езда' },
  { value: 'Другое', label: '✏️ Другое (ввести вручную)' },
]

const FITNESS_LEVELS = [
  { value: '', label: '— Выбрать —' },
  { value: 'beginner', label: 'Начинающий' },
  { value: 'amateur', label: 'Любитель' },
  { value: 'intermediate', label: 'Средний уровень' },
  { value: 'advanced', label: 'Продвинутый' },
  { value: 'professional', label: 'Профессионал' },
]

const GOALS = [
  { value: '', label: '— Выбрать —' },
  { value: 'weight_loss', label: 'Снижение веса' },
  { value: 'muscle_gain', label: 'Набор мышечной массы' },
  { value: 'endurance', label: 'Выносливость' },
  { value: 'speed', label: 'Скорость' },
  { value: 'competition', label: 'Соревнования' },
  { value: 'health', label: 'Здоровье и самочувствие' },
  { value: 'technique', label: 'Техника и мастерство' },
  { value: 'fun', label: 'Удовольствие от спорта' },
]

// ── Подсчёт заполненности ─────────────────────────────────────────────────────
function calcCompletion(f: FormData): number {
  const fields = [
    f.first_name, f.last_name, f.birth_date, f.gender, f.phone,
    f.city, f.country, f.bio,
    f.primary_sport, f.fitness_level, f.goal,
    f.height_cm, f.weight_kg, f.max_heart_rate, f.vo2max,
  ]
  const filled = fields.filter(v => v && String(v).trim() !== '').length
  return Math.round((filled / fields.length) * 100)
}

// ── Компоненты полей ──────────────────────────────────────────────────────────
const inputClassName =
  'w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10'

const textareaClassName = `${inputClassName} resize-none font-inherit`

const iStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: '12px 16px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--background)',
  color: 'var(--foreground)',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const tabDescriptions: Record<Tab, string> = {
  personal: 'Контактные данные, базовый профиль и short bio для рабочего пространства.',
  sport: 'Вид спорта, цели подготовки и контекст клуба для персонализации рекомендаций.',
  physio: 'Антропометрия и кардио-метрики для более точной аналитики и зон нагрузки.',
  privacy: 'Контроль доступа к профилю, тренировкам и настройкам безопасности аккаунта.',
}

const tabHighlights: Record<Tab, string[]> = {
  personal: ['Имя и контактные данные', 'Локация и дата рождения', 'Краткий профиль спортсмена'],
  sport: ['Основная дисциплина', 'Уровень и цели подготовки', 'Клуб или спортивная организация'],
  physio: ['Рост и вес', 'ЧСС, HRV и VO2max', 'База для тренерской аналитики'],
  privacy: ['Видимость профиля', 'Публичность тренировок', 'Безопасность и пароль'],
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, min, max }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string; max?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max} className={inputClassName} />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`${inputClassName} cursor-pointer`}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, color, title }: { icon: string; color: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}18` }}
      >
        <i className={`ki-filled ${icon} text-sm`} style={{ color }} />
      </div>
      <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-foreground">
        {title}
      </h3>
    </div>
  )
}

// ── Карточка блока ─────────────────────────────────────────────────────────────
function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`rounded-[28px] border border-border bg-card p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)] sm:p-7 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-1 text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs leading-relaxed text-muted-foreground">{hint}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value ? 'bg-orange-500' : 'bg-border'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${value ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  )
}

// ── Password Change Card ───────────────────────────────────────────────────────
function PasswordCard() {
  const { user } = useUser()
  const [open, setOpen]         = useState(false)
  const [oldPw, setOldPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirm] = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok'|'err'; text: string } | null>(null)
  const [showOld, setShowOld]   = useState(false)
  const [showNew, setShowNew]   = useState(false)

  // Оценка силы пароля
  const strength = (() => {
    if (!newPw) return 0
    let s = 0
    if (newPw.length >= 8) s++
    if (/[A-Z]/.test(newPw)) s++
    if (/[0-9]/.test(newPw)) s++
    if (/[^A-Za-z0-9]/.test(newPw)) s++
    return s
  })()
  const strengthLabel = ['', 'Слабый', 'Средний', 'Хороший', 'Отличный'][strength]
  const strengthColor = ['', '#DC2626', '#F97316', '#EAB308', '#16A34A'][strength]

  async function handleChange() {
    if (!newPw || newPw.length < 8) { setMsg({ type:'err', text:'Минимум 8 символов' }); return }
    if (newPw !== confirmPw)         { setMsg({ type:'err', text:'Пароли не совпадают' }); return }
    setSaving(true); setMsg(null)
    try {
      const sb = getSB()
      const { error } = await sb.auth.updateUser({ password: newPw })
      if (error) throw error
      setMsg({ type:'ok', text:'Пароль успешно изменён' })
      setOldPw(''); setNewPw(''); setConfirm('')
      setTimeout(() => { setMsg(null); setOpen(false) }, 2000)
    } catch (e: any) {
      setMsg({ type:'err', text: e?.message ?? 'Ошибка при смене пароля' })
    } finally { setSaving(false) }
  }

  const pwInput = (value: string, onChange: (v:string)=>void, placeholder: string, show: boolean, onToggle: ()=>void) => (
    <div style={{ position:'relative' }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...iStyle, paddingRight: 44 }}
        onFocus={e => (e.target.style.borderColor = '#7C3AED')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
      <button type="button" onClick={onToggle} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted-foreground)', padding:0 }}>
        <i className={`ki-filled ${show ? 'ki-eye-slash' : 'ki-eye'} text-sm`} />
      </button>
    </div>
  )

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ width:32, height:32, borderRadius:10, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ki-filled ki-lock text-sm" style={{ color:'#7C3AED' }} />
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--foreground)', textTransform:'uppercase', letterSpacing:'0.1em' }}>СМЕНА ПАРОЛЯ</div>
            <div style={{ fontSize:12, color:'var(--muted-foreground)', marginTop:2 }}>Обновите пароль для входа в аккаунт</div>
          </div>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setMsg(null) }}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
            open
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : 'border-border bg-background text-violet-700 hover:border-violet-200 hover:bg-violet-50'
          }`}
        >
          <i className={`ki-filled ${open ? 'ki-up' : 'ki-down'} text-xs`} />
          {open ? 'Свернуть' : 'Изменить'}
        </button>
      </div>

      {open && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="mb-1 h-px bg-border" />

          <Field label="Новый пароль">
            {pwInput(newPw, setNewPw, 'Минимум 8 символов', showNew, () => setShowNew(s=>!s))}
            {newPw && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', gap:4, marginBottom:5 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:4, borderRadius:99, background: i <= strength ? strengthColor : 'var(--border)', transition:'all 0.3s' }} />
                  ))}
                </div>
                <div style={{ fontSize:11, fontWeight:600, color:strengthColor }}>{strengthLabel}</div>
                <div style={{ fontSize:10, color:'var(--muted-foreground)', marginTop:4, display:'flex', gap:10, flexWrap:'wrap' }}>
                  <span style={{ color: newPw.length>=8 ? '#16A34A':'var(--muted-foreground)' }}>✓ 8+ символов</span>
                  <span style={{ color: /[A-Z]/.test(newPw)?'#16A34A':'var(--muted-foreground)' }}>✓ Заглавная буква</span>
                  <span style={{ color: /[0-9]/.test(newPw)?'#16A34A':'var(--muted-foreground)' }}>✓ Цифра</span>
                  <span style={{ color: /[^A-Za-z0-9]/.test(newPw)?'#16A34A':'var(--muted-foreground)' }}>✓ Спецсимвол</span>
                </div>
              </div>
            )}
          </Field>

          <Field label="Подтвердите новый пароль">
            {pwInput(confirmPw, setConfirm, 'Повторите новый пароль', showOld, () => setShowOld(s=>!s))}
            {confirmPw && newPw && (
              <div style={{ marginTop:6, fontSize:11, fontWeight:600, color: confirmPw===newPw?'#16A34A':'#DC2626', display:'flex', alignItems:'center', gap:5 }}>
                <i className={`ki-filled ${confirmPw===newPw?'ki-check-circle':'ki-cross-circle'} text-xs`} />
                {confirmPw===newPw ? 'Пароли совпадают' : 'Пароли не совпадают'}
              </div>
            )}
          </Field>

          {msg && (
            <div style={{ padding:'10px 14px', borderRadius:12, display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:500,
              background: msg.type==='ok'?'#F0FDF4':'#FEF2F2',
              color: msg.type==='ok'?'#15803D':'#DC2626',
              border: `1px solid ${msg.type==='ok'?'#BBF7D0':'#FECACA'}` }}>
              <i className={`ki-filled ${msg.type==='ok'?'ki-check-circle':'ki-information-5'} text-sm`} />
              {msg.text}
            </div>
          )}

          <button
            onClick={handleChange}
            disabled={saving || !newPw || newPw !== confirmPw}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              saving || !newPw || newPw !== confirmPw
                ? 'cursor-not-allowed bg-border text-muted-foreground'
                : 'bg-[linear-gradient(135deg,#7C3AED,#6D28D9)] text-white shadow-[0_8px_20px_rgba(124,58,237,0.24)]'
            }`}
          >
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Сохранение…</> : <><i className="ki-filled ki-lock text-sm" />Сохранить новый пароль</>}
          </button>
        </div>
      )}
    </Card>
  )
}

// ── Главный компонент ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useUser()
  const userId = user?.id
  const [tab, setTab] = useState<Tab>('personal')
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Загрузка данных
  useEffect(() => {
    if (!userId) return
    const sb = getSB()
    async function load() {
      const [{ data: ath }, { data: usr }] = await Promise.all([
        sb.from('athletes').select('*').eq('id', userId).maybeSingle(),
        sb.from('users').select('*').eq('id', userId).maybeSingle(),
      ])
      setForm({
        first_name: ath?.first_name ?? usr?.name?.split(' ')[0] ?? '',
        last_name:  ath?.last_name  ?? usr?.name?.split(' ')[1] ?? '',
        birth_date: ath?.birth_date ?? '',
        gender:     ath?.gender ?? '',
        phone:      ath?.phone ?? '',
        email:      usr?.email ?? '',
        city:       ath?.city ?? '',
        country:    ath?.country ?? '',
        bio:        ath?.bio ?? '',
        primary_sport:       ath?.primary_sport ?? '',
        club:                ath?.club ?? '',
        fitness_level:       ath?.fitness_level ?? '',
        goal:                ath?.goal ?? '',
        weekly_training_hours: ath?.weekly_training_hours ? String(ath.weekly_training_hours) : '',
        height_cm:           ath?.height_cm ? String(ath.height_cm) : '',
        weight_kg:           ath?.weight_kg ? String(ath.weight_kg) : '',
        max_heart_rate:      ath?.max_heart_rate ? String(ath.max_heart_rate) : '',
        lactate_threshold_hr: ath?.lactate_threshold_hr ? String(ath.lactate_threshold_hr) : '',
        vo2max:              ath?.vo2max ? String(ath.vo2max) : '',
        hrv_baseline:        ath?.hrv_baseline ? String(ath.hrv_baseline) : '',
        rhr_baseline:        ath?.rhr_baseline ? String(ath.rhr_baseline) : '',
        profile_public:  ath?.profile_public  ?? true,
        workouts_public: ath?.workouts_public ?? false,
      })
      setLoading(false)
    }
    load()
  }, [userId])

  const set = useCallback((key: keyof FormData) => (value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const sb = getSB()
    const payload = {
      id: userId,
      first_name:   form.first_name || null,
      last_name:    form.last_name  || null,
      birth_date:   form.birth_date || null,
      gender:       form.gender     || null,
      phone:        form.phone      || null,
      city:         form.city       || null,
      country:      form.country    || null,
      bio:          form.bio        || null,
      primary_sport:        form.primary_sport        || null,
      club:                 form.club                 || null,
      fitness_level:        form.fitness_level        || null,
      goal:                 form.goal                 || null,
      weekly_training_hours: form.weekly_training_hours ? Number(form.weekly_training_hours) : null,
      height_cm:            form.height_cm  ? Number(form.height_cm)  : null,
      weight_kg:            form.weight_kg  ? Number(form.weight_kg)  : null,
      max_heart_rate:       form.max_heart_rate       ? Number(form.max_heart_rate)       : null,
      lactate_threshold_hr: form.lactate_threshold_hr ? Number(form.lactate_threshold_hr) : null,
      vo2max:               form.vo2max      ? Number(form.vo2max)      : null,
      hrv_baseline:         form.hrv_baseline ? Number(form.hrv_baseline) : null,
      rhr_baseline:         form.rhr_baseline ? Number(form.rhr_baseline) : null,
      profile_public:  form.profile_public,
      workouts_public: form.workouts_public,
      updated_at: new Date().toISOString(),
    }
    await sb.from('athletes').upsert(payload, { onConflict: 'id' })
    // Обновляем имя пользователя в таблице users
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ')
    if (fullName) await sb.from('users').update({ name: fullName }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const completion = calcCompletion(form)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const activeTab = TABS.find(t => t.id === tab)!
  const completionTone = completion >= 80 ? '#16A34A' : completion >= 40 ? '#F97316' : '#E11D48'
  const completionLabel =
    completion >= 80 ? 'Профиль выглядит сильным и почти готов к работе с тренером.' :
    completion >= 40 ? 'База уже собрана, но есть поля, которые усилят аналитику.' :
    'Заполните ключевые данные, чтобы рекомендации и аналитика были точнее.'

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-[32px] border border-orange-100 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),_transparent_34%),linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_54%,#FFF4EC_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                Athlete Workspace
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Settings Hub
              </span>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-white/80 text-muted-foreground transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
              >
                <i className="ki-filled ki-left text-sm" />
              </Link>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Настройки</p>
                <h1 className="pf-num mt-1 text-[clamp(2.2rem,4vw,4rem)] leading-[0.95] text-foreground">
                  Профиль атлета
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Управляйте персональными данными, спортивным контекстом, физиологией и приватностью в одном рабочем пространстве.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Заполнено</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${completion}%`, background: completionTone }}
                  />
                </div>
                <span className="pf-num text-xl text-foreground">{completion}%</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{completionLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Текущий фокус</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{activeTab.label}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{tabDescriptions[activeTab.id]}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 px-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Навигация</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Переключайтесь между блоками профиля и добивайте заполненность без потери контекста.</p>
            </div>
            <div className="flex flex-col gap-2">
              {TABS.map(t => {
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      active
                        ? 'border-orange-200 bg-orange-50 shadow-sm'
                        : 'border-transparent bg-background hover:border-border hover:bg-accent/60'
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${t.color}18` }}
                    >
                      <i className={`ki-filled ${t.icon} text-sm`} style={{ color: t.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-foreground'}`}>{t.label}</div>
                      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{tabDescriptions[t.id]}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Что внутри</div>
            <ul className="mt-3 flex flex-col gap-2">
              {tabHighlights[activeTab.id].map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 rounded-2xl bg-accent/40 px-3 py-2 text-sm text-foreground">
                  <i className="ki-filled ki-check-circle mt-0.5 text-xs text-orange-500" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Статус сохранения</div>
            <div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <i className={`ki-filled ${saved ? 'ki-check-circle' : saving ? 'ki-loading' : 'ki-shield-tick'} text-sm ${saved ? 'text-emerald-600' : saving ? 'text-orange-500' : 'text-blue-600'}`} />
                {saving ? 'Идет сохранение' : saved ? 'Изменения сохранены' : 'Можно обновлять профиль'}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {saving
                  ? 'Данные отправляются в профиль спортсмена и таблицу пользователей.'
                  : saved
                    ? 'Профиль обновлен и готов для дальнейшей настройки.'
                    : 'Когда закончите с блоком, сохраните изменения одним действием.'}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Section</div>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">{activeTab.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tabDescriptions[activeTab.id]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Completion: {completion}%
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                    saving
                      ? 'cursor-not-allowed bg-border text-muted-foreground'
                      : saved
                        ? 'bg-[linear-gradient(135deg,#16A34A,#15803D)] text-white shadow-[0_10px_24px_rgba(22,163,74,0.25)]'
                        : 'bg-[linear-gradient(135deg,#F97316,#EA580C)] text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)]'
                  }`}
                >
                  {saving ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Сохранение…</>
                  ) : saved ? (
                    <><i className="ki-filled ki-check text-sm" />Сохранено</>
                  ) : (
                    <><i className="ki-filled ki-check text-sm" />Сохранить изменения</>
                  )}
                </button>
              </div>
            </div>
          </section>

      {/* ── Content ── */}

      {/* ═══════════════ ЛИЧНЫЕ ДАННЫЕ ═══════════════ */}
      {tab === 'personal' && (
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader icon="ki-profile-circle" color="#F97316" title="Личные данные" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Имя">
                <Input value={form.first_name} onChange={set('first_name')} placeholder="Иван" />
              </Field>
              <Field label="Фамилия">
                <Input value={form.last_name} onChange={set('last_name')} placeholder="Иванов" />
              </Field>
              <Field label="Дата рождения">
                <Input value={form.birth_date} onChange={set('birth_date')} type="date" />
              </Field>
              <Field label="Пол">
                <Select value={form.gender} onChange={set('gender')} options={GENDERS} />
              </Field>
              <Field label="Телефон">
                <Input value={form.phone} onChange={set('phone')} placeholder="+7 900 000 00 00" type="tel" />
              </Field>
              <Field label="Email" hint="Изменение потребует подтверждения">
                <input value={form.email} readOnly className={`${inputClassName} cursor-not-allowed opacity-60`} />
              </Field>
              <Field label="Город">
                <Input value={form.city} onChange={set('city')} placeholder="Москва" />
              </Field>
              <Field label="Страна">
                <Select value={form.country} onChange={set('country')} options={COUNTRIES} />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader icon="ki-message-text" color="#8B5CF6" title="О себе" />
            <Field label="Расскажите о себе">
              <textarea
                value={form.bio} onChange={e => set('bio')(e.target.value)}
                rows={4} placeholder="Расскажите о себе, опыте, целях…"
                className={textareaClassName} />
            </Field>
          </Card>
        </div>
      )}

      {/* ═══════════════ СПОРТ ═══════════════ */}
      {tab === 'sport' && (
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader icon="ki-abstract-26" color="#2563EB" title="Спортивный профиль" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Вид спорта">
                <Select value={SPORTS.some(s => s.value === form.primary_sport) ? form.primary_sport : (form.primary_sport ? 'Другое' : '')}
                  onChange={v => { if (v !== 'Другое') set('primary_sport')(v); else set('primary_sport')('') }}
                  options={SPORTS} />
                {/* Поле ручного ввода если выбрано "Другое" или значение не из списка */}
                {(form.primary_sport === 'Другое' || (form.primary_sport && !SPORTS.slice(1).find(s => s.value === form.primary_sport && s.value !== 'Другое'))) && (
                  <input
                    value={form.primary_sport === 'Другое' ? '' : form.primary_sport}
                    onChange={e => set('primary_sport')(e.target.value)}
                    placeholder="Введите название вида спорта…"
                    style={{ ...iStyle, marginTop: 8 }}
                    onFocus={e => (e.target.style.borderColor = '#2563EB')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    autoFocus
                  />
                )}
              </Field>
              <Field label="Уровень подготовки">
                <Select value={form.fitness_level} onChange={set('fitness_level')} options={FITNESS_LEVELS} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Цель тренировок">
                <Select value={form.goal} onChange={set('goal')} options={GOALS} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Часов тренировок в неделю" hint="Среднее количество часов">
                <Input value={form.weekly_training_hours} onChange={set('weekly_training_hours')}
                  type="number" placeholder="8" min="0" max="40" />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader icon="ki-people" color="#0284C7" title="Клуб / Организация" />
            <Field label="Клуб или спортивная организация" hint="Название клуба, команды или организации, к которой вы относитесь">
              <div style={{ position: 'relative' }}>
                <i className="ki-filled ki-people" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted-foreground)', fontSize: 14, pointerEvents: 'none',
                }} />
                <input
                  value={form.club} onChange={e => set('club')(e.target.value)}
                  placeholder="Например: ЦСКА, Динамо, Nike Running Club…"
                  style={{ ...iStyle, paddingLeft: 40 }}
                  onFocus={e => (e.target.style.borderColor = '#0284C7')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </Field>
            <div style={{
              marginTop: 16, padding: '14px 16px', borderRadius: 14,
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <i className="ki-filled ki-information-5" style={{ color: '#2563EB', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
                Если ваша организация зарегистрирована в ProForm, вы можете получить приглашение и автоматически
                привязаться к ней. Обратитесь к администратору организации.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════ ФИЗИОЛОГИЯ ═══════════════ */}
      {tab === 'physio' && (
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader icon="ki-abstract-31" color="#E11D48" title="Антропометрия" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Рост (см)" hint="100 – 250 см">
                <Input value={form.height_cm} onChange={set('height_cm')} type="number" placeholder="175" min="100" max="250" />
              </Field>
              <Field label="Вес (кг)" hint="30 – 300 кг">
                <Input value={form.weight_kg} onChange={set('weight_kg')} type="number" placeholder="70" min="30" max="300" />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader icon="ki-heart" color="#E11D48" title="Кардио-параметры" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Макс. ЧСС (уд/мин)" hint="Максимальная частота сердечных сокращений">
                <Input value={form.max_heart_rate} onChange={set('max_heart_rate')} type="number" placeholder="185" min="100" max="230" />
              </Field>
              <Field label="Лакт. порог ЧСС" hint="ЧСС на лактатном пороге">
                <Input value={form.lactate_threshold_hr} onChange={set('lactate_threshold_hr')} type="number" placeholder="160" min="60" max="220" />
              </Field>
              <Field label="VO2max (мл/кг/мин)" hint="Максимальное потребление кислорода">
                <Input value={form.vo2max} onChange={set('vo2max')} type="number" placeholder="50" min="20" max="90" />
              </Field>
              <Field label="ЧСС покоя (уд/мин)" hint="ЧСС в состоянии покоя">
                <Input value={form.rhr_baseline} onChange={set('rhr_baseline')} type="number" placeholder="55" min="30" max="100" />
              </Field>
              <Field label="HRV базовый (мс)" hint="Вариабельность сердечного ритма">
                <Input value={form.hrv_baseline} onChange={set('hrv_baseline')} type="number" placeholder="45" min="10" max="200" />
              </Field>
            </div>
            {/* Подсказки */}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                { label: 'VO2max', icon: 'ki-chart-line-up', color: '#16A34A', hint: 'Отличный: >55, Хороший: 45–55, Средний: 35–45' },
                { label: 'HRV', icon: 'ki-heart', color: '#E11D48', hint: 'Норма: 20–100 мс. Выше — лучше восстановление' },
              ].map(h => (
                <div key={h.label} style={{ padding: '10px 14px', borderRadius: 12, background: h.color + '0D', border: `1px solid ${h.color}25` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <i className={`ki-filled ${h.icon} text-xs`} style={{ color: h.color }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: h.color }}>{h.label}</span>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>{h.hint}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════ ПРИВАТНОСТЬ ═══════════════ */}
      {tab === 'privacy' && (
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader icon="ki-shield-tick" color="#16A34A" title="Настройки приватности" />
            <div className="flex flex-col gap-5">
              <Toggle
                value={form.profile_public}
                onChange={v => set('profile_public')(v)}
                label="Публичный профиль"
                hint="Другие пользователи могут видеть ваш профиль, имя и спортивный вид"
              />
              <div className="h-px bg-border" />
              <Toggle
                value={form.workouts_public}
                onChange={v => set('workouts_public')(v)}
                label="Публичные тренировки"
                hint="Тренеры и другие атлеты могут видеть ваш дневник тренировок"
              />
            </div>
          </Card>

          {/* ── Смена пароля ── */}
          <PasswordCard />

          <Card>
            <SectionHeader icon="ki-eye" color="#0284C7" title="Доступ тренера" />
            <div style={{ padding: '14px 16px', borderRadius: 14, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <i className="ki-filled ki-verify text-sm" style={{ color: '#16A34A' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>Тренер имеет доступ</span>
              </div>
              <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.5 }}>
                Если вы добавлены в программу тренера, он видит ваши тренировки и может оставлять комментарии.
                Вы можете отозвать доступ в настройках тренера.
              </p>
            </div>
          </Card>

          <Card className="bg-accent">
            <SectionHeader icon="ki-trash" color="#DC2626" title="Опасная зона" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>Удалить аккаунт</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Безвозвратное удаление всех данных</div>
              </div>
              <button style={{
                padding: '9px 18px', borderRadius: 12,
                border: '1.5px solid #FECACA', background: '#FEF2F2',
                color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2' }}
                onClick={() => alert('Функция в разработке')}>
                <i className="ki-filled ki-trash text-sm" />Удалить аккаунт
              </button>
            </div>
          </Card>
        </div>
      )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border bg-card px-5 py-4 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-foreground">Завершили блок?</div>
              <p className="mt-1 text-xs text-muted-foreground">Сохраните изменения, чтобы обновить карточку спортсмена и связанный профиль пользователя.</p>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm font-semibold text-emerald-600">
                  Данные обновлены
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                  saving
                    ? 'cursor-not-allowed bg-border text-muted-foreground'
                    : saved
                      ? 'bg-[linear-gradient(135deg,#16A34A,#15803D)] text-white shadow-[0_10px_24px_rgba(22,163,74,0.25)]'
                      : 'bg-[linear-gradient(135deg,#F97316,#EA580C)] text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)]'
                }`}
              >
                {saving ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Сохранение…</>
                ) : saved ? (
                  <><i className="ki-filled ki-check text-sm" />Сохранено</>
                ) : (
                  <><i className="ki-filled ki-check text-sm" />Сохранить изменения</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
