-- ──────────────────────────────────────────────────────────────────────────
-- 101_ai_usage_atomic_increment.sql — атомарное списание AI-квоты.
--
-- Ревью-находка: read-then-write инкремент requests_used терял обновления
-- при конкурентных успешных ответах (permanent undercount). Функция делает
-- инкремент атомарным на стороне Postgres. Инкремент БЕЗУСЛОВНЫЙ
-- (может превысить request_limit на глубину in-flight параллелизма):
-- продуктовый инвариант «списание только после успешного ответа» исключает
-- резервирование-с-возвратом, поэтому переполнение окна допускается,
-- честно фиксируется в счётчике (requests_used может стать > limit) и
-- ограничено сверху анти-burst rate-limit'ом (30 запросов/час).
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_period_id uuid)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE ai_usage_periods
  SET requests_used = requests_used + 1,
      updated_at    = now()
  WHERE id = p_period_id
  RETURNING requests_used;
$$;

-- Вызывается только service-role (gateway); авторизованным ролям недоступна.
REVOKE ALL ON FUNCTION public.increment_ai_usage(uuid) FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
