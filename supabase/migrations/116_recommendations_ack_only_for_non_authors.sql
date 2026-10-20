-- ──────────────────────────────────────────────────────────────────────────
-- 116_recommendations_ack_only_for_non_authors.sql
--
-- Не-автор рекомендации может поставить только свою отметку «ознакомлен».
--
-- ЗАЧЕМ. Спортсмену и тренеру UPDATE рекомендации открыт ради отметки
-- «Понятно» (recommendations_athlete_ack / recommendations_coach_ack, 052).
-- Сами политики не ограничивают столбцы, это делает триггер
-- trg_recommendations_preserve_content (076/078). Но он возвращал из старой
-- строки только перечисленные столбцы: заголовок, текст, категорию,
-- важность, видимость, сроки, врача, спортсмена, организацию. Всё, что
-- добавлялось позже или не попало в список, оставалось открытым: вложения,
-- статус, адресат-тренер, направление к специалисту, отметка другой
-- стороны. Тренер, связанный со спортсменом, мог одним PATCH подменить
-- вложение врача (например, на «допуск»), отменить рекомендацию или
-- перенаправить спортсмена к другому специалисту.
--
-- ЧТО ДЕЛАЕМ. Список «что вернуть» → список «что разрешено». Для любого
-- пользователя, кроме врача-автора, вся строка берётся из старой версии,
-- кроме его собственной отметки: acknowledged_by_athlete_at для самого
-- спортсмена, acknowledged_by_coach_at для остальных (обновлять строку
-- кроме врача и спортсмена политики разрешают только тренеру). Новые
-- столбцы закрыты по умолчанию.
--
-- Автору по-прежнему можно править свою рекомендацию, но если он меняет
-- спортсмена или адресатов (coach_id, organization_id,
-- referred_to_user_id), они проверяются тем же правилом, что при создании
-- (recommendation_audience_ok, 114): иначе адресатов, отклонённых при
-- INSERT, можно было бы дописать следующим UPDATE.
--
-- Статус после отметки по-прежнему выставляет trg_recommendations_updated_at
-- (052): триггеры BEFORE идут по алфавиту, и он срабатывает после этого.
--
-- Кто проверяется — по роли из JWT, как в 104/114/115. Пользователь с JWT,
-- но без строки users, получает отказ, а не пропуск.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_recommendations_preserve_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  caller     uuid;
  own_ack    text;
BEGIN
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  caller := public.get_my_user_id();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Нет профиля пользователя' USING ERRCODE = '42501';
  END IF;

  IF caller = OLD.doctor_id THEN
    IF (NEW.athlete_id, NEW.coach_id, NEW.organization_id, NEW.referred_to_user_id)
         IS DISTINCT FROM (OLD.athlete_id, OLD.coach_id, OLD.organization_id, OLD.referred_to_user_id)
       AND NOT public.recommendation_audience_ok(
             NEW.athlete_id, NEW.coach_id, NEW.organization_id, NEW.referred_to_user_id) THEN
      RAISE EXCEPTION 'Адресовать рекомендацию можно только команде своего пациента'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  own_ack := CASE WHEN caller = OLD.athlete_id
                  THEN 'acknowledged_by_athlete_at'
                  ELSE 'acknowledged_by_coach_at' END;

  NEW := jsonb_populate_record(NEW, to_jsonb(OLD) - own_ack);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recommendations_preserve_content() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
