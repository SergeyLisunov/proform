import { join } from 'node:path'

/**
 * Синтетические QA-аккаунты и пути к сохранённым сессиям.
 * Не тестовый файл — Playwright запрещает импорт одного spec'а из другого.
 * Данные создаёт qa/ralph/seed.sql (пароль в репозиторий не попадает).
 */
export const ROLE_ACCOUNTS = {
  'owner-alpha':   'qa.owner.alpha@sporteo-qa.dev',
  'coach-alpha1':  'qa.coach.alpha1@sporteo-qa.dev',
  'coach-alpha2':  'qa.coach.alpha2@sporteo-qa.dev',
  'doctor-alpha':  'qa.doctor.alpha@sporteo-qa.dev',
  'athlete-alpha1':'qa.athlete.alpha1@sporteo-qa.dev',
  'athlete-alpha2':'qa.athlete.alpha2@sporteo-qa.dev',
  'owner-beta':    'qa.owner.beta@sporteo-qa.dev',
  'coach-beta':    'qa.coach.beta@sporteo-qa.dev',
  'athlete-beta':  'qa.athlete.beta@sporteo-qa.dev',
  'platform-owner':'qa.platform.owner@sporteo-qa.dev',
} as const

export type RoleKey = keyof typeof ROLE_ACCOUNTS

export const AUTH_DIR = join(process.cwd(), 'tests', 'e2e', '.auth')
export const statePath = (role: RoleKey): string => join(AUTH_DIR, `${role}.json`)
