import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/ai/assistant/gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET    /api/assistant/conversations/:id — сообщения диалога
 *        (RLS owner + диалог должен быть создан в ТЕКУЩЕЙ роли).
 * DELETE /api/assistant/conversations/:id — мягкое удаление владельцем.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })
  const { actor } = res

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = actor.sb as any
  const { data: conv } = await sbAny
    .from('ai_conversations')
    .select('id, title, context_type, context_entity_id, role_snapshot')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!conv) return NextResponse.json({ ok: false, error: 'Диалог не найден.' }, { status: 404 })

  // Изоляция истории по роли должна быть ПОЛНОЙ: список уже фильтрует по
  // role_snapshot, отправка сообщения отдаёт 403, а чтение одного диалога
  // проверок не имело — после смены роли аккаунта переписка прошлой роли
  // открывалась по прямой ссылке (id диалога виден клиенту).
  if (!actor.profile || conv.role_snapshot !== actor.profile.role) {
    return NextResponse.json(
      { ok: false, error: 'Диалог создан в другой роли — начните новый.' },
      { status: 403 },
    )
  }

  const { data: messages } = await sbAny
    .from('ai_messages')
    .select('id, sender_type, content, status, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  return NextResponse.json({ ok: true, conversation: conv, messages: messages ?? [] })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })

  // RLS: обновить можно только свою строку — чужой id даст 0 строк.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (res.actor.sb as any)
    .from('ai_conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
  if (error) return NextResponse.json({ ok: false, error: 'Не удалось удалить.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ ok: false, error: 'Диалог не найден.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
