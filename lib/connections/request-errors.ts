/**
 * Ответ POST /api/connections на понятном языке — одна формулировка для
 * поиска людей (/network) и профиля (/profile/[id]).
 */
export interface ConnectionRequestErrorBody {
  error?: string
  retry_after_hours?: number
}

export function connectionRequestError(status: number, body: ConnectionRequestErrorBody): string {
  if (body.error === 'too_soon') {
    return body.retry_after_hours
      ? `Повторить запрос можно через ${body.retry_after_hours} ч`
      : 'Повторить запрос можно позже'
  }
  if (body.error === 'already_pending') return 'Запрос уже отправлен'
  if (body.error === 'already_connected') return 'Вы уже связаны'
  if (status === 422) return 'С этой ролью связь недоступна'
  return 'Не удалось отправить запрос'
}
