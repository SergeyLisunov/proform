/**
 * Форма профиля специалиста — одна на мастер онбординга и настройки.
 *
 * ЗАЧЕМ. Мастер (app/onboarding/specialist) и настройки
 * (components/settings/RoleProfile) правят одну строку таблицы specialists.
 * Когда у каждого были свои проверки и своё преобразование, они разошлись:
 * разные пределы, разный порядок специализаций, разные подписи полей. А
 * мастер, не знающий части полей, при сохранении затёр бы то, что человек
 * ввёл в настройках. Здесь модель — надмножество всех полей: экран
 * показывает только свои, но сохраняется строка целиком.
 *
 * Пределы совпадают с CHECK в миграции 118: лучше понятная фраза в форме,
 * чем отказ базы с текстом про constraint.
 */
import {
  SPECIALIST_FORMATS, SPECIALIST_TYPES, isSpecialistType,
  type SpecialistFormat, type SpecialistType,
} from '@/lib/specialist'
import type {
  SpecialistCertification, SpecialistProfile, SpecialistProfileInput,
} from '@/services/specialist.service'

export const MAX_CERTS = 10
export const MAX_EXPERIENCE_YEARS = 70
export const MIN_CERT_YEAR = 1950
export const MAX_BIO_LENGTH = 1000

/** Подписи полей — одни и те же в мастере, настройках и списке «чего не хватает». */
export const SPECIALIST_FIELD_LABEL = {
  types:      'Специализация',
  mainFocus:  'Основной фокус',
  bio:        'О себе',
  experience: 'Опыт (лет)',
  education:  'Образование',
  certs:      'Сертификаты',
  license:    'Номер лицензии',
  formats:    'Формат работы',
  city:       'Город',
  country:    'Страна',
  languages:  'Языки',
  fee:        'Стоимость консультации',
  telegram:   'Telegram',
  website:    'Сайт',
} as const

/** Строка сертификата в форме: пока человек печатает, все поля — строки.
 *  key — только ключ React, в базу не идёт. */
export interface CertRow { key: string; name: string; issuer: string; year: string }

export interface SpecialistForm {
  types: SpecialistType[]
  mainFocus: string
  bio: string
  experience: string
  education: string
  certs: CertRow[]
  license: string
  formats: SpecialistFormat[]
  city: string
  country: string
  /** Через запятую: «русский, английский». */
  languages: string
  fee: string
  currency: string
  telegram: string
  website: string
  acceptsNewClients: boolean
  /** По умолчанию выключено: сделать данные общедоступными можно только
   *  с явного согласия (152-ФЗ, ст. 10.1), а не галочкой, стоящей заранее. */
  profilePublic: boolean
}

export function emptySpecialistForm(): SpecialistForm {
  return {
    types: [], mainFocus: '', bio: '', experience: '', education: '', certs: [], license: '',
    formats: [], city: '', country: '', languages: '', fee: '', currency: 'RUB',
    telegram: '', website: '', acceptsNewClients: true, profilePublic: false,
  }
}

/** Разделы формы: мастер проверяет свой шаг, настройки — всё и открывают
 *  вкладку с ошибкой. */
export type SpecialistFormSection = 'specialty' | 'experience' | 'work' | 'contacts'

export interface SpecialistFormError {
  section: SpecialistFormSection
  message: string
}

// Порядок как в словаре — подписи «Физиотерапевт, массажист» не зависят от порядка кликов.
export function toggleSpecialistType(list: readonly SpecialistType[], value: SpecialistType): SpecialistType[] {
  return SPECIALIST_TYPES.filter(t => (t === value ? !list.includes(t) : list.includes(t)))
}

export function toggleSpecialistFormat(list: readonly SpecialistFormat[], value: SpecialistFormat): SpecialistFormat[] {
  return SPECIALIST_FORMATS.filter(f => (f === value ? !list.includes(f) : list.includes(f)))
}

export const digitsOnly = (raw: string, max: number): string => raw.replace(/\D/g, '').slice(0, max)
export const isBlankCertRow = (r: CertRow): boolean => !r.name.trim() && !r.issuer.trim() && !r.year.trim()
/** Город нужен, если есть хоть один формат, кроме онлайна. */
export const cityRequired = (formats: readonly SpecialistFormat[]): boolean => formats.some(f => f !== 'online')

/** Пустая строка → null; иначе число (NaN, если введено не число). */
function optionalNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}

function sectionErrors(form: SpecialistForm, section: SpecialistFormSection): string | null {
  switch (section) {
    case 'specialty':
      return form.types.length === 0 ? 'Выберите хотя бы одну специализацию' : null

    case 'experience': {
      const years = optionalNumber(form.experience)
      if (years !== null && !(Number.isInteger(years) && years >= 0 && years <= MAX_EXPERIENCE_YEARS)) {
        return `Опыт — целое число лет от 0 до ${MAX_EXPERIENCE_YEARS}`
      }
      const thisYear = new Date().getFullYear()
      for (const r of form.certs.filter(row => !isBlankCertRow(row))) {
        if (!r.name.trim()) return 'У сертификата нужно название — или удалите строку'
        const year = optionalNumber(r.year)
        if (year !== null && !(Number.isInteger(year) && year >= MIN_CERT_YEAR && year <= thisYear)) {
          return `Год сертификата «${r.name.trim()}» — от ${MIN_CERT_YEAR} до ${thisYear}`
        }
      }
      if (form.certs.filter(row => !isBlankCertRow(row)).length > MAX_CERTS) {
        return `Сертификатов — не больше ${MAX_CERTS}`
      }
      return null
    }

    case 'work':
      if (form.formats.length === 0) return 'Выберите хотя бы один формат работы'
      if (cityRequired(form.formats) && !form.city.trim()) {
        return 'Укажите город — он нужен для очных встреч и выездов'
      }
      return null

    case 'contacts': {
      const fee = optionalNumber(form.fee)
      if (fee !== null && !(Number.isFinite(fee) && fee >= 0)) {
        return 'Стоимость консультации — число не меньше нуля'
      }
      return null
    }
  }
}

const SECTION_ORDER: readonly SpecialistFormSection[] = ['specialty', 'experience', 'work', 'contacts']

/** Первая ошибка в указанных разделах (по умолчанию — во всех). */
export function specialistFormError(
  form: SpecialistForm,
  sections: readonly SpecialistFormSection[] = SECTION_ORDER,
): SpecialistFormError | null {
  for (const section of SECTION_ORDER) {
    if (!sections.includes(section)) continue
    const message = sectionErrors(form, section)
    if (message) return { section, message }
  }
  return null
}

export function toCertifications(rows: readonly CertRow[]): SpecialistCertification[] {
  return rows.filter(r => !isBlankCertRow(r)).map(r => {
    const year = optionalNumber(r.year)
    return {
      name: r.name.trim(),
      ...(r.issuer.trim() ? { issuer: r.issuer.trim() } : {}),
      ...(year !== null && Number.isInteger(year) ? { year } : {}),
    }
  })
}

const listFromText = (v: string): string[] => v.split(',').map(s => s.trim()).filter(Boolean)

/** Форма → строка specialists. Вызывать после specialistFormError === null. */
export function toSpecialistInput(form: SpecialistForm): SpecialistProfileInput {
  return {
    specialist_types:    SPECIALIST_TYPES.filter(t => form.types.includes(t)),
    main_focus:          form.mainFocus.trim() || null,
    bio:                 form.bio.trim() || null,
    experience_years:    optionalNumber(form.experience),
    education:           form.education.trim() || null,
    certifications:      toCertifications(form.certs),
    license_number:      form.license.trim() || null,
    formats:             SPECIALIST_FORMATS.filter(f => form.formats.includes(f)),
    city:                form.city.trim() || null,
    country:             form.country.trim() || null,
    languages:           listFromText(form.languages),
    consultation_fee:    optionalNumber(form.fee),
    currency:            form.currency || 'RUB',
    telegram_url:        form.telegram.trim() || null,
    website_url:         form.website.trim() || null,
    accepts_new_clients: form.acceptsNewClients,
    profile_public:      form.profilePublic,
  }
}

// certifications — jsonb без схемы: в старых строках бывают просто строки,
// поэтому разбираем без доверия к форме и берём только строки с названием.
function certRowsFrom(value: unknown, newKey: () => string): CertRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(c => {
    if (typeof c === 'string') return c.trim() ? [{ key: newKey(), name: c.trim(), issuer: '', year: '' }] : []
    const o = (c ?? {}) as Partial<Record<'name' | 'issuer' | 'year', unknown>>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) return []
    return [{
      key: newKey(),
      name,
      issuer: typeof o.issuer === 'string' ? o.issuer : '',
      year: typeof o.year === 'number' || typeof o.year === 'string' ? String(o.year) : '',
    }]
  }).slice(0, MAX_CERTS)
}

/** Строка specialists → форма. Нет строки — пустая форма. */
export function specialistFormFromProfile(p: SpecialistProfile | null, newKey: () => string): SpecialistForm {
  if (!p) return emptySpecialistForm()
  return {
    types:             SPECIALIST_TYPES.filter(t => (p.specialist_types ?? []).includes(t)),
    mainFocus:         p.main_focus ?? '',
    bio:               p.bio ?? '',
    experience:        p.experience_years == null ? '' : String(p.experience_years),
    education:         p.education ?? '',
    certs:             certRowsFrom(p.certifications, newKey),
    license:           p.license_number ?? '',
    formats:           SPECIALIST_FORMATS.filter(f => (p.formats ?? []).includes(f)),
    city:              p.city ?? '',
    country:           p.country ?? '',
    languages:         (p.languages ?? []).join(', '),
    fee:               p.consultation_fee == null ? '' : String(p.consultation_fee),
    currency:          p.currency || 'RUB',
    telegram:          p.telegram_url ?? '',
    website:           p.website_url ?? '',
    acceptsNewClients: p.accepts_new_clients ?? true,
    profilePublic:     p.profile_public ?? false,
  }
}

/** Отбросить незнакомые значения специализаций — например, из старого
 *  onboarding_state. */
export function knownSpecialistTypes(values: readonly unknown[] | null | undefined): SpecialistType[] {
  return SPECIALIST_TYPES.filter(t => (values ?? []).some(v => v === t && isSpecialistType(v)))
}
