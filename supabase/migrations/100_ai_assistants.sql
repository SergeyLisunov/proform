-- ──────────────────────────────────────────────────────────────────────────
-- 100_ai_assistants.sql — ролевые AI-ассистенты Sporteo (AI Gateway)
--
-- Продуктовые решения (неизменяемые):
--   * ассистент доступен ТОЛЬКО авторизованным, внутри кабинета, по роли
--     и тарифу; глобального плавающего чата и чата на лендинге нет;
--   * лимиты настраиваются БЕЗ изменения кода → tariffs.ai_config (jsonb);
--   * один AI-запрос = успешная пара «сообщение → ответ»; ошибки/отказы/
--     отмены лимит НЕ списывают; списание идемпотентно (unique key);
--   * demo-режим считается отдельно (demo_ai_usage), с реальными лимитами
--     пользователей не смешивается.
--
-- Ролевые промпты НАМЕРЕННО не в БД: Prompt Registry живёт в серверном
-- коде (lib/ai/assistant/prompts.ts) с версией; conversations/messages
-- хранят snapshot роли и версии промпта. Таблица ai_role_profiles из ТЗ
-- заменена кодовым реестром — меньше поверхностей рассинхрона.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Конфиг AI на тарифе — источник истины лимитов (правится без кода)
ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS ai_config jsonb;

UPDATE public.tariffs SET ai_config = v.cfg::jsonb
FROM (VALUES
  ('free',           '{"enabled":true,"monthly_requests":20,"max_output_tokens":400,"history_enabled":false,"context_depth":"basic","streaming":true}'),
  ('pro_athlete',    '{"enabled":true,"monthly_requests":100,"max_output_tokens":500,"history_enabled":true,"context_depth":"role","streaming":true}'),
  ('pro_specialist', '{"enabled":true,"monthly_requests":100,"max_output_tokens":500,"history_enabled":true,"context_depth":"role","streaming":true}'),
  ('pro_trainer',    '{"enabled":true,"monthly_requests":300,"max_output_tokens":700,"history_enabled":true,"context_depth":"role_extended","streaming":true}'),
  ('team_trainer',   '{"enabled":true,"monthly_requests":300,"max_output_tokens":700,"history_enabled":true,"context_depth":"role_extended","streaming":true,"priority":true}'),
  ('club',           '{"enabled":true,"monthly_requests":1000,"max_output_tokens":700,"history_enabled":true,"context_depth":"org_rbac","streaming":true,"org_pool":true,"per_user_soft_limit":200}')
) AS v(code, cfg)
WHERE public.tariffs.code = v.code;

-- 2) Диалоги
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  role_snapshot     text NOT NULL,
  prompt_version    text NOT NULL,
  title             text,
  context_type      text CHECK (context_type IS NULL OR context_type IN ('athlete','patient','organization')),
  context_entity_id uuid,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner
  ON public.ai_conversations (user_id, updated_at DESC) WHERE deleted_at IS NULL;

-- 3) Сообщения
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('user','assistant')),
  content         text NOT NULL CHECK (length(content) <= 20000),
  provider        text,
  output_tokens   integer,
  status          text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','stopped','error')),
  safety_flags    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON public.ai_messages (conversation_id, created_at ASC);

-- 4) Периоды использования (месячные). scope: персональный ИЛИ орг-пул.
CREATE TABLE IF NOT EXISTS public.ai_usage_periods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           text NOT NULL CHECK (scope IN ('user','org')),
  user_id         uuid REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  request_limit   integer NOT NULL,
  requests_used   integer NOT NULL DEFAULT 0 CHECK (requests_used >= 0),
  output_tokens_used bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_scope_target CHECK (
    (scope = 'user' AND user_id IS NOT NULL) OR
    (scope = 'org'  AND organization_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_user_period
  ON public.ai_usage_periods (user_id, period_start) WHERE scope = 'user';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_org_period
  ON public.ai_usage_periods (organization_id, period_start) WHERE scope = 'org';

-- 5) События списания/отказов. idempotency_key = страховка от двойного
--    списания одного запроса (ретраи, повторная доставка).
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid,
  conversation_id uuid,
  message_id      uuid,
  event_type      text NOT NULL CHECK (event_type IN
                    ('request_charged','denied_quota','denied_policy','provider_error')),
  units           integer NOT NULL DEFAULT 1,
  idempotency_key text UNIQUE,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user
  ON public.ai_usage_events (user_id, created_at DESC);

-- 6) Аудит доступа (без полного чувствительного текста)
CREATE TABLE IF NOT EXISTS public.ai_audit_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  organization_id   uuid,
  role              text NOT NULL,
  action            text NOT NULL,
  context_type      text,
  context_entity_id uuid,
  result            text NOT NULL CHECK (result IN ('allowed','denied','error')),
  risk_flags        jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user
  ON public.ai_audit_events (user_id, created_at DESC);

-- 7) Demo-учёт (отдельно от пользовательских лимитов)
CREATE TABLE IF NOT EXISTS public.demo_ai_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash  text NOT NULL UNIQUE,
  ip_hash       text,
  requests_used integer NOT NULL DEFAULT 0,
  first_used_at timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_ai_ip ON public.demo_ai_usage (ip_hash);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Диалоги/сообщения: строго владелец (object-level authorization);
-- служебные таблицы — только service-role (политик нет = deny all).
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_ai_usage    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_owner ON public.ai_conversations;
CREATE POLICY ai_conversations_owner ON public.ai_conversations
  FOR ALL TO public
  USING (user_id = (SELECT public.get_my_user_id()))
  WITH CHECK (user_id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS ai_messages_owner ON public.ai_messages;
CREATE POLICY ai_messages_owner ON public.ai_messages
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = conversation_id
              AND c.user_id = (SELECT public.get_my_user_id())
              AND c.deleted_at IS NULL)
  );
-- INSERT сообщений — только сервер (service-role): содержание ответа и
-- статусы пишет gateway, пользовательский INSERT не нужен.

NOTIFY pgrst, 'reload schema';
