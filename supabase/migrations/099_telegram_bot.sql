-- ──────────────────────────────────────────────────────────────────────────
-- 099_telegram_bot.sql  (P2 — Telegram-бот)
--
-- Линковка аккаунта по одноразовому коду (deep-link /start <code>) +
-- очередь зеркалирования уведомлений.
--
-- Ключевые решения (из research):
--   * Код хранится ТОЛЬКО SHA-256-хэшем, TTL 10 минут, single-use.
--   * Один TG-аккаунт ↔ один пользователь платформы (UNIQUE user_id);
--     unlink — мягкий (unlinked_at), строка остаётся для аудита.
--   * Зеркалирование — СТРОГО opt-in: prefs-ключ 'telegram' должен быть
--     явно true (сама линковка ни на что не подписывает — чистая история
--     согласия по 152-ФЗ). Дефолт для ключа в реестре CHANNELS = false.
--   * Очередь (telegram_deliveries) наполняет AFTER INSERT триггер на
--     notifications; шлёт /api/telegram/process-queue (CRON_SECRET, на
--     Hostiman — crontab * * * * *). UNIQUE(notification_id) = не шлём
--     дважды. В очередь идут ТОЛЬКО title и action_url — тело
--     уведомления может содержать детали, которым не место в TG
--     (мед-статусы и пр.): паттерн notify-of-existence + deep-link.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.telegram_accounts (
  user_id          uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  chat_id          bigint NOT NULL,
  tg_username      text,
  linked_at        timestamptz NOT NULL DEFAULT now(),
  unlinked_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_tg_user
  ON public.telegram_accounts (telegram_user_id) WHERE unlinked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
  ON public.telegram_link_codes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_id         bigint NOT NULL,
  title           text NOT NULL,
  action_url      text,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','failed','skipped')),
  attempts        int NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_telegram_deliveries_queued
  ON public.telegram_deliveries (created_at) WHERE status = 'queued';

-- RLS: telegram_accounts читает сам пользователь (страница настроек);
-- все записи — только service-role. Кодовые/очередные таблицы — только
-- service-role (клиенту там делать нечего).
ALTER TABLE public.telegram_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_accounts_self_read ON public.telegram_accounts;
CREATE POLICY telegram_accounts_self_read ON public.telegram_accounts
  FOR SELECT TO public USING (user_id = (SELECT public.get_my_user_id()));

-- Очередь: AFTER INSERT на notifications. Только явный opt-in.
CREATE OR REPLACE FUNCTION public.enqueue_telegram_delivery()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc RECORD;
  opted boolean;
BEGIN
  SELECT chat_id INTO acc
  FROM telegram_accounts
  WHERE user_id = NEW.user_id AND unlinked_at IS NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE((notification_prefs->>'telegram')::boolean, false) INTO opted
  FROM users WHERE id = NEW.user_id;
  IF NOT opted THEN RETURN NEW; END IF;

  INSERT INTO telegram_deliveries (notification_id, user_id, chat_id, title, action_url)
  VALUES (NEW.id, NEW.user_id, acc.chat_id, NEW.title, NEW.action_url)
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_telegram ON public.notifications;
CREATE TRIGGER trg_enqueue_telegram
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_telegram_delivery();

NOTIFY pgrst, 'reload schema';
