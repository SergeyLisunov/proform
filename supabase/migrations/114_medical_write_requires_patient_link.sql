-- ──────────────────────────────────────────────────────────────────────────
-- 114_medical_write_requires_patient_link.sql
--
-- P0. Медосмотры и медицинский дневник мог написать о любом спортсмене
-- любой вошедший пользователь.
--
-- Политики med_checkups_doctor_all (023) и medical_diary_doctor_all (036) —
-- «FOR ALL … WITH CHECK (doctor_id = я)». Они проверяют только, что автор
-- записи — я, но не проверяют, кто пациент и врач ли я вообще. Поэтому
-- спортсмен, тренер или клуб мог одним запросом в PostgREST:
--   • создать «осмотр» с заключением о чужом спортсмене — спортсмен видит
--     его у себя (med_checkups_athlete_select);
--   • создать запись дневника с is_shared_with_coach = true — тренеры
--     спортсмена видят её как медицинское ограничение от «врача»
--     (medical_diary_coach_shared, CoachRestrictionsCard);
--   • то же самое врачом о не своём пациенте.
-- Для recommendations похожую дыру закрыла миграция 105, но только
-- наполовину: связь там проверяется в обе стороны и без ролей, поэтому
-- пациент мог выписать «рекомендацию» своему врачу. Проба MED-01/02
-- проверяла только чтение.
--
-- ЧТО ДЕЛАЕМ.
--   1. has_active_link(_athlete, _types) — есть ли у МЕНЯ активная связь
--      заданного типа со СПОРТСМЕНОМ _athlete (роль athlete). «Я» берётся
--      внутри функции, а не параметром: иначе функция стала бы оракулом
--      «связаны ли X и Y».
--   2. Сплошные FOR ALL политики врача → по командам. Чтение и удаление
--      своих записей — как было. СОЗДАНИЕ — только врачом (роль doctor) и
--      только при активной связи doctor_athlete с этим спортсменом. Запись
--      дневника без спортсмена (личная заметка врача) — разрешена. Политику
--      INSERT рекомендаций из 105 переписываем на то же правило.
--   3. Правка записи (триггер trg_guard_patient_change на все три таблицы):
--      • перенести запись на другого спортсмена можно только на своего
--        пациента — иначе запись создаётся своему и тут же переписывается
--        на чужого;
--      • если связь с пациентом закончилась (пациент её разорвал), автор
--        может запись только закрыть: перевести в итоговый статус или
--        скрыть от спортсмена и тренера. Переписать содержание или
--        заново показать её — нет: иначе бывший врач продолжал бы писать
--        пациенту, отозвавшему согласие, через старые записи.
--      • сменить автора (doctor_id) нельзя: у recommendations несколько
--        разрешающих политик UPDATE, и Postgres принимает новую строку,
--        если она проходит проверку ЛЮБОЙ из них — проверка тренера не
--        смотрит на doctor_id, и автор мог приписать запись другому врачу.
--      Это делает триггер: в политике UPDATE нет доступа к старой строке.
--   4. Адресаты рекомендации. coach_id — только тренер этого спортсмена,
--      organization_id — только клуб, где спортсмен состоит,
--      referred_to_user_id — только врач или специалист. Иначе
--      рекомендация и уведомление о ней уходили любому тренеру, клубу или
--      человеку на платформе. Проверка при создании — в политике INSERT,
--      при смене адресатов — в триггере 116.
--
-- Что считается «связью»: строка connections с connection_type =
-- 'doctor_athlete' и status = 'active' — та же, что в 049/092/105/106.
-- Подделать её самостоятельно нельзя после миграции 115.
--
-- Кто проверяется. Триггер смотрит на роль из JWT, как 104: запросы
-- пользователей (authenticated, anon) проверяются; service role и прямые
-- подключения (миграции, cron, SQL из панели) — нет. Пользователь с JWT,
-- но без строки в users, получает отказ, а не пропуск.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Связь «я — спортсмен» ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_active_link(_athlete uuid, _types text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.connections c
    JOIN public.users a ON a.id = _athlete AND a.role = 'athlete'
    WHERE c.status = 'active'
      AND c.connection_type = ANY (_types)
      AND (
           (c.initiator_id = public.get_my_user_id() AND c.recipient_id = _athlete)
        OR (c.recipient_id = public.get_my_user_id() AND c.initiator_id = _athlete)
      )
  )
$$;

COMMENT ON FUNCTION public.has_active_link(uuid, text[]) IS
  'Есть ли у текущего пользователя активная связь (connections) одного из типов _types со спортсменом _athlete.';

REVOKE ALL ON FUNCTION public.has_active_link(uuid, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_active_link(uuid, text[]) TO authenticated, service_role;

-- Адресаты рекомендации. Ответ осмыслен только для врача этого спортсмена:
-- для остальных функция всегда false и не раскрывает, кто у спортсмена
-- тренер и в каком он клубе.
CREATE OR REPLACE FUNCTION public.recommendation_audience_ok(
  _athlete uuid, _coach uuid, _organization uuid, _referred uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_active_link(_athlete, ARRAY['doctor_athlete'])
    AND (_coach IS NULL OR EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = _coach AND ta.athlete_id = _athlete AND ta.status = 'accepted'))
    AND (_organization IS NULL OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = _organization AND om.user_id = _athlete AND om.status = 'active'))
    AND (_referred IS NULL OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = _referred AND u.role IN ('doctor', 'specialist')))
$$;

REVOKE ALL ON FUNCTION public.recommendation_audience_ok(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recommendation_audience_ok(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- ── 2a. medical_checkups ─────────────────────────────────────────────────
DROP POLICY IF EXISTS med_checkups_doctor_all ON public.medical_checkups;

DROP POLICY IF EXISTS med_checkups_doctor_select ON public.medical_checkups;
CREATE POLICY med_checkups_doctor_select ON public.medical_checkups
  FOR SELECT USING (doctor_id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS med_checkups_doctor_insert ON public.medical_checkups;
CREATE POLICY med_checkups_doctor_insert ON public.medical_checkups
  FOR INSERT WITH CHECK (
    doctor_id = (SELECT public.get_my_user_id())
    AND (SELECT public.get_my_role()) = 'doctor'
    AND public.has_active_link(athlete_id, ARRAY['doctor_athlete'])
  );

DROP POLICY IF EXISTS med_checkups_doctor_update ON public.medical_checkups;
CREATE POLICY med_checkups_doctor_update ON public.medical_checkups
  FOR UPDATE USING (doctor_id = (SELECT public.get_my_user_id()))
  WITH CHECK (doctor_id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS med_checkups_doctor_delete ON public.medical_checkups;
CREATE POLICY med_checkups_doctor_delete ON public.medical_checkups
  FOR DELETE USING (doctor_id = (SELECT public.get_my_user_id()));

-- ── 2b. medical_diary ────────────────────────────────────────────────────
DROP POLICY IF EXISTS medical_diary_doctor_all ON public.medical_diary;

DROP POLICY IF EXISTS medical_diary_doctor_select ON public.medical_diary;
CREATE POLICY medical_diary_doctor_select ON public.medical_diary
  FOR SELECT USING (doctor_id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS medical_diary_doctor_insert ON public.medical_diary;
CREATE POLICY medical_diary_doctor_insert ON public.medical_diary
  FOR INSERT WITH CHECK (
    doctor_id = (SELECT public.get_my_user_id())
    AND (SELECT public.get_my_role()) = 'doctor'
    AND (
      athlete_id IS NULL
      OR public.has_active_link(athlete_id, ARRAY['doctor_athlete'])
    )
  );

DROP POLICY IF EXISTS medical_diary_doctor_update ON public.medical_diary;
CREATE POLICY medical_diary_doctor_update ON public.medical_diary
  FOR UPDATE USING (doctor_id = (SELECT public.get_my_user_id()))
  WITH CHECK (doctor_id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS medical_diary_doctor_delete ON public.medical_diary;
CREATE POLICY medical_diary_doctor_delete ON public.medical_diary
  FOR DELETE USING (doctor_id = (SELECT public.get_my_user_id()));

-- ── 2c. recommendations: INSERT из 105 — на то же правило ─────────────────
DROP POLICY IF EXISTS recommendations_doctor_insert ON public.recommendations;
CREATE POLICY recommendations_doctor_insert ON public.recommendations
  FOR INSERT WITH CHECK (
    doctor_id = (SELECT public.get_my_user_id())
    AND (SELECT public.get_my_role()) = 'doctor'
    AND public.recommendation_audience_ok(athlete_id, coach_id, organization_id, referred_to_user_id)
  );

-- ── 3. Правка записи ─────────────────────────────────────────────────────
-- Общий для трёх таблиц: у всех есть doctor_id и athlete_id; столбцы,
-- которых у таблицы нет (status, is_shared_with_*, calendar_event_id),
-- читаются через jsonb и дают NULL.
--
-- Закрыть запись после разрыва связи — это: перевести её из рабочего
-- статуса в итоговый (но не из одного итогового в другой: «отменён» →
-- «проведён» переписывает историю), скрыть от спортсмена или тренера,
-- отвязать от события календаря. Последнее делает и сам Postgres, когда
-- врач удаляет событие из календаря: внешний ключ calendar_event_id —
-- ON DELETE SET NULL (036).
CREATE OR REPLACE FUNCTION public.trg_guard_patient_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  me         uuid;
  -- Что можно менять в записи пациента, отозвавшего связь.
  closing    text[] := ARRAY['status', 'updated_at', 'is_shared_with_athlete', 'is_shared_with_coach',
                             'calendar_event_id'];
  -- Итоговые статусы осмотра (023) и рекомендации (052).
  final      text[] := ARRAY['completed', 'cancelled', 'no_show', 'resolved', 'expired'];
  o          jsonb := to_jsonb(OLD);
  n          jsonb := to_jsonb(NEW);
BEGIN
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  me := public.get_my_user_id();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Нет профиля пользователя' USING ERRCODE = '42501';
  END IF;

  IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
    RAISE EXCEPTION 'Автора записи сменить нельзя' USING ERRCODE = '42501';
  END IF;

  IF NEW.athlete_id IS DISTINCT FROM OLD.athlete_id THEN
    IF NEW.athlete_id IS NOT NULL
       AND NOT public.has_active_link(NEW.athlete_id, ARRAY['doctor_athlete']) THEN
      RAISE EXCEPTION 'Запись можно перенести только на своего пациента'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF me = OLD.doctor_id
     AND OLD.athlete_id IS NOT NULL
     AND NOT public.has_active_link(OLD.athlete_id, ARRAY['doctor_athlete']) THEN
    IF (n - closing) IS DISTINCT FROM (o - closing)
       OR (n ->> 'status' IS DISTINCT FROM o ->> 'status'
           AND (NOT (n ->> 'status' = ANY (final)) OR o ->> 'status' = ANY (final)))
       OR (n ->> 'calendar_event_id' IS NOT NULL
           AND n ->> 'calendar_event_id' IS DISTINCT FROM o ->> 'calendar_event_id')
       OR (coalesce((n ->> 'is_shared_with_athlete')::boolean, false)
           AND NOT coalesce((o ->> 'is_shared_with_athlete')::boolean, false))
       OR (coalesce((n ->> 'is_shared_with_coach')::boolean, false)
           AND NOT coalesce((o ->> 'is_shared_with_coach')::boolean, false)) THEN
      RAISE EXCEPTION 'Связь с пациентом закончилась: запись можно только закрыть или скрыть'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_guard_patient_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_med_checkups_patient_guard ON public.medical_checkups;
CREATE TRIGGER trg_med_checkups_patient_guard
  BEFORE UPDATE ON public.medical_checkups
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_patient_change();

DROP TRIGGER IF EXISTS trg_medical_diary_patient_guard ON public.medical_diary;
CREATE TRIGGER trg_medical_diary_patient_guard
  BEFORE UPDATE ON public.medical_diary
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_patient_change();

DROP TRIGGER IF EXISTS trg_recommendations_patient_guard ON public.recommendations;
CREATE TRIGGER trg_recommendations_patient_guard
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_patient_change();

COMMIT;

NOTIFY pgrst, 'reload schema';
