/**
 * Role Policy — ролевые профили ассистентов Sporteo.
 *
 * Роль берётся ТОЛЬКО из серверной строки users (никогда из клиента).
 * users.role='specialist' (врач-физио/массаж/нутрициолог) получает
 * профиль доктора — та же модель доступа через connections doctor_athlete.
 * admin (back-office) и все прочие роли — ассистент ВЫКЛЮЧЕН по умолчанию:
 * новая роль подключается только отдельной политикой+промптом+тестами.
 */
import type { AssistantRole, RoleProfile } from './types'

const PROFILES: Record<AssistantRole, RoleProfile> = {
  athlete: {
    role: 'athlete',
    displayName: 'Мой AI-помощник',
    tagline: 'Объясню план, подскажу что важно сегодня, помогу подготовить вопросы тренеру',
    starterPrompts: [
      'Что мне важно сделать сегодня?',
      'Объясни мой план',
      'Подготовить вопрос тренеру',
      'Показать мой прогресс',
    ],
    allowedContextTypes: [],
  },
  coach: {
    role: 'coach',
    displayName: 'AI-помощник тренера',
    tagline: 'Планы, нагрузка, сводки по вашим спортсменам и обратная связь',
    starterPrompts: [
      'Что важно сегодня по моим спортсменам?',
      'Подготовить план следующей тренировки',
      'Сформировать обратную связь спортсмену',
      'Резюмировать прогресс за неделю',
    ],
    allowedContextTypes: ['athlete'],
  },
  doctor: {
    role: 'doctor',
    displayName: 'AI-помощник спортивного врача',
    tagline: 'Черновики рекомендаций, структура наблюдений и резюме по назначенным спортсменам',
    starterPrompts: [
      'Подготовить черновик рекомендации',
      'Резюмировать динамику спортсмена',
      'Сформулировать ограничения для тренера',
      'Подготовить вопросы для консультации',
    ],
    allowedContextTypes: ['patient'],
  },
  organization: {
    role: 'organization',
    displayName: 'AI-помощник организации',
    tagline: 'Управленческие сводки, процессы и точки внимания по клубу',
    starterPrompts: [
      'Сформировать сводку организации',
      'Какие процессы требуют внимания?',
      'Показать незакрытые действия',
      'Подготовить отчёт для руководителя',
    ],
    allowedContextTypes: ['organization'],
  },
}

/**
 * users.role → профиль ассистента. null = ассистент для роли выключен.
 */
export function resolveAssistantProfile(userRole: string | null | undefined): RoleProfile | null {
  switch (userRole) {
    case 'athlete':      return PROFILES.athlete
    case 'coach':        return PROFILES.coach
    case 'doctor':
    case 'specialist':   return PROFILES.doctor
    case 'organization': return PROFILES.organization
    default:             return null
  }
}

export function getRoleProfile(role: AssistantRole): RoleProfile {
  return PROFILES[role]
}
