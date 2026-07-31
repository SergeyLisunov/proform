-- ──────────────────────────────────────────────────────────────────────────
-- 111_trainer_athletes_status_vocabulary.sql — словарь статуса связи
-- тренер↔спортсмен: умолчание противоречило коду.
--
-- Что было:
--   CHECK  → 'accepted' | 'active' | 'inactive' | 'pending'
--   DEFAULT → 'active'
--   а код читает связь СТРОГО как status = 'accepted' — 28 мест в ~20 файлах
--   плюс 19 RLS-политик (workouts, calendar_events, clearances, injuries,
--   recommendations, medical_diary, wellness_checkins и др.).
--
-- Ловушка не в данных, а в умолчании. Любая вставка без явного status —
-- новый код, ручная вставка через дашборд, миграция — создаёт строку со
-- статусом 'active'. Связь в базе есть, но для всех читающих путей её как
-- бы нет: тренер не видит спортсмена, RLS не пускает к тренировкам,
-- ассистент отказывает в контексте. Молча, без единой ошибки. Именно так
-- ошибся QA-seed, и заметили это только при разборе странного поведения
-- проверок.
--
-- Решение (вариант владельца): один осмысленный жизненный цикл
--   pending → accepted → inactive
-- 'active' удаляется как дубликат 'accepted', умолчание становится
-- 'accepted' — то есть совпадает с тем, что ожидает весь читающий код.
-- Задел под приглашения ('pending') сохранён: для врачей такой механизм уже
-- есть в connections, для тренеров он вероятен.
--
-- Данные: на момент миграции строк со статусом 'active' в проде нет (все
-- пять связей — синтетические QA, уже приведены к 'accepted'). UPDATE ниже
-- оставлен ради идемпотентности и повторного применения на других средах.
--
-- Проверено перед правкой: ни один запрос к trainer_athletes в коде не
-- использует 'active' (совпадения в grep принадлежали соседним запросам к
-- connections и parent_links, где 'active' — правильный статус), и ни одна
-- RLS-политика не ссылается на trainer_athletes.status = 'active'.
--
-- Регрессия: lib/db/link-status-vocabulary.test.ts
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Нормализуем данные ДО сужения словаря, иначе CHECK не создастся.
UPDATE public.trainer_athletes
SET    status = 'accepted'
WHERE  status = 'active';

-- 2. Словарь без дубликата.
ALTER TABLE public.trainer_athletes
  DROP CONSTRAINT IF EXISTS trainer_athletes_status_check;

ALTER TABLE public.trainer_athletes
  ADD CONSTRAINT trainer_athletes_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'inactive'::text]));

-- 3. Умолчание совпадает с тем, что читает код.
ALTER TABLE public.trainer_athletes
  ALTER COLUMN status SET DEFAULT 'accepted';

COMMENT ON COLUMN public.trainer_athletes.status IS
  'Жизненный цикл связи: pending (приглашение отправлено) → accepted (действует) → inactive (расторгнута, история сохранена). Рабочим считается ТОЛЬКО accepted — так читают код и RLS.';

NOTIFY pgrst, 'reload schema';
