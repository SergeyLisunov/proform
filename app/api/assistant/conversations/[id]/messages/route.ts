import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveActor, auditEvent, MAX_MESSAGE_LENGTH } from '@/lib/ai/assistant/gateway'
import { buildContext, ContextAccessError } from '@/lib/ai/assistant/context'
import { buildSystemPrompt } from '@/lib/ai/assistant/prompts'
import { getAssistantProvider } from '@/lib/ai/assistant/provider'
import { checkQuota, chargeRequest, logUsageEvent, getUsageState } from '@/lib/ai/assistant/usage'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { OllamaError, type OllamaChatMessage } from '@/lib/ai/ollama'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Бюджет: auth+проверки+контекст (~1-2с) + генерация ≤ max_output_tokens
// тарифа (≤700 ток. ≈ 41с при худших 17 ток/с) внутри 50с-дедлайна провайдера.
export const maxDuration = 60

/**
 * POST /api/assistant/conversations/:id/messages — отправка сообщения.
 *
 * Порядок (неизменяемый): сессия → роль → тариф → ownership диалога →
 * anti-burst rate limit → КВОТА (без списания) → повторная object-level
 * проверка контекстной сущности → allowlist-контекст → провайдер (стрим)
 * → персист ответа → СПИСАНИЕ ТОЛЬКО ПОСЛЕ УСПЕХА (идемпотентно) → аудит.
 * Любая ошибка/отказ/отмена до успешного конца — лимит не тронут.
 */
const BodySchema = z.object({
  content: z.string().min(1).transform(s => s.slice(0, MAX_MESSAGE_LENGTH)),
  /**
   * Клиентский idempotency-ключ отправки: повторная доставка ТОГО ЖЕ
   * сообщения (ретрай сети/двойной клик) не создаёт второй запрос и не
   * списывает лимит дважды — дубль ловится UNIQUE по id user-сообщения.
   */
  clientMessageId: z.string().uuid(),
})

const HISTORY_MESSAGES = 12

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })
  const { actor } = res
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = actor.sb as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = actor.admin as any

  if (!actor.profile) {
    return NextResponse.json({ ok: false, error: 'AI-помощник недоступен для вашей роли.' }, { status: 403 })
  }
  if (!actor.config.enabled) {
    return NextResponse.json(
      { ok: false, error: 'AI-помощник не входит в ваш тариф.', upgrade: '/pricing' },
      { status: 403 },
    )
  }
  const provider = getAssistantProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI временно не настроен на сервере.' }, { status: 503 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'Пустое или некорректное сообщение.' }, { status: 400 })
  }

  // Ownership: RLS отдаёт только свой диалог — чужой id == 404.
  const { data: convRaw } = await sbAny
    .from('ai_conversations')
    .select('id, context_type, context_entity_id, role_snapshot, title')
    .eq('id', conversationId)
    .is('deleted_at', null)
    .maybeSingle()
  const conv = convRaw as {
    id: string; context_type: 'athlete' | 'patient' | 'organization' | null
    context_entity_id: string | null; role_snapshot: string; title: string | null
  } | null
  if (!conv) return NextResponse.json({ ok: false, error: 'Диалог не найден.' }, { status: 404 })

  // Изоляция истории по роли: диалог, созданный в другой роли аккаунта,
  // продолжать нельзя — контекст и политика той роли не действуют.
  if (conv.role_snapshot !== actor.profile.role) {
    return NextResponse.json(
      { ok: false, error: 'Диалог создан в другой роли — начните новый.' },
      { status: 403 },
    )
  }

  // Anti-burst поверх месячной квоты (частотный, НЕ квотный лимит).
  const burst = await enforceAiRateLimit(req, actor.sb, 'assistant', 30, 3600)
  if (burst) {
    return NextResponse.json(
      { ok: false, error: 'Слишком много запросов подряд — сделайте паузу.' },
      { status: 429 },
    )
  }

  // Квота тарифа (только проверка, списание — после успеха).
  // Осознанное решение: admission = check-then-act, БЕЗ резервирования —
  // инвариант «ошибка/отмена не списывает» исключает reserve+refund.
  // Параллельные запросы на последнем остатке могут превысить лимит на
  // глубину in-flight окна; это ограничено анти-burst лимитом ниже,
  // честно отражается счётчиком (атомарный инкремент 101 не теряет
  // обновлений, requests_used может превысить limit) и принято как риск.
  const quota = await checkQuota(actor.admin, actor.usageScope, actor.config)
  if (!quota.allowed) {
    await logUsageEvent(actor.admin, {
      userId: actor.userId, organizationId: actor.usageScope.organizationId,
      conversationId, eventType: 'denied_quota', metadata: { reason: quota.reason },
    })
    const usage = await getUsageState(actor.admin, actor.usageScope, actor.config)
    return NextResponse.json({
      ok: false,
      error: quota.reason === 'soft_limit_exhausted'
        ? 'Ваш персональный лимит в пуле организации исчерпан — обратитесь к администратору.'
        : 'Лимит AI-запросов на этот месяц исчерпан.',
      usage,
      upgrade: '/pricing',
    }, { status: 429 })
  }

  // Контекст: сущность из СНАПШОТА диалога, но доступ перепроверяется
  // КАЖДЫЙ раз (открепили атлета — контекст сразу закрывается).
  let context
  try {
    context = await buildContext(actor.sb, actor.admin, actor.profile, actor.userId, {
      contextType: conv.context_type,
      contextEntityId: conv.context_entity_id,
    })
  } catch (e) {
    if (e instanceof ContextAccessError) {
      auditEvent(actor.admin, {
        userId: actor.userId, role: actor.profile.role, action: 'message',
        contextType: conv.context_type, contextEntityId: conv.context_entity_id,
        result: 'denied', riskFlags: { reason: 'entity_access_revoked' },
      })
      await logUsageEvent(actor.admin, {
        userId: actor.userId, organizationId: actor.usageScope.organizationId,
        conversationId, eventType: 'denied_policy', metadata: { reason: e.message },
      })
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 })
    }
    throw e
  }

  // История диалога — С СЕРВЕРА (клиентской истории не верим).
  const { data: histRaw } = await sbAny
    .from('ai_messages')
    .select('sender_type, content, status')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_MESSAGES)
  const history = ((histRaw ?? []) as Array<{ sender_type: string; content: string; status: string }>)
    .filter(m => m.status === 'ok')
    .reverse()
    .map(m => ({
      role: (m.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content.slice(0, 2500),
    }))

  // Персист сообщения пользователя ДО провайдера (история не теряется).
  // id = клиентский idempotency-ключ: повторная доставка того же сообщения
  // упирается в PK-конфликт → 409, без второй генерации и второго списания.
  const userMsgId = body.clientMessageId
  const { error: userMsgErr } = await adminAny
    .from('ai_messages')
    .insert({
      id: userMsgId,
      conversation_id: conversationId,
      sender_type: 'user',
      content: body.content,
    })
  if (userMsgErr) {
    if (userMsgErr.code === '23505') {
      return NextResponse.json(
        { ok: false, error: 'Это сообщение уже обработано — обновите диалог.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: false, error: 'Не удалось сохранить сообщение.' }, { status: 500 })
  }

  const maxWords = Math.round(actor.config.max_output_tokens * 0.6)
  const messages: OllamaChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        role: actor.profile.role,
        userName: actor.userName,
        maxWords,
        contextBlock: context.block,
        todayISO: new Date().toISOString().slice(0, 10),
      }),
    },
    ...history,
    { role: 'user', content: body.content },
  ]

  let upstream: ReadableStream<Uint8Array>
  try {
    upstream = await provider.streamChat(messages, {
      signal: req.signal,
      maxOutputTokens: actor.config.max_output_tokens,
    })
  } catch (err) {
    await logUsageEvent(actor.admin, {
      userId: actor.userId, organizationId: actor.usageScope.organizationId,
      conversationId, eventType: 'provider_error',
      metadata: { code: err instanceof OllamaError ? err.code : 'unknown' },
    })
    const msg = err instanceof OllamaError && err.code === 'OLLAMA_RATE_LIMITED'
      ? 'AI перегружен — попробуйте через минуту.'
      : 'AI временно недоступен — попробуйте ещё раз.'
    // Ошибка провайдера: запрос НЕ списан.
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // Стрим наружу + аккумулятор; успех фиксируем в flush (upstream дочитан
  // до конца) — только тогда персист ответа и СПИСАНИЕ (идемпотентное).
  const decoder = new TextDecoder()
  let fullText = ''
  let charged = false

  const persistSuccess = async () => {
    if (charged) return
    charged = true
    // Ответ пользователю уже доставлен стримом — НИЧТО ниже не должно
    // уронить хвост стрима (flush). Каждая ступень изолирована; сбой
    // списания логируется с idempotency-ключом для ручной сверки.
    let assistantMsgId: string | null = null
    try {
      const { data: aMsg } = await adminAny
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          sender_type:     'assistant',
          content:         fullText.slice(0, 20000),
          provider:        provider.name,
          status:          'ok',
        })
        .select('id')
        .single()
      assistantMsgId = (aMsg as { id: string } | null)?.id ?? null
    } catch (e) {
      console.error('[assistant] answer persist failed:', e instanceof Error ? e.message : e)
    }
    try {
      await chargeRequest(actor.admin, {
        scope:          actor.usageScope,
        config:         actor.config,
        conversationId,
        messageId:      assistantMsgId ?? userMsgId,
        idempotencyKey: `chg:${userMsgId}`,
      })
    } catch (e) {
      console.error(
        `[assistant] CHARGE FAILED (key chg:${userMsgId}) — reconcile manually:`,
        e instanceof Error ? e.message : e,
      )
    }
    try {
      await adminAny.from('ai_conversations')
        .update({
          updated_at: new Date().toISOString(),
          ...(conv.title ? {} : { title: body.content.slice(0, 80) }),
        })
        .eq('id', conversationId)
    } catch { /* не критично */ }
    auditEvent(actor.admin, {
      userId: actor.userId, organizationId: actor.usageScope.organizationId,
      role: actor.profile!.role, action: 'message',
      contextType: conv.context_type, contextEntityId: conv.context_entity_id,
      result: 'allowed',
    })
  }

  const persistPartial = async (status: 'stopped' | 'error') => {
    // Отмена/обрыв: НЕ списываем; частичный текст сохраняем для истории.
    if (charged || !fullText) return
    await adminAny.from('ai_messages').insert({
      conversation_id: conversationId,
      sender_type:     'assistant',
      content:         fullText.slice(0, 20000),
      provider:        provider.name,
      status,
    }).then(() => {}, () => {})
  }

  const out = upstream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform: (chunk, controller) => {
      fullText += decoder.decode(chunk, { stream: true })
      controller.enqueue(chunk)
    },
    flush: async () => {
      fullText += decoder.decode()
      await persistSuccess()
    },
  }))

  // Обрыв клиента (кнопка «Остановить»/закрытие вкладки) — без списания.
  req.signal.addEventListener('abort', () => { void persistPartial('stopped') }, { once: true })

  return new Response(out, {
    headers: {
      'Content-Type':      'text/plain; charset=utf-8',
      'Cache-Control':     'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
