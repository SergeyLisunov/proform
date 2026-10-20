import { describe, expect, it } from 'vitest'
import type { SpecialistProfile } from '@/services/specialist.service'
import {
  emptySpecialistForm, specialistFormError, specialistFormFromProfile, toSpecialistInput,
  toggleSpecialistFormat, toggleSpecialistType, type SpecialistForm,
} from './specialist-form'

let seq = 0
const key = () => `k${++seq}`
const form = (patch: Partial<SpecialistForm>): SpecialistForm => ({ ...emptySpecialistForm(), ...patch })

describe('форма специалиста', () => {
  it('публичный профиль по умолчанию выключен — только явное согласие', () => {
    expect(emptySpecialistForm().profilePublic).toBe(false)
    expect(specialistFormFromProfile(null, key).profilePublic).toBe(false)
  })

  it('порядок специализаций и форматов — как в словаре, а не как кликали', () => {
    let types = toggleSpecialistType([], 'nutrition')
    types = toggleSpecialistType(types, 'physio')
    expect(types).toEqual(['physio', 'nutrition'])
    expect(toggleSpecialistType(types, 'physio')).toEqual(['nutrition'])
    expect(toggleSpecialistFormat(['visit'], 'offline')).toEqual(['offline', 'visit'])
  })

  it('ошибки по разделам: настройки знают, какую вкладку открыть', () => {
    expect(specialistFormError(form({}))).toEqual({ section: 'specialty', message: expect.any(String) })
    const base = { types: ['physio' as const], formats: ['online' as const] }
    expect(specialistFormError(form({ ...base, experience: '71' }))?.section).toBe('experience')
    expect(specialistFormError(form({ ...base, experience: '2.5' }))?.section).toBe('experience')
    expect(specialistFormError(form({ ...base, fee: '-1' }))?.section).toBe('contacts')
    expect(specialistFormError(form(base))).toBeNull()
  })

  it('мастер проверяет только свой шаг', () => {
    expect(specialistFormError(form({ types: ['massage'] }), ['specialty'])).toBeNull()
  })

  it('город нужен для очных встреч и выездов, для онлайна — нет', () => {
    const base = { types: ['physio' as const] }
    expect(specialistFormError(form({ ...base, formats: ['online'] }))).toBeNull()
    expect(specialistFormError(form({ ...base, formats: ['online', 'visit'] }))?.section).toBe('work')
    expect(specialistFormError(form({ ...base, formats: ['visit'], city: 'Казань' }))).toBeNull()
  })

  it('сертификаты: пустые строки отбрасываются, без названия и с плохим годом — ошибка', () => {
    const base = { types: ['physio' as const], formats: ['online' as const] }
    const blank = { key: 'a', name: ' ', issuer: '', year: '' }
    expect(specialistFormError(form({ ...base, certs: [blank] }))).toBeNull()
    expect(specialistFormError(form({ ...base, certs: [{ key: 'b', name: '', issuer: 'X', year: '' }] }))?.section)
      .toBe('experience')
    expect(specialistFormError(form({ ...base, certs: [{ key: 'c', name: 'ЛФК', issuer: '', year: '1900' }] }))?.message)
      .toContain('ЛФК')
    expect(toSpecialistInput(form({ ...base, certs: [blank, { key: 'd', name: ' ЛФК ', issuer: '', year: '2020' }] }))
      .certifications).toEqual([{ name: 'ЛФК', year: 2020 }])
  })

  it('профиль → форма → профиль сохраняет все поля, включая те, которых нет в мастере', () => {
    const profile: SpecialistProfile = {
      id: 'u', specialist_types: ['massage', 'physio'], main_focus: 'Спина', bio: 'О себе',
      experience_years: 5, education: 'РГУФК', certifications: [{ name: 'ЛФК', issuer: 'ФМБА', year: 2019 }],
      license_number: 'Л-1', formats: ['visit', 'offline'], city: 'Москва', country: 'Россия',
      languages: ['русский', 'английский'], consultation_fee: 2500, currency: 'RUB',
      telegram_url: 't.me/x', website_url: 'x.ru', accepts_new_clients: false, profile_public: true,
      created_at: '', updated_at: '',
    }
    const input = toSpecialistInput(specialistFormFromProfile(profile, key))
    expect(input).toEqual({
      specialist_types: ['physio', 'massage'], main_focus: 'Спина', bio: 'О себе', experience_years: 5,
      education: 'РГУФК', certifications: [{ name: 'ЛФК', issuer: 'ФМБА', year: 2019 }], license_number: 'Л-1',
      formats: ['offline', 'visit'], city: 'Москва', country: 'Россия', languages: ['русский', 'английский'],
      consultation_fee: 2500, currency: 'RUB', telegram_url: 't.me/x', website_url: 'x.ru',
      accepts_new_clients: false, profile_public: true,
    })
  })

  it('старые сертификаты-строки читаются', () => {
    const p = { certifications: ['Массаж', '', { name: '' }] } as unknown as SpecialistProfile
    expect(specialistFormFromProfile({ ...emptyProfile(), ...p }, key).certs.map(c => c.name)).toEqual(['Массаж'])
  })
})

function emptyProfile(): SpecialistProfile {
  return {
    id: 'u', specialist_types: [], main_focus: null, bio: null, experience_years: null, education: null,
    certifications: [], license_number: null, formats: [], city: null, country: null, languages: [],
    consultation_fee: null, currency: 'RUB', telegram_url: null, website_url: null,
    accepts_new_clients: true, profile_public: false, created_at: '', updated_at: '',
  }
}
