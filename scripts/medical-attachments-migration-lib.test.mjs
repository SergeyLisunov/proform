import { describe, expect, it } from 'vitest'
import { diaryOwned, healthOwned, publicPathFromUrl, rewriteAttachments } from './medical-attachments-migration-lib.mjs'

const AUTH = 'f0000000-0000-0000-0000-0000000000a1'
const USER = '00000000-0000-0000-0000-0000000000a1'
const BASE = 'https://x.supabase.co/storage/v1/object/public/note-attachments/'

describe('publicPathFromUrl', () => {
  it('достаёт путь из публичной ссылки', () => {
    expect(publicPathFromUrl(`${BASE}${AUTH}/med/1-a.pdf`)).toBe(`${AUTH}/med/1-a.pdf`)
  })
  it('декодирует и отбрасывает параметры', () => {
    expect(publicPathFromUrl(`${BASE}${AUTH}/med/a%20b.pdf?download=1`)).toBe(`${AUTH}/med/a b.pdf`)
  })
  it('чужой бакет и не-строка — null', () => {
    expect(publicPathFromUrl('https://x.supabase.co/storage/v1/object/public/avatars/a.png')).toBeNull()
    expect(publicPathFromUrl(undefined)).toBeNull()
  })
})

describe('проверка владельца: чужой файл не трогаем', () => {
  it('вложение дневника — только из папки автора', () => {
    expect(diaryOwned(`${AUTH}/med/1-a.pdf`, AUTH)).toBe(true)
    expect(diaryOwned(`${USER}/med/1-a.pdf`, AUTH)).toBe(false)
    expect(diaryOwned(`${AUTH}/diary/1-a.pdf`, AUTH)).toBe(false)
    expect(diaryOwned(`${AUTH}/med/sub/1-a.pdf`, AUTH)).toBe(false)
    expect(diaryOwned(`x${AUTH}/med/1-a.pdf`, AUTH)).toBe(false)
    expect(diaryOwned(`${AUTH}/med/1-a.pdf`, null)).toBe(false)
  })
  it('выгрузка Apple Health — только из папки владельца, оба старых вида', () => {
    expect(healthOwned(`${USER}/health-private/apple_health/1-health.zip`, USER)).toBe(true)
    expect(healthOwned(`${USER}/apple_health/1-health.zip`, USER)).toBe(true)
    expect(healthOwned(`${AUTH}/diary/photo.jpg`, USER)).toBe(false)
    expect(healthOwned(`${USER}/notes/1.jpg`, USER)).toBe(false)
    expect(healthOwned(`${USER}/apple_health/../notes/1.jpg`, USER)).toBe(false)
  })
})

describe('rewriteAttachments', () => {
  it('заменяет ссылку путём только у перенесённых файлов', () => {
    const moved = new Map([[`${AUTH}/med/1-a.pdf`, `${USER}/med/1-a.pdf`]])
    const out = rewriteAttachments([
      { name: 'a', url: `${BASE}${AUTH}/med/1-a.pdf`, type: 'document', size: 1 },
      { name: 'b', url: `${BASE}${AUTH}/med/2-b.pdf`, type: 'document', size: 2 },
      { name: 'c', path: `${USER}/med/3-c.pdf`, type: 'image', size: 3 },
    ], moved)
    expect(out[0]).toEqual({ name: 'a', path: `${USER}/med/1-a.pdf`, type: 'document', size: 1 })
    expect(out[1].url).toBe(`${BASE}${AUTH}/med/2-b.pdf`)
    expect(out[2].path).toBe(`${USER}/med/3-c.pdf`)
  })
})
