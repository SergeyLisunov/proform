-- 091_child_claim_tokens — tenant refactor #4b-v.
--
-- Когда ребёнок-атлет вырастает и хочет свой реальный логин (раньше его аккаунт
-- был создан родителем в #4b-ii с синтетическим email child-<uuid>@sporteo.local
-- и random-паролем), родитель выдаёт ему claim-токен. Ребёнок открывает ссылку,
-- задаёт свой email + пароль, и его auth.users обновляется.
--
-- Запись:
--   token       — секрет (64 hex)
--   child_id    — атлет, аккаунт которого "выкупается"
--   parent_id   — родитель, выдавший токен (для аудита + RLS)
--   expires_at  — через 14 дней по умолчанию
--   claimed_at  — null до использования
--   claimed_email — какой email ребёнок задал (для аудита)
--
-- RLS: родитель видит свои токены; writes только через admin client серверного
-- роута (POST /api/parent/issue-claim-link, POST /api/auth/claim-child).

CREATE TABLE IF NOT EXISTS public.child_claim_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  child_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  claimed_at    timestamptz,
  claimed_email text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT child_claim_no_self CHECK (parent_id <> child_id)
);

CREATE INDEX IF NOT EXISTS idx_child_claim_tokens_token  ON public.child_claim_tokens(token) WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_child_claim_tokens_parent ON public.child_claim_tokens(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_claim_tokens_child  ON public.child_claim_tokens(child_id);

ALTER TABLE public.child_claim_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY child_claim_tokens_parent_select ON public.child_claim_tokens
  FOR SELECT TO public
  USING (parent_id = (SELECT public.get_my_user_id())
         OR public.get_my_role() = 'admin');

-- INSERT/UPDATE/DELETE намеренно не выданы authenticated роли — только admin
-- client серверных роутов записывает эту таблицу.

NOTIFY pgrst, 'reload schema';
