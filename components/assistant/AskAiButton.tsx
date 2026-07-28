'use client'

/**
 * AskAiButton — контекстная кнопка «Спросить AI об этом спортсмене».
 *
 * Открывает плавающий AI-помощник событием (не отдельный чат на
 * странице) и передаёт ТОЛЬКО идентификатор сущности + подпись для UI.
 * Доступ к сущности сервер перепроверяет при создании диалога и на
 * каждом сообщении (object-level authorization); полный объект через
 * URL/событие не передаётся.
 *
 * viewerRole решает тип контекста: тренер → athlete, врач/специалист →
 * patient. Остальным ролям кнопка не рендерится.
 */
import { ASSISTANT_OPEN_EVENT, type AssistantOpenDetail } from './FloatingAssistant'

interface AskAiButtonProps {
  viewerRole: string | null | undefined
  athleteId: string
  athleteName: string
}

export default function AskAiButton({ viewerRole, athleteId, athleteName }: AskAiButtonProps) {
  const contextType =
    viewerRole === 'coach' ? 'athlete' as const :
    viewerRole === 'doctor' || viewerRole === 'specialist' ? 'patient' as const :
    null
  if (!contextType) return null
  const ct = contextType // зафиксированный нарровинг для замыкания

  function openAssistant() {
    const detail: AssistantOpenDetail = {
      contextType: ct,
      contextEntityId: athleteId,
      contextLabel: athleteName,
    }
    window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail }))
  }

  return (
    <button
      type="button"
      onClick={openAssistant}
      className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
    >
      <i className="ki-filled ki-message-question text-[13px]" />
      Спросить AI об этом спортсмене
    </button>
  )
}
