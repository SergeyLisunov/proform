/**
 * Какая роль проходит какой мастер онбординга — единственное место.
 *
 * ЗАЧЕМ. Раньше middleware отправлял на /onboarding любого не-админа без
 * отметки «онбординг пройден», а диспетчер /onboarding знал мастера только
 * для четырёх ролей и всех остальных отправлял на /dashboard. Роль без
 * мастера (специалист) попадала в бесконечный круг /dashboard → /onboarding
 * → /dashboard и не могла войти в кабинет вообще. Теперь и middleware, и
 * диспетчер спрашивают здесь: у роли нет мастера — нет и обязательного
 * онбординга.
 *
 * Без React и Supabase: модуль нужен middleware.
 */
export const WIZARD_PATH = {
  athlete:      '/onboarding/athlete',
  coach:        '/onboarding/coach',
  organization: '/onboarding/organization',
  doctor:       '/onboarding/doctor',
  specialist:   '/onboarding/specialist',
} as const

export type WizardRoleKey = keyof typeof WIZARD_PATH

export function hasWizard(role: string | null | undefined): role is WizardRoleKey {
  return !!role && Object.prototype.hasOwnProperty.call(WIZARD_PATH, role)
}

/** Путь мастера для роли или null, если мастера у роли нет. */
export function wizardPathForRole(role: string | null | undefined): string | null {
  return hasWizard(role) ? WIZARD_PATH[role] : null
}

/** Нужно ли отправить пользователя на онбординг: мастер есть, а отметки нет. */
export function needsOnboarding(
  role: string | null | undefined,
  onboardingState: { completed?: boolean } | null | undefined,
): boolean {
  return hasWizard(role) && onboardingState?.completed !== true
}
