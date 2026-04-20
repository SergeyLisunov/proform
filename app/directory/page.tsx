'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type DirType = 'coach' | 'doctor' | 'organization'

type CoachRow = {
  id: string; first_name: string | null; last_name: string | null
  city: string | null; country: string | null; bio: string | null
  specialization: string | null; experience_years: number | null
  hourly_rate: number | null; currency: string | null
  session_formats: string[] | null; accepts_new_athletes: boolean | null
  sports: string[] | null; workplace: string | null
  athletes_count: number | null
  users: { avatar_url: string | null; nickname: string | null } | null
}
type DoctorRow = {
  id: string; first_name: string | null; last_name: string | null
  city: string | null; country: string | null; bio: string | null
  medical_specialization: string | null; experience_years: number | null
  consultation_fee: number | null; currency: string | null
  services: string[] | null; consultation_formats: string[] | null
  accepts_new_patients: boolean | null; main_focus: string | null
  workplace: string | null; emergency_contact: boolean | null
  users: { avatar_url: string | null; nickname: string | null } | null
}
type OrgRow = {
  id: string; org_name: string | null; org_slug: string | null
  description: string | null; city: string | null; country: string | null
  sport_type: string | null; org_type: string | null
  founded_year: number | null; members_count: number | null
  coaches_count: number | null; services: string[] | null
  training_base: string | null
  users: { avatar_url: string | null } | null
}

const TYPES: { id: DirType; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'coach',        label: 'Тренеры',       icon: 'ki-teacher', color: '#16A34A', bg: '#F0FDF4' },
  { id: 'doctor',       label: 'Врачи',         icon: 'ki-heart',   color: '#DC2626', bg: '#FEF2F2' },
  { id: 'organization', label: 'Организации',   icon: 'ki-home-2',  color: '#2563EB', bg: '#EFF6FF' },
]

const COACH_SPEC = [
  { v: '',             l: 'Любая' },
  { v: 'running',      l: 'Беговая' },
  { v: 'cycling',      l: 'Велоспорт' },
  { v: 'swimming',     l: 'Плавание' },
  { v: 'triathlon',    l: 'Триатлон' },
  { v: 'strength',     l: 'Силовая' },
  { v: 'crossfit',     l: 'Кроссфит' },
  { v: 'functional',   l: 'Функциональная' },
  { v: 'team_sports',  l: 'Командные' },
  { v: 'martial_arts', l: 'Единоборства' },
  { v: 'nutrition',    l: 'Питание' },
  { v: 'rehab',        l: 'Реабилитация' },
]

const COACH_FORMATS = [
  { v: '',        l: 'Любой формат' },
  { v: 'offline', l: 'Очно' },
  { v: 'online',  l: 'Онлайн' },
  { v: 'home',    l: 'Выезд' },
  { v: 'group',   l: 'Группа' },
  { v: 'camp',    l: 'Сборы' },
  { v: 'async',   l: 'Async-план' },
]

const DOCTOR_SPEC = [
  { v: '',               l: 'Любая' },
  { v: 'sports_medicine',l: 'Спортивная медицина' },
  { v: 'cardiology',     l: 'Кардиология' },
  { v: 'orthopedics',    l: 'Ортопедия' },
  { v: 'physio',         l: 'Физиотерапия' },
  { v: 'nutrition',      l: 'Диетология' },
  { v: 'psychiatry',     l: 'Психология' },
  { v: 'endocrinology',  l: 'Эндокринология' },
  { v: 'general',        l: 'Общая практика' },
]

const DOCTOR_FORMATS = [
  { v: '',          l: 'Любой формат' },
  { v: 'offline',   l: 'Очно' },
  { v: 'online',    l: 'Телемедицина' },
  { v: 'home',      l: 'На дому' },
  { v: 'emergency', l: 'Экстренно' },
]

const ORG_TYPES = [
  { v: '',           l: 'Любой тип' },
  { v: 'club',       l: 'Клуб' },
  { v: 'federation', l: 'Федерация' },
  { v: 'team',       l: 'Команда' },
  { v: 'school',     l: 'Школа' },
  { v: 'gym',        l: 'Фитнес-центр' },
  { v: 'academy',    l: 'Академия' },
]

const SPORT_TYPES = [
  { v: '',             l: 'Любой спорт' },
  { v: 'Бег',          l: 'Бег' },
  { v: 'Велоспорт',    l: 'Велоспорт' },
  { v: 'Плавание',     l: 'Плавание' },
  { v: 'Триатлон',     l: 'Триатлон' },
  { v: 'Силовые',      l: 'Силовые' },
  { v: 'Футбол',       l: 'Футбол' },
  { v: 'Баскетбол',    l: 'Баскетбол' },
  { v: 'Хоккей',       l: 'Хоккей' },
  { v: 'Мультиспорт',  l: 'Мультиспорт' },
]

const FORMAT_LABELS: Record<string, string> = {
  offline: 'Очно', online: 'Онлайн', home: 'Выезд',
  group: 'Группа', camp: 'Сборы', async: 'Async',
  emergency: 'Экстренно',
}
const ORG_TYPE_LABELS: Record<string, string> = {
  club: 'Клуб', federation: 'Федерация', team: 'Команда',
  school: 'Школа', gym: 'Фитнес', academy: 'Академия', other: 'Другое',
}

export default function DirectoryPage() {
  const [type, setType] = useState<DirType>('coach')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [format, setFormat] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [acceptsNew, setAcceptsNew] = useState(false)
  const [sportType, setSportType] = useState('')
  const [orgType, setOrgType] = useState('')

  const [items, setItems] = useState<(CoachRow | DoctorRow | OrgRow)[]>([])
  const [loading, setLoading] = useState(false)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ type })
    if (q) params.set('q', q)
    if (city) params.set('city', city)
    if (specialization) params.set('specialization', specialization)
    if (format) params.set('format', format)
    if (maxPrice) params.set('max_price', maxPrice)
    if (acceptsNew) params.set('accepts', '1')
    if (sportType) params.set('sport_type', sportType)
    if (orgType) params.set('org_type', orgType)
    return params.toString()
  }, [type, q, city, specialization, format, maxPrice, acceptsNew, sportType, orgType])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/directory?${queryString}`)
        .then(r => r.json())
        .then(d => setItems(d.items ?? []))
        .finally(() => setLoading(false))
    }, 220)
    return () => clearTimeout(t)
  }, [queryString])

  const reset = () => {
    setQ(''); setCity(''); setSpecialization(''); setFormat('')
    setMaxPrice(''); setAcceptsNew(false); setSportType(''); setOrgType('')
  }

  function changeType(t: DirType) {
    setType(t); reset()
  }

  const activeTypeMeta = TYPES.find(x => x.id === type)!

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-muted-foreground">Директория</p>
        <h1 className="pf-num text-[32px] leading-tight text-foreground">Найти специалиста</h1>
        <p className="mt-1 text-sm text-muted-foreground">Тренеры, спортивные врачи и организации с открытыми профилями.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1">
        {TYPES.map(t => {
          const active = t.id === type
          return (
            <button
              key={t.id}
              onClick={() => changeType(t.id)}
              className={`flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              style={active ? { color: t.color } : undefined}
            >
              <i className={`ki-filled ${t.icon} text-[14px]`} />
              {t.label}
            </button>
          )
        })}
      </div>

      <section className="rounded-[20px] border border-border bg-card p-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            placeholder={type === 'organization' ? 'Название, описание…' : 'Имя, bio, место работы…'}
            value={q} onChange={e => setQ(e.target.value)}
            className="col-span-full lg:col-span-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400"
          />
          <input
            placeholder="Город"
            value={city} onChange={e => setCity(e.target.value)}
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400"
          />
          {type === 'coach' && (
            <>
              <select value={specialization} onChange={e => setSpecialization(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {COACH_SPEC.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={format} onChange={e => setFormat(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {COACH_FORMATS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input
                type="number" placeholder="Макс. цена/час"
                value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400"
              />
              <label className="col-span-full sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={acceptsNew} onChange={e => setAcceptsNew(e.target.checked)} className="accent-orange-500" />
                Только принимающие новых атлетов
              </label>
            </>
          )}
          {type === 'doctor' && (
            <>
              <select value={specialization} onChange={e => setSpecialization(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {DOCTOR_SPEC.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={format} onChange={e => setFormat(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {DOCTOR_FORMATS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input
                type="number" placeholder="Макс. цена консультации"
                value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400"
              />
              <label className="col-span-full sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={acceptsNew} onChange={e => setAcceptsNew(e.target.checked)} className="accent-orange-500" />
                Только принимающие новых пациентов
              </label>
            </>
          )}
          {type === 'organization' && (
            <>
              <select value={orgType} onChange={e => setOrgType(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {ORG_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={sportType} onChange={e => setSportType(e.target.value)} className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-orange-400">
                {SPORT_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {loading ? 'Поиск…' : `Найдено: ${items.length}`}
          </span>
          <button onClick={reset} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Сбросить фильтры</button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Ничего не найдено. Попробуйте изменить фильтры.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            if (type === 'coach')        return <CoachCard  key={item.id} c={item as CoachRow} meta={activeTypeMeta} />
            if (type === 'doctor')       return <DoctorCard key={item.id} d={item as DoctorRow} meta={activeTypeMeta} />
            return <OrgCard key={item.id} o={item as OrgRow} meta={activeTypeMeta} />
          })}
        </div>
      )}
    </div>
  )
}

function Avatar({ url, initials, color }: { url: string | null; initials: string; color: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border" style={{ background: url ? 'transparent' : `${color}18` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold" style={{ color }}>
          {initials || '—'}
        </div>
      )}
    </div>
  )
}

function Chip({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: color ?? 'var(--muted-foreground)', background: bg ?? 'var(--accent)', border: '1px solid var(--border)' }}>
      {text}
    </span>
  )
}

function CoachCard({ c, meta }: { c: CoachRow; meta: typeof TYPES[number] }) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Тренер'
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const formats = (c.session_formats ?? []).map(k => FORMAT_LABELS[k] ?? k).slice(0, 3)
  return (
    <Link href={`/profile/${c.id}`} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 no-underline hover:border-green-400 transition">
      <div className="flex items-center gap-3">
        <Avatar url={c.users?.avatar_url ?? null} initials={initials} color={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {c.specialization ?? 'Тренер'}{c.city ? ` · ${c.city}` : ''}
          </div>
        </div>
        {c.accepts_new_athletes && <Chip text="Набор" color="#16A34A" bg="#F0FDF4" />}
      </div>
      {c.bio && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.bio}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {formats.map(f => <Chip key={f} text={f} />)}
        {c.experience_years != null && <Chip text={`${c.experience_years} л опыта`} />}
        {c.athletes_count != null && <Chip text={`${c.athletes_count} атлетов`} />}
      </div>
      {c.hourly_rate != null && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ставка</span>
          <span className="pf-num text-base font-bold text-foreground">{c.hourly_rate} <span className="text-xs text-muted-foreground">{c.currency ?? 'RUB'}/ч</span></span>
        </div>
      )}
    </Link>
  )
}

function DoctorCard({ d, meta }: { d: DoctorRow; meta: typeof TYPES[number] }) {
  const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Врач'
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const formats = (d.consultation_formats ?? []).map(k => FORMAT_LABELS[k] ?? k).slice(0, 3)
  return (
    <Link href={`/profile/${d.id}`} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 no-underline hover:border-red-400 transition">
      <div className="flex items-center gap-3">
        <Avatar url={d.users?.avatar_url ?? null} initials={initials} color={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {d.medical_specialization ?? 'Врач'}{d.city ? ` · ${d.city}` : ''}
          </div>
        </div>
        {d.accepts_new_patients && <Chip text="Приём" color="#DC2626" bg="#FEF2F2" />}
      </div>
      {d.main_focus && <p className="text-xs text-foreground leading-relaxed line-clamp-1"><span className="text-muted-foreground">Фокус: </span>{d.main_focus}</p>}
      {d.bio && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{d.bio}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {formats.map(f => <Chip key={f} text={f} />)}
        {d.experience_years != null && <Chip text={`${d.experience_years} л опыта`} />}
        {d.emergency_contact && <Chip text="Экстренно" color="#B91C1C" bg="#FEE2E2" />}
      </div>
      {d.consultation_fee != null && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Консультация</span>
          <span className="pf-num text-base font-bold text-foreground">{d.consultation_fee} <span className="text-xs text-muted-foreground">{d.currency ?? 'RUB'}</span></span>
        </div>
      )}
    </Link>
  )
}

function OrgCard({ o, meta }: { o: OrgRow; meta: typeof TYPES[number] }) {
  const initials = (o.org_name ?? 'O').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const typeLabel = o.org_type ? (ORG_TYPE_LABELS[o.org_type] ?? o.org_type) : null
  return (
    <Link href={`/profile/${o.id}`} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 no-underline hover:border-blue-400 transition">
      <div className="flex items-center gap-3">
        <Avatar url={o.users?.avatar_url ?? null} initials={initials} color={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{o.org_name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {[typeLabel, o.sport_type, o.city].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      {o.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{o.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {o.founded_year != null && <Chip text={`c ${o.founded_year}`} />}
        {o.members_count != null && <Chip text={`${o.members_count} чел`} />}
        {o.coaches_count != null && <Chip text={`${o.coaches_count} тренеров`} />}
      </div>
    </Link>
  )
}
