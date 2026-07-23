import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveActor, auditEvent } from '@/lib/ai/assistant/gateway'
import {
  verifyTrainerAthlete, verifyDoctorPatient, resolveMyOrganization,
} from '@/lib/ai/assistant/context'
import { PROMPT_VERSION } from '@/lib/ai/assistant/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/assistant/conversations — список своих диалогов (RLS owner-only;
 *      отдаётся только при history_enabled тарифа).
 * POST /api/assistant/conversations — создать диалог; контекстная сущность
 *      из клиента ПЕРЕПРОВЕРЯЕТСЯ object-level (IDOR-защита) и снапшотится.
 */
export async function GET() {
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })
  const { actor } = res
  if (!actor.profile || !actor.config.enabled) {
    return NextResponse.json({ ok: false, error: 'AI-помощник недоступен.' }, { status: 403 })
  }
  if (!actor.config.history_enabled) {
    return NextResponse.json({ ok: true, conversations: [], historyEnabled: false })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (actor.sb as any)
    .from('ai_conversations')
    .select('id, title, context_type, context_entity_id, updated_at')
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(30)
  return NextResponse.json({ ok: true, conversations: data ?? [], historyEnabled: true })
}

const CreateSchema = z.object({
  contextType:     z.enum(['athlete', 'patient', 'organization']).nullish(),
  contextEntityId: z.string().uuid().nullish(),
})

export async function POST(req: Request) {
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })
  const { actor } = res
  if (!actor.profile || !actor.config.enabled) {
    return NextResponse.json({ ok: false, error: 'AI-помощник недоступен.' }, { status: 403 })
  }

  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json().catch(() => ({})))
  } catch {
    return NextResponse.json({ ok: false, error: 'Некорректный запрос.' }, { status: 400 })
  }

  const ct = body.contextType ?? null
  let entity = body.contextEntityId ?? null
  let organizationId: string | null = null

  // Object-level authorization: клиентскому идентификатору не верим.
  if (ct && !actor.profile.allowedContextTypes.includes(ct)) {
    auditEvent(actor.admin, {
      userId: actor.userId, role: actor.profile.role, action: 'create_conversation',
      contextType: ct, contextEntityId: entity, result: 'denied',
      riskFlags: { reason: 'context_type_not_allowed' },
    })
    return NextResponse.json({ ok: false, error: 'Контекст недоступен для вашей роли.' }, { status: 403 })
  }
  if (ct === 'athlete' && entity) {
    if (!(await verifyTrainerAthlete(actor.sb, actor.userId, entity))) {
      auditEvent(actor.admin, {
        userId: actor.userId, role: actor.profile.role, action: 'create_conversation',
        contextType: ct, contextEntityId: entity, result: 'denied',
        riskFlags: { reason: 'athlete_not_linked' },
      })
      return NextResponse.json({ ok: false, error: 'Этот спортсмен не прикреплён к вам.' }, { status: 403 })
    }
  }
  if (ct === 'patient' && entity) {
    if (!(await verifyDoctorPatient(actor.sb, actor.userId, entity))) {
      auditEvent(actor.admin, {
        userId: actor.userId, role: actor.profile.role, action: 'create_conversation',
        contextType: ct, contextEntityId: entity, result: 'denied',
        riskFlags: { reason: 'patient_not_assigned' },
      })
      return NextResponse.json({ ok: false, error: 'Этот спортсмен вам не назначен.' }, { status: 403 })
    }
  }
  if (ct === 'organization' || actor.profile.role === 'organization') {
    organizationId = await resolveMyOrganization(actor.sb, actor.userId)
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'Организация не найдена.' }, { status: 403 })
    }
    entity = organizationId // всегда СВОЯ организация, клиентский id игнорируем
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error } = await (actor.sb as any)
    .from('ai_conversations')
    .insert({
      user_id:           actor.userId,
      organization_id:   organizationId,
      role_snapshot:     actor.profile.role,
      prompt_version:    PROMPT_VERSION,
      context_type:      ct,
      context_entity_id: entity,
    })
    .select('id, title, context_type, context_entity_id, updated_at')
    .single()
  if (error || !conv) {
    return NextResponse.json({ ok: false, error: 'Не удалось создать диалог.' }, { status: 500 })
  }

  auditEvent(actor.admin, {
    userId: actor.userId, organizationId, role: actor.profile.role,
    action: 'create_conversation', contextType: ct, contextEntityId: entity, result: 'allowed',
  })
  return NextResponse.json({ ok: true, conversation: conv })
}
