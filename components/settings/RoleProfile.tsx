'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { AppUser } from '@/lib/hooks/useUser'
import {
  ProfileShell,
  FormSection,
  Field,
  TextInput,
  TextArea,
  Select,
  Toggle,
} from './ProfileShell'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

type Role = 'coach' | 'doctor' | 'organization' | 'admin'

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

const COACH_SPECIALIZATIONS = [
  { value: '', label: '— Выбрать —' },
  { value: 'running', label: 'Беговая подготовка' },
  { value: 'cycling', label: 'Велоспорт' },
  { value: 'swimming', label: 'Плавание' },
  { value: 'triathlon', label: 'Триатлон' },
  { value: 'strength', label: 'Силовая подготовка' },
  { value: 'crossfit', label: 'Кроссфит' },
  { value: 'functional', label: 'Функциональная подготовка' },
  { value: 'team_sports', label: 'Командные виды' },
  { value: 'martial_arts', label: 'Единоборства' },
  { value: 'nutrition', label: 'Спортивное питание' },
  { value: 'rehab', label: 'Реабилитация' },
  { value: 'other', label: 'Другое' },
]

const MEDICAL_SPECIALIZATIONS = [
  { value: '', label: '— Выбрать —' },
  { value: 'sports_medicine', label: 'Спортивная медицина' },
  { value: 'cardiology', label: 'Кардиология' },
  { value: 'orthopedics', label: 'Ортопедия / травматология' },
  { value: 'physio', label: 'Физиотерапия / реабилитация' },
  { value: 'nutrition', label: 'Диетология' },
  { value: 'psychiatry', label: 'Спортивная психология' },
  { value: 'endocrinology', label: 'Эндокринология' },
  { value: 'general', label: 'Терапия / общая практика' },
  { value: 'other', label: 'Другое' },
]

const ACCESS_LEVELS = [
  { value: '', label: '— Выбрать —' },
  { value: 'support', label: 'Поддержка' },
  { value: 'moderator', label: 'Модератор' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'superadmin', label: 'Суперадмин' },
]

const SPORT_TYPES = [
  { value: '', label: '— Выбрать —' },
  { value: 'Бег', label: '🏃 Бег' },
  { value: 'Велоспорт', label: '🚴 Велоспорт' },
  { value: 'Плавание', label: '🏊 Плавание' },
  { value: 'Триатлон', label: '🏅 Триатлон' },
  { value: 'Силовые', label: '🏋️ Силовые' },
  { value: 'Футбол', label: '⚽ Футбол' },
  { value: 'Баскетбол', label: '🏀 Баскетбол' },
  { value: 'Хоккей', label: '🏒 Хоккей' },
  { value: 'Мультиспорт', label: '🎯 Мультиспорт' },
  { value: 'Другое', label: '✏️ Другое' },
]

type CoachForm = {
  first_name: string; last_name: string; birth_date: string; gender: string
  phone: string; city: string; country: string; bio: string
  specialization: string; experience_years: string; education: string
  certifications_text: string; sports_text: string; languages_text: string
  workplace: string; hourly_rate: string; currency: string
  telegram_url: string; instagram_url: string; youtube_url: string; website_url: string
  athletes_count: string; accepts_new_athletes: boolean; profile_public: boolean
}

type DoctorForm = {
  first_name: string; last_name: string; birth_date: string; gender: string
  phone: string; city: string; country: string; bio: string
  medical_specialization: string; license_number: string; license_authority: string
  education: string; degree: string; experience_years: string; workplace: string
  certifications_text: string; languages_text: string
  consultation_fee: string; currency: string
  telegram_url: string; website_url: string
  accepts_new_patients: boolean; profile_public: boolean
}

type OrgForm = {
  org_name: string; org_slug: string; sport_type: string; description: string
  website_url: string; email: string; phone: string; address: string
  city: string; country: string; founded_year: string; members_count: string
  contact_person: string; languages_text: string
  instagram_url: string; telegram_url: string; youtube_url: string
  profile_public: boolean
}

type AdminForm = {
  first_name: string; last_name: string; phone: string
  city: string; country: string; bio: string
  department: string; access_level: string; notes: string
}

const EMPTY_COACH: CoachForm = {
  first_name: '', last_name: '', birth_date: '', gender: '',
  phone: '', city: '', country: '', bio: '',
  specialization: '', experience_years: '', education: '',
  certifications_text: '', sports_text: '', languages_text: '',
  workplace: '', hourly_rate: '', currency: 'RUB',
  telegram_url: '', instagram_url: '', youtube_url: '', website_url: '',
  athletes_count: '', accepts_new_athletes: true, profile_public: true,
}
const EMPTY_DOCTOR: DoctorForm = {
  first_name: '', last_name: '', birth_date: '', gender: '',
  phone: '', city: '', country: '', bio: '',
  medical_specialization: '', license_number: '', license_authority: '',
  education: '', degree: '', experience_years: '', workplace: '',
  certifications_text: '', languages_text: '',
  consultation_fee: '', currency: 'RUB',
  telegram_url: '', website_url: '',
  accepts_new_patients: true, profile_public: true,
}
const EMPTY_ORG: OrgForm = {
  org_name: '', org_slug: '', sport_type: '', description: '',
  website_url: '', email: '', phone: '', address: '',
  city: '', country: '', founded_year: '', members_count: '',
  contact_person: '', languages_text: '',
  instagram_url: '', telegram_url: '', youtube_url: '',
  profile_public: true,
}
const EMPTY_ADMIN: AdminForm = {
  first_name: '', last_name: '', phone: '',
  city: '', country: '', bio: '',
  department: '', access_level: '', notes: '',
}

function listFromText(v: string): string[] {
  return v.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}
function textFromList(v: string[] | null | undefined): string {
  return (v ?? []).join(', ')
}
function certsFromText(v: string): { name: string }[] {
  return v.split(/\n/).map(s => s.trim()).filter(Boolean).map(name => ({ name }))
}
function textFromCerts(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return v.map(c => (typeof c === 'string' ? c : (c as { name?: string })?.name ?? '')).filter(Boolean).join('\n')
}

type TabDef = { id: string; label: string; icon: string; color: string }

const COACH_TABS: TabDef[] = [
  { id: 'personal',  label: 'Личные данные',     icon: 'ki-profile-circle', color: '#F97316' },
  { id: 'professional', label: 'Профессия',      icon: 'ki-abstract-26',    color: '#2563EB' },
  { id: 'experience', label: 'Опыт и ставка',    icon: 'ki-medal-star',     color: '#0D9488' },
  { id: 'contacts',  label: 'Контакты',          icon: 'ki-people',         color: '#7C3AED' },
  { id: 'privacy',   label: 'Приватность',       icon: 'ki-shield-tick',    color: '#16A34A' },
]

const DOCTOR_TABS: TabDef[] = [
  { id: 'personal',    label: 'Личные данные',   icon: 'ki-profile-circle', color: '#F97316' },
  { id: 'medical',     label: 'Специализация',   icon: 'ki-heart',          color: '#E11D48' },
  { id: 'education',   label: 'Образование',     icon: 'ki-book',           color: '#2563EB' },
  { id: 'practice',    label: 'Практика',        icon: 'ki-briefcase',      color: '#0D9488' },
  { id: 'privacy',     label: 'Приватность',     icon: 'ki-shield-tick',    color: '#16A34A' },
]

const ORG_TABS: TabDef[] = [
  { id: 'main',      label: 'Основное',          icon: 'ki-home-2',         color: '#F97316' },
  { id: 'contacts',  label: 'Контакты',          icon: 'ki-sms',            color: '#2563EB' },
  { id: 'social',    label: 'Соцсети',           icon: 'ki-share',          color: '#7C3AED' },
  { id: 'privacy',   label: 'Приватность',       icon: 'ki-shield-tick',    color: '#16A34A' },
]

const ADMIN_TABS: TabDef[] = [
  { id: 'personal', label: 'Личные данные',      icon: 'ki-profile-circle', color: '#F97316' },
  { id: 'role',     label: 'Права доступа',      icon: 'ki-shield-tick',    color: '#16A34A' },
  { id: 'contacts', label: 'Контакты',           icon: 'ki-sms',            color: '#2563EB' },
]

export default function RoleProfile({ user }: { user: AppUser }) {
  const role = user.role as Role

  const [tab, setTab] = useState<string>(
    role === 'coach' ? 'personal' :
    role === 'doctor' ? 'personal' :
    role === 'organization' ? 'main' :
    'personal',
  )

  const [coach, setCoach]   = useState<CoachForm>(EMPTY_COACH)
  const [doctor, setDoctor] = useState<DoctorForm>(EMPTY_DOCTOR)
  const [org, setOrg]       = useState<OrgForm>(EMPTY_ORG)
  const [admin, setAdmin]   = useState<AdminForm>(EMPTY_ADMIN)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const tabs =
    role === 'coach' ? COACH_TABS :
    role === 'doctor' ? DOCTOR_TABS :
    role === 'organization' ? ORG_TABS :
    ADMIN_TABS

  const title =
    role === 'coach' ? 'Профиль тренера' :
    role === 'doctor' ? 'Профиль врача' :
    role === 'organization' ? 'Профиль организации' :
    'Профиль администратора'

  const subtitle =
    role === 'coach' ? 'Расскажите атлетам о своём опыте и специализации' :
    role === 'doctor' ? 'Медицинская специализация, образование и практика' :
    role === 'organization' ? 'Информация о клубе, федерации или команде' :
    'Служебные настройки и контакты'

  const roleBadge =
    role === 'coach' ? 'Тренер' :
    role === 'doctor' ? 'Врач' :
    role === 'organization' ? 'Организация' :
    'Админ'

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const sb = getSB()
    async function load() {
      const [{ data: usr }] = await Promise.all([
        sb.from('users').select('*').eq('id', user.id).maybeSingle(),
      ])
      setAvatarUrl((usr as { avatar_url?: string | null } | null)?.avatar_url ?? null)

      if (role === 'coach') {
        const { data } = await sb.from('coaches').select('*').eq('id', user.id).maybeSingle()
        const c = (data ?? {}) as Record<string, unknown>
        setCoach({
          first_name: String(c.first_name ?? (usr as any)?.name?.split(' ')[0] ?? ''),
          last_name:  String(c.last_name ?? (usr as any)?.name?.split(' ')[1] ?? ''),
          birth_date: String(c.birth_date ?? ''),
          gender:     String(c.gender ?? ''),
          phone:      String(c.phone ?? ''),
          city:       String(c.city ?? ''),
          country:    String(c.country ?? ''),
          bio:        String(c.bio ?? ''),
          specialization:   String(c.specialization ?? ''),
          experience_years: c.experience_years != null ? String(c.experience_years) : '',
          education:        String(c.education ?? ''),
          certifications_text: textFromCerts(c.certifications),
          sports_text:        textFromList(c.sports as string[] | null),
          languages_text:     textFromList(c.languages as string[] | null),
          workplace:   String(c.workplace ?? ''),
          hourly_rate: c.hourly_rate != null ? String(c.hourly_rate) : '',
          currency:    String(c.currency ?? 'RUB'),
          telegram_url:  String(c.telegram_url ?? ''),
          instagram_url: String(c.instagram_url ?? ''),
          youtube_url:   String(c.youtube_url ?? ''),
          website_url:   String(c.website_url ?? ''),
          athletes_count: c.athletes_count != null ? String(c.athletes_count) : '',
          accepts_new_athletes: Boolean(c.accepts_new_athletes ?? true),
          profile_public:       Boolean(c.profile_public ?? true),
        })
      } else if (role === 'doctor') {
        const { data } = await sb.from('doctors').select('*').eq('id', user.id).maybeSingle()
        const d = (data ?? {}) as Record<string, unknown>
        setDoctor({
          first_name: String(d.first_name ?? (usr as any)?.name?.split(' ')[0] ?? ''),
          last_name:  String(d.last_name ?? (usr as any)?.name?.split(' ')[1] ?? ''),
          birth_date: String(d.birth_date ?? ''),
          gender:     String(d.gender ?? ''),
          phone:      String(d.phone ?? ''),
          city:       String(d.city ?? ''),
          country:    String(d.country ?? ''),
          bio:        String(d.bio ?? ''),
          medical_specialization: String(d.medical_specialization ?? ''),
          license_number:    String(d.license_number ?? ''),
          license_authority: String(d.license_authority ?? ''),
          education: String(d.education ?? ''),
          degree:    String(d.degree ?? ''),
          experience_years: d.experience_years != null ? String(d.experience_years) : '',
          workplace: String(d.workplace ?? ''),
          certifications_text: textFromCerts(d.certifications),
          languages_text:      textFromList(d.languages as string[] | null),
          consultation_fee: d.consultation_fee != null ? String(d.consultation_fee) : '',
          currency: String(d.currency ?? 'RUB'),
          telegram_url: String(d.telegram_url ?? ''),
          website_url:  String(d.website_url ?? ''),
          accepts_new_patients: Boolean(d.accepts_new_patients ?? true),
          profile_public:       Boolean(d.profile_public ?? true),
        })
      } else if (role === 'organization') {
        const { data } = await sb.from('organizations').select('*').eq('id', user.id).maybeSingle()
        const o = (data ?? {}) as Record<string, unknown>
        setOrg({
          org_name: String(o.org_name ?? (usr as any)?.name ?? ''),
          org_slug: String(o.org_slug ?? ''),
          sport_type: String(o.sport_type ?? ''),
          description: String(o.description ?? ''),
          website_url: String(o.website_url ?? ''),
          email:   String(o.email ?? ''),
          phone:   String(o.phone ?? ''),
          address: String(o.address ?? ''),
          city:    String(o.city ?? ''),
          country: String(o.country ?? ''),
          founded_year:  o.founded_year != null ? String(o.founded_year) : '',
          members_count: o.members_count != null ? String(o.members_count) : '',
          contact_person: String(o.contact_person ?? ''),
          languages_text: textFromList(o.languages as string[] | null),
          instagram_url: String(o.instagram_url ?? ''),
          telegram_url:  String(o.telegram_url ?? ''),
          youtube_url:   String(o.youtube_url ?? ''),
          profile_public: Boolean(o.profile_public ?? true),
        })
      } else if (role === 'admin') {
        const { data } = await sb.from('admins').select('*').eq('id', user.id).maybeSingle()
        const a = (data ?? {}) as Record<string, unknown>
        setAdmin({
          first_name: String(a.first_name ?? (usr as any)?.name?.split(' ')[0] ?? ''),
          last_name:  String(a.last_name  ?? (usr as any)?.name?.split(' ')[1] ?? ''),
          phone:      String(a.phone ?? ''),
          city:       String(a.city ?? ''),
          country:    String(a.country ?? ''),
          bio:        String(a.bio ?? ''),
          department: String(a.department ?? ''),
          access_level: String(a.access_level ?? ''),
          notes:      String(a.notes ?? ''),
        })
      }
      setLoading(false)
    }
    load()
  }, [user?.id, role])

  // ── Avatar upload ───────────────────────────────────────────────────────
  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!user?.id) return
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Файл слишком большой (макс. 2 МБ)')
      setTimeout(() => setSaveError(null), 4000)
      return
    }
    setUploadingAvatar(true)
    setSaveError(null)
    try {
      const sb = getSB()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}.${ext}`
      const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path)
      const cacheBusted = `${publicUrl}?t=${Date.now()}`
      await sb.from('users').update({ avatar_url: cacheBusted }).eq('id', user.id)
      setAvatarUrl(cacheBusted)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Ошибка загрузки фото')
    } finally {
      setUploadingAvatar(false)
    }
  }, [user?.id])

  const handleAvatarDelete = useCallback(async () => {
    if (!user?.id) return
    const sb = getSB()
    await sb.from('users').update({ avatar_url: null }).eq('id', user.id)
    setAvatarUrl(null)
  }, [user?.id])

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user?.id) return
    setSaving(true)
    setSaveError(null)
    const sb = getSB()
    try {
      if (role === 'coach') {
        const payload = {
          id: user.id,
          first_name: coach.first_name || null,
          last_name:  coach.last_name  || null,
          birth_date: coach.birth_date || null,
          gender:     coach.gender     || null,
          phone:      coach.phone      || null,
          city:       coach.city       || null,
          country:    coach.country    || null,
          bio:        coach.bio        || null,
          specialization:   coach.specialization || null,
          experience_years: coach.experience_years ? Number(coach.experience_years) : null,
          education: coach.education || null,
          certifications: certsFromText(coach.certifications_text),
          sports:    listFromText(coach.sports_text),
          languages: listFromText(coach.languages_text),
          workplace: coach.workplace || null,
          hourly_rate: coach.hourly_rate ? Number(coach.hourly_rate) : null,
          currency: coach.currency || 'RUB',
          telegram_url:  coach.telegram_url  || null,
          instagram_url: coach.instagram_url || null,
          youtube_url:   coach.youtube_url   || null,
          website_url:   coach.website_url   || null,
          athletes_count: coach.athletes_count ? Number(coach.athletes_count) : null,
          accepts_new_athletes: coach.accepts_new_athletes,
          profile_public:       coach.profile_public,
          updated_at: new Date().toISOString(),
        }
        const { error } = await (sb.from('coaches') as any).upsert(payload, { onConflict: 'id' })
        if (error) throw error
        const fullName = [coach.first_name, coach.last_name].filter(Boolean).join(' ').trim()
        if (fullName) await sb.from('users').update({ name: fullName }).eq('id', user.id)
      } else if (role === 'doctor') {
        const payload = {
          id: user.id,
          first_name: doctor.first_name || null,
          last_name:  doctor.last_name  || null,
          birth_date: doctor.birth_date || null,
          gender:     doctor.gender     || null,
          phone:      doctor.phone      || null,
          city:       doctor.city       || null,
          country:    doctor.country    || null,
          bio:        doctor.bio        || null,
          medical_specialization: doctor.medical_specialization || null,
          license_number:    doctor.license_number    || null,
          license_authority: doctor.license_authority || null,
          education: doctor.education || null,
          degree:    doctor.degree    || null,
          experience_years: doctor.experience_years ? Number(doctor.experience_years) : null,
          workplace: doctor.workplace || null,
          certifications: certsFromText(doctor.certifications_text),
          languages: listFromText(doctor.languages_text),
          consultation_fee: doctor.consultation_fee ? Number(doctor.consultation_fee) : null,
          currency: doctor.currency || 'RUB',
          telegram_url: doctor.telegram_url || null,
          website_url:  doctor.website_url  || null,
          accepts_new_patients: doctor.accepts_new_patients,
          profile_public:       doctor.profile_public,
          updated_at: new Date().toISOString(),
        }
        const { error } = await (sb.from('doctors') as any).upsert(payload, { onConflict: 'id' })
        if (error) throw error
        const fullName = [doctor.first_name, doctor.last_name].filter(Boolean).join(' ').trim()
        if (fullName) await sb.from('users').update({ name: fullName }).eq('id', user.id)
      } else if (role === 'organization') {
        const payload = {
          id: user.id,
          org_name: org.org_name || null,
          org_slug: org.org_slug || null,
          sport_type: org.sport_type || null,
          description: org.description || null,
          website_url: org.website_url || null,
          email:   org.email   || null,
          phone:   org.phone   || null,
          address: org.address || null,
          city:    org.city    || null,
          country: org.country || null,
          founded_year:  org.founded_year  ? Number(org.founded_year)  : null,
          members_count: org.members_count ? Number(org.members_count) : null,
          contact_person: org.contact_person || null,
          languages: listFromText(org.languages_text),
          instagram_url: org.instagram_url || null,
          telegram_url:  org.telegram_url  || null,
          youtube_url:   org.youtube_url   || null,
          profile_public: org.profile_public,
          updated_at: new Date().toISOString(),
        }
        const { error } = await (sb.from('organizations') as any).upsert(payload, { onConflict: 'id' })
        if (error) throw error
        if (org.org_name) await sb.from('users').update({ name: org.org_name }).eq('id', user.id)
      } else if (role === 'admin') {
        const payload = {
          id: user.id,
          first_name: admin.first_name || null,
          last_name:  admin.last_name  || null,
          phone:      admin.phone      || null,
          city:       admin.city       || null,
          country:    admin.country    || null,
          bio:        admin.bio        || null,
          department: admin.department || null,
          access_level: admin.access_level || null,
          notes:      admin.notes      || null,
          updated_at: new Date().toISOString(),
        }
        const { error } = await (sb.from('admins') as any).upsert(payload, { onConflict: 'id' })
        if (error) throw error
        const fullName = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim()
        if (fullName) await sb.from('users').update({ name: fullName }).eq('id', user.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Ошибка при сохранении')
      setTimeout(() => setSaveError(null), 5000)
    } finally {
      setSaving(false)
    }
  }, [user?.id, role, coach, doctor, org, admin])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
      </div>
    )
  }

  return (
    <ProfileShell
      title={title}
      subtitle={subtitle}
      roleBadge={roleBadge}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      avatarUrl={avatarUrl}
      uploadingAvatar={uploadingAvatar}
      onAvatarUpload={handleAvatarUpload}
      onAvatarDelete={handleAvatarDelete}
      saving={saving}
      saved={saved}
      saveError={saveError}
      onSave={handleSave}
    >
      {role === 'coach' && <CoachTabs tab={tab} form={coach} set={setCoach} />}
      {role === 'doctor' && <DoctorTabs tab={tab} form={doctor} set={setDoctor} />}
      {role === 'organization' && <OrgTabs tab={tab} form={org} set={setOrg} />}
      {role === 'admin' && <AdminTabs tab={tab} form={admin} set={setAdmin} />}
    </ProfileShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab panels
// ────────────────────────────────────────────────────────────────────────────

function CoachTabs({ tab, form, set }: { tab: string; form: CoachForm; set: React.Dispatch<React.SetStateAction<CoachForm>> }) {
  const u = (k: keyof CoachForm) => (v: string | boolean) => set(s => ({ ...s, [k]: v }))

  if (tab === 'personal') {
    return (
      <FormSection title="Личные данные" icon="ki-profile-circle" iconBg="#FFF7ED" iconColor="#F97316">
        <Field label="Имя"><TextInput value={form.first_name} onChange={u('first_name') as (v: string) => void} /></Field>
        <Field label="Фамилия"><TextInput value={form.last_name} onChange={u('last_name') as (v: string) => void} /></Field>
        <Field label="Дата рождения"><TextInput type="date" value={form.birth_date} onChange={u('birth_date') as (v: string) => void} /></Field>
        <Field label="Пол"><Select value={form.gender} onChange={u('gender') as (v: string) => void} options={GENDERS} /></Field>
        <Field label="Телефон"><TextInput value={form.phone} onChange={u('phone') as (v: string) => void} placeholder="+7 900 000 00 00" /></Field>
        <Field label="Город"><TextInput value={form.city} onChange={u('city') as (v: string) => void} /></Field>
        <Field label="Страна"><Select value={form.country} onChange={u('country') as (v: string) => void} options={COUNTRIES} /></Field>
        <Field label="Коротко о себе" full><TextArea value={form.bio} onChange={u('bio') as (v: string) => void} placeholder="Кто вы, какой подход к тренировкам…" /></Field>
      </FormSection>
    )
  }

  if (tab === 'professional') {
    return (
      <FormSection title="Профессия" icon="ki-abstract-26" iconBg="#EFF6FF" iconColor="#2563EB">
        <Field label="Специализация"><Select value={form.specialization} onChange={u('specialization') as (v: string) => void} options={COACH_SPECIALIZATIONS} /></Field>
        <Field label="Виды спорта" hint="Через запятую"><TextInput value={form.sports_text} onChange={u('sports_text') as (v: string) => void} placeholder="Бег, триатлон" /></Field>
        <Field label="Место работы / клуб"><TextInput value={form.workplace} onChange={u('workplace') as (v: string) => void} placeholder="SkyRun Academy" /></Field>
        <Field label="Языки" hint="Через запятую"><TextInput value={form.languages_text} onChange={u('languages_text') as (v: string) => void} placeholder="Русский, Английский" /></Field>
        <Field label="Образование" full><TextArea value={form.education} onChange={u('education') as (v: string) => void} placeholder="РГУФКСМиТ, тренер-преподаватель…" /></Field>
        <Field label="Сертификаты" full hint="Каждый сертификат с новой строки">
          <TextArea value={form.certifications_text} onChange={u('certifications_text') as (v: string) => void} rows={4} placeholder="IRONMAN Certified Coach\nUSA Track & Field Level 2" />
        </Field>
      </FormSection>
    )
  }

  if (tab === 'experience') {
    return (
      <FormSection title="Опыт и ставка" icon="ki-medal-star" iconBg="#ECFDF5" iconColor="#0D9488">
        <Field label="Стаж (лет)"><TextInput type="number" value={form.experience_years} onChange={u('experience_years') as (v: string) => void} placeholder="5" /></Field>
        <Field label="Под вашим руководством атлетов"><TextInput type="number" value={form.athletes_count} onChange={u('athletes_count') as (v: string) => void} placeholder="12" /></Field>
        <Field label="Ставка за час"><TextInput type="number" value={form.hourly_rate} onChange={u('hourly_rate') as (v: string) => void} placeholder="3000" /></Field>
        <Field label="Валюта">
          <Select value={form.currency} onChange={u('currency') as (v: string) => void} options={[
            { value: 'RUB', label: '₽ Рубли' },
            { value: 'USD', label: '$ Доллары' },
            { value: 'EUR', label: '€ Евро' },
            { value: 'KZT', label: '₸ Тенге' },
          ]} />
        </Field>
      </FormSection>
    )
  }

  if (tab === 'contacts') {
    return (
      <FormSection title="Контакты и соцсети" icon="ki-people" iconBg="#F5F3FF" iconColor="#7C3AED">
        <Field label="Telegram"><TextInput value={form.telegram_url} onChange={u('telegram_url') as (v: string) => void} placeholder="https://t.me/coach" /></Field>
        <Field label="Instagram"><TextInput value={form.instagram_url} onChange={u('instagram_url') as (v: string) => void} placeholder="https://instagram.com/…" /></Field>
        <Field label="YouTube"><TextInput value={form.youtube_url} onChange={u('youtube_url') as (v: string) => void} placeholder="https://youtube.com/@…" /></Field>
        <Field label="Сайт"><TextInput value={form.website_url} onChange={u('website_url') as (v: string) => void} placeholder="https://…" /></Field>
      </FormSection>
    )
  }

  return (
    <FormSection title="Приватность" icon="ki-shield-tick" iconBg="#ECFDF5" iconColor="#16A34A">
      <div className="md:col-span-2 flex flex-col gap-3">
        <Toggle
          label="Публичный профиль"
          hint="Атлеты смогут найти вас и посмотреть детали"
          value={form.profile_public}
          onChange={u('profile_public') as (v: boolean) => void}
        />
        <Toggle
          label="Принимаю новых атлетов"
          hint="Показывать бейдж «доступен для новых клиентов»"
          value={form.accepts_new_athletes}
          onChange={u('accepts_new_athletes') as (v: boolean) => void}
        />
      </div>
    </FormSection>
  )
}

function DoctorTabs({ tab, form, set }: { tab: string; form: DoctorForm; set: React.Dispatch<React.SetStateAction<DoctorForm>> }) {
  const u = (k: keyof DoctorForm) => (v: string | boolean) => set(s => ({ ...s, [k]: v }))

  if (tab === 'personal') {
    return (
      <FormSection title="Личные данные" icon="ki-profile-circle" iconBg="#FFF7ED" iconColor="#F97316">
        <Field label="Имя"><TextInput value={form.first_name} onChange={u('first_name') as (v: string) => void} /></Field>
        <Field label="Фамилия"><TextInput value={form.last_name} onChange={u('last_name') as (v: string) => void} /></Field>
        <Field label="Дата рождения"><TextInput type="date" value={form.birth_date} onChange={u('birth_date') as (v: string) => void} /></Field>
        <Field label="Пол"><Select value={form.gender} onChange={u('gender') as (v: string) => void} options={GENDERS} /></Field>
        <Field label="Телефон"><TextInput value={form.phone} onChange={u('phone') as (v: string) => void} /></Field>
        <Field label="Город"><TextInput value={form.city} onChange={u('city') as (v: string) => void} /></Field>
        <Field label="Страна"><Select value={form.country} onChange={u('country') as (v: string) => void} options={COUNTRIES} /></Field>
        <Field label="Коротко о себе" full><TextArea value={form.bio} onChange={u('bio') as (v: string) => void} /></Field>
      </FormSection>
    )
  }

  if (tab === 'medical') {
    return (
      <FormSection title="Медицинская специализация" icon="ki-heart" iconBg="#FEF2F2" iconColor="#E11D48">
        <Field label="Специализация"><Select value={form.medical_specialization} onChange={u('medical_specialization') as (v: string) => void} options={MEDICAL_SPECIALIZATIONS} /></Field>
        <Field label="Стаж (лет)"><TextInput type="number" value={form.experience_years} onChange={u('experience_years') as (v: string) => void} /></Field>
        <Field label="Номер лицензии"><TextInput value={form.license_number} onChange={u('license_number') as (v: string) => void} /></Field>
        <Field label="Выдана (орган)"><TextInput value={form.license_authority} onChange={u('license_authority') as (v: string) => void} placeholder="Росздравнадзор, Минздрав…" /></Field>
        <Field label="Языки приёма" hint="Через запятую" full><TextInput value={form.languages_text} onChange={u('languages_text') as (v: string) => void} placeholder="Русский, Английский" /></Field>
      </FormSection>
    )
  }

  if (tab === 'education') {
    return (
      <FormSection title="Образование и сертификаты" icon="ki-book" iconBg="#EFF6FF" iconColor="#2563EB">
        <Field label="Учёная степень"><TextInput value={form.degree} onChange={u('degree') as (v: string) => void} placeholder="Кандидат медицинских наук" /></Field>
        <Field label="Образование" full><TextArea value={form.education} onChange={u('education') as (v: string) => void} placeholder="Первый МГМУ им. Сеченова, лечебное дело…" /></Field>
        <Field label="Сертификаты" full hint="Каждый с новой строки">
          <TextArea value={form.certifications_text} onChange={u('certifications_text') as (v: string) => void} rows={4} placeholder="Сертификат по спортивной медицине, 2022" />
        </Field>
      </FormSection>
    )
  }

  if (tab === 'practice') {
    return (
      <FormSection title="Практика" icon="ki-briefcase" iconBg="#ECFDF5" iconColor="#0D9488">
        <Field label="Место работы / клиника"><TextInput value={form.workplace} onChange={u('workplace') as (v: string) => void} /></Field>
        <Field label="Стоимость консультации"><TextInput type="number" value={form.consultation_fee} onChange={u('consultation_fee') as (v: string) => void} placeholder="5000" /></Field>
        <Field label="Валюта">
          <Select value={form.currency} onChange={u('currency') as (v: string) => void} options={[
            { value: 'RUB', label: '₽ Рубли' },
            { value: 'USD', label: '$ Доллары' },
            { value: 'EUR', label: '€ Евро' },
            { value: 'KZT', label: '₸ Тенге' },
          ]} />
        </Field>
        <Field label="Telegram"><TextInput value={form.telegram_url} onChange={u('telegram_url') as (v: string) => void} /></Field>
        <Field label="Сайт"><TextInput value={form.website_url} onChange={u('website_url') as (v: string) => void} /></Field>
      </FormSection>
    )
  }

  return (
    <FormSection title="Приватность" icon="ki-shield-tick" iconBg="#ECFDF5" iconColor="#16A34A">
      <div className="md:col-span-2 flex flex-col gap-3">
        <Toggle
          label="Публичный профиль"
          hint="Атлеты и тренеры смогут найти вас"
          value={form.profile_public}
          onChange={u('profile_public') as (v: boolean) => void}
        />
        <Toggle
          label="Принимаю новых пациентов"
          hint="Показывать бейдж «доступен для новых пациентов»"
          value={form.accepts_new_patients}
          onChange={u('accepts_new_patients') as (v: boolean) => void}
        />
      </div>
    </FormSection>
  )
}

function OrgTabs({ tab, form, set }: { tab: string; form: OrgForm; set: React.Dispatch<React.SetStateAction<OrgForm>> }) {
  const u = (k: keyof OrgForm) => (v: string | boolean) => set(s => ({ ...s, [k]: v }))

  if (tab === 'main') {
    return (
      <FormSection title="Основная информация" icon="ki-home-2" iconBg="#FFF7ED" iconColor="#F97316">
        <Field label="Название организации"><TextInput value={form.org_name} onChange={u('org_name') as (v: string) => void} /></Field>
        <Field label="Короткий URL (slug)" hint="например: skyrun"><TextInput value={form.org_slug} onChange={u('org_slug') as (v: string) => void} /></Field>
        <Field label="Вид спорта"><Select value={form.sport_type} onChange={u('sport_type') as (v: string) => void} options={SPORT_TYPES} /></Field>
        <Field label="Год основания"><TextInput type="number" value={form.founded_year} onChange={u('founded_year') as (v: string) => void} placeholder="2018" /></Field>
        <Field label="Количество участников"><TextInput type="number" value={form.members_count} onChange={u('members_count') as (v: string) => void} /></Field>
        <Field label="Контактное лицо"><TextInput value={form.contact_person} onChange={u('contact_person') as (v: string) => void} /></Field>
        <Field label="Описание" full><TextArea value={form.description} onChange={u('description') as (v: string) => void} placeholder="О клубе, федерации, команде…" rows={4} /></Field>
      </FormSection>
    )
  }

  if (tab === 'contacts') {
    return (
      <FormSection title="Контакты" icon="ki-sms" iconBg="#EFF6FF" iconColor="#2563EB">
        <Field label="Email"><TextInput type="email" value={form.email} onChange={u('email') as (v: string) => void} /></Field>
        <Field label="Телефон"><TextInput value={form.phone} onChange={u('phone') as (v: string) => void} /></Field>
        <Field label="Сайт"><TextInput value={form.website_url} onChange={u('website_url') as (v: string) => void} /></Field>
        <Field label="Языки" hint="Через запятую"><TextInput value={form.languages_text} onChange={u('languages_text') as (v: string) => void} /></Field>
        <Field label="Адрес" full><TextInput value={form.address} onChange={u('address') as (v: string) => void} placeholder="ул. Спортивная, 1" /></Field>
        <Field label="Город"><TextInput value={form.city} onChange={u('city') as (v: string) => void} /></Field>
        <Field label="Страна"><Select value={form.country} onChange={u('country') as (v: string) => void} options={COUNTRIES} /></Field>
      </FormSection>
    )
  }

  if (tab === 'social') {
    return (
      <FormSection title="Социальные сети" icon="ki-share" iconBg="#F5F3FF" iconColor="#7C3AED">
        <Field label="Instagram"><TextInput value={form.instagram_url} onChange={u('instagram_url') as (v: string) => void} /></Field>
        <Field label="Telegram"><TextInput value={form.telegram_url} onChange={u('telegram_url') as (v: string) => void} /></Field>
        <Field label="YouTube"><TextInput value={form.youtube_url} onChange={u('youtube_url') as (v: string) => void} /></Field>
      </FormSection>
    )
  }

  return (
    <FormSection title="Приватность" icon="ki-shield-tick" iconBg="#ECFDF5" iconColor="#16A34A">
      <div className="md:col-span-2">
        <Toggle
          label="Публичный профиль организации"
          hint="Страница организации доступна всем пользователям"
          value={form.profile_public}
          onChange={u('profile_public') as (v: boolean) => void}
        />
      </div>
    </FormSection>
  )
}

function AdminTabs({ tab, form, set }: { tab: string; form: AdminForm; set: React.Dispatch<React.SetStateAction<AdminForm>> }) {
  const u = (k: keyof AdminForm) => (v: string | boolean) => set(s => ({ ...s, [k]: v }))

  if (tab === 'personal') {
    return (
      <FormSection title="Личные данные" icon="ki-profile-circle" iconBg="#FFF7ED" iconColor="#F97316">
        <Field label="Имя"><TextInput value={form.first_name} onChange={u('first_name') as (v: string) => void} /></Field>
        <Field label="Фамилия"><TextInput value={form.last_name} onChange={u('last_name') as (v: string) => void} /></Field>
        <Field label="Город"><TextInput value={form.city} onChange={u('city') as (v: string) => void} /></Field>
        <Field label="Страна"><Select value={form.country} onChange={u('country') as (v: string) => void} options={COUNTRIES} /></Field>
        <Field label="О себе" full><TextArea value={form.bio} onChange={u('bio') as (v: string) => void} /></Field>
      </FormSection>
    )
  }

  if (tab === 'role') {
    return (
      <FormSection title="Служебные данные" icon="ki-shield-tick" iconBg="#ECFDF5" iconColor="#16A34A">
        <Field label="Департамент"><TextInput value={form.department} onChange={u('department') as (v: string) => void} placeholder="Поддержка / Модерация" /></Field>
        <Field label="Уровень доступа"><Select value={form.access_level} onChange={u('access_level') as (v: string) => void} options={ACCESS_LEVELS} /></Field>
        <Field label="Внутренние заметки" full><TextArea value={form.notes} onChange={u('notes') as (v: string) => void} rows={4} /></Field>
      </FormSection>
    )
  }

  return (
    <FormSection title="Контакты" icon="ki-sms" iconBg="#EFF6FF" iconColor="#2563EB">
      <Field label="Телефон"><TextInput value={form.phone} onChange={u('phone') as (v: string) => void} /></Field>
    </FormSection>
  )
}
