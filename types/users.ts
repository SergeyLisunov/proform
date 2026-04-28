// Shared user-domain types. Server code can't import from
// lib/hooks/useUser.ts (it's `'use client'`), so the role union lives
// here and is re-used by both server and client.

export type UserRole = 'athlete' | 'coach' | 'organization' | 'admin' | 'doctor'

export const USER_ROLES: readonly UserRole[] = [
  'athlete',
  'coach',
  'organization',
  'admin',
  'doctor',
] as const

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}
