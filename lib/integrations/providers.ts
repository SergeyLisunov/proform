/**
 * Каталог поддерживаемых носимых устройств.
 * Центральное место для UI-метаданных + env-конфигурации.
 */

export type DeviceProvider = 'garmin' | 'whoop' | 'apple_health'

export interface ProviderMeta {
  id: DeviceProvider
  name: string
  tagline: string
  icon: string                // emoji fallback + brand color
  brandColor: string
  bg: string
  border: string
  /** How the user connects: oauth redirect vs. file upload. */
  connectMode: 'oauth' | 'file_upload'
  /** What metrics the integration provides. */
  syncs: string[]
  /** Env vars required on the server. When undefined we show "скоро". */
  requiredEnv?: string[]
  /**
   * When true, the provider card shows a "Скоро" badge instead of the
   * Connect button. Used to honestly signal that integration is not
   * production-ready (e.g. waiting for Health API Partner Program
   * approval) without removing the card from the catalog. Sprint W1 Day 5.
   */
  comingSoon?: boolean
  /** Кратко — в 2 строки — что получают. */
  description: string
}

export const PROVIDERS: Record<DeviceProvider, ProviderMeta> = {
  garmin: {
    id: 'garmin',
    name: 'Garmin Connect',
    tagline: 'Спорт-часы и велокомпьютеры',
    icon: '⌚',
    brandColor: '#000000',
    bg: '#F1F5F9',
    border: '#CBD5E1',
    connectMode: 'oauth',
    syncs: ['Тренировки', 'HRV', 'ЧСС', 'Сон', 'Steps'],
    requiredEnv: ['GARMIN_CONSUMER_KEY', 'GARMIN_CONSUMER_SECRET'],
    // Garmin Health API requires Partner Program approval (OAuth 1.0a
    // handshake + signed request flow). Until partnership is in place
    // the /api/integrations/garmin/start route returns a TODO stub —
    // honest "Скоро" badge avoids false promise to athletes.
    comingSoon: true,
    description:
      'Автоматический импорт тренировок, HRV, сна и суточного пульса с Garmin Forerunner / Fenix / Edge.',
  },
  whoop: {
    id: 'whoop',
    name: 'WHOOP',
    tagline: 'Восстановление 24/7',
    icon: '💪',
    brandColor: '#000000',
    bg: '#0F172A',
    border: '#334155',
    connectMode: 'oauth',
    syncs: ['Recovery', 'HRV', 'Strain', 'Сон', 'Циклы'],
    requiredEnv: ['WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET'],
    description:
      'Подключение OAuth 2.0 — Recovery, strain, HRV, сон и суточные метрики тянутся автоматически каждые 4 часа.',
  },
  apple_health: {
    id: 'apple_health',
    name: 'Apple Health',
    tagline: 'iPhone и Apple Watch',
    icon: '🍎',
    brandColor: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    connectMode: 'file_upload',
    syncs: ['Тренировки', 'ЧСС', 'Шаги', 'Сон', 'Вес'],
    description:
      'Экспортируйте health-data.zip из приложения «Здоровье» на iPhone — распарсим и подтянем метрики. Занимает 30 секунд.',
  },
}

export function providerMeta(p: DeviceProvider): ProviderMeta {
  return PROVIDERS[p]
}

export function allProviders(): ProviderMeta[] {
  return [PROVIDERS.garmin, PROVIDERS.whoop, PROVIDERS.apple_health]
}

/** Проверка на сервере: есть ли необходимые env-переменные. */
export function providerConfigured(p: DeviceProvider): boolean {
  const meta = PROVIDERS[p]
  if (!meta.requiredEnv) return true
  return meta.requiredEnv.every(key => !!process.env[key])
}
