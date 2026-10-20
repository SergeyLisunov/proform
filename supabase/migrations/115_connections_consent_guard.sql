-- ──────────────────────────────────────────────────────────────────────────
-- 115_connections_consent_guard.sql
--
-- Активную связь создаёт только согласие второй стороны — проверка в базе.
--
-- ЗАЧЕМ. Активная строка connections — это и есть доступ: врач с
-- doctor_athlete пишет медзаписи (105, 114) и читает самочувствие (049),
-- тренер с coach_athlete получает trainer_athletes (085) и вместе с ним
-- тренировки, травмы и медданные спортсмена. До сих пор порядок «запрос →
-- согласие получателя» соблюдал только код API:
--   POST /api/connections         — вставляет запрос без статуса (pending)
--                                   и сверяет роли сторон с типом связи;
--                                   повторный запрос после отказа пишет
--                                   initiator_id = я;
--   PATCH /api/connections/[id]   — accept разрешён только получателю.
-- Политик RLS на connections в репозитории нет (создавались в панели), и
-- по файлам нельзя проверить, что этот порядок нельзя обойти прямым
-- запросом в PostgREST. Пути обхода, которые закрывает триггер:
--   • вставить сразу status = 'active';
--   • принять свой же запрос;
--   • записать запрос от имени жертвы и принять его как «получатель»;
--   • назваться «врачом» в doctor_athlete, будучи тренером;
--   • вернуть в pending старый запрос, который жертва когда-то прислала, а
--     потом отменила или разорвала, — и снова принять его самому;
--   • переписать активную связь на другого человека: 085 смотрит только на
--     новую строку и оставил бы старому адресату доступ, который тот уже
--     не видит и не может отозвать.
--
-- ПРАВИЛА для запросов от имени пользователя:
--   • новый запрос — это вставка, смена сторон или типа, или возврат в
--     pending из любого другого статуса. Он идёт только от своего имени
--     (initiator_id = я), не бывает сразу активным, и роли сторон
--     подходят к типу — тот же список, что validCombos в
--     app/api/connections/route.ts;
--   • стороны и тип активной связи не меняются — сначала её разрывают;
--   • перевод в active — только получателем и только из pending.
-- Остальное — отклонить, отменить, разорвать — как было.
--
-- Кто проверяется. Как в 104 и 114: по роли из JWT. Запросы пользователей
-- (authenticated, anon) проверяются; service role и прямые подключения —
-- нет. Серверные маршруты, которые законно создают активную связь сразу
-- (приглашение по ссылке, клуб назначает врача или тренера), работают
-- через service role; сиды QA — через SQL-редактор.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_connections_consent_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role  text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  me          uuid;
  new_request boolean;
  role_a      text;
  role_b      text;
BEGIN
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  me := public.get_my_user_id();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Нет профиля пользователя' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND (
       NEW.initiator_id    IS DISTINCT FROM OLD.initiator_id
    OR NEW.recipient_id    IS DISTINCT FROM OLD.recipient_id
    OR NEW.connection_type IS DISTINCT FROM OLD.connection_type) THEN
    RAISE EXCEPTION 'Активную связь нельзя переписать на другого человека — сначала разорвите её'
      USING ERRCODE = '42501';
  END IF;

  new_request := TG_OP = 'INSERT'
    OR NEW.initiator_id    IS DISTINCT FROM OLD.initiator_id
    OR NEW.recipient_id    IS DISTINCT FROM OLD.recipient_id
    OR NEW.connection_type IS DISTINCT FROM OLD.connection_type
    OR (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending');

  IF new_request THEN
    IF NEW.initiator_id IS DISTINCT FROM me THEN
      RAISE EXCEPTION 'Запрос на связь отправляется только от своего имени'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'active' THEN
      RAISE EXCEPTION 'Связь становится активной только после согласия второй стороны'
        USING ERRCODE = '42501';
    END IF;

    SELECT role INTO role_a FROM public.users WHERE id = NEW.initiator_id;
    SELECT role INTO role_b FROM public.users WHERE id = NEW.recipient_id;

    IF NOT EXISTS (
      SELECT 1
      FROM (VALUES
        ('coach_athlete',  'coach',        'athlete'),
        ('org_coach',      'organization', 'coach'),
        ('org_athlete',    'organization', 'athlete'),
        ('doctor_athlete', 'doctor',       'athlete'),
        ('coach_doctor',   'coach',        'doctor'),
        ('org_doctor',     'organization', 'doctor'),
        ('admin_doctor',   'admin',        'doctor')
      ) AS combo(connection_type, r1, r2)
      WHERE combo.connection_type = NEW.connection_type
        AND ((role_a = combo.r1 AND role_b = combo.r2)
          OR (role_a = combo.r2 AND role_b = combo.r1))
    ) THEN
      RAISE EXCEPTION 'Роли сторон не подходят к типу связи %', NEW.connection_type
        USING ERRCODE = '42501';
    END IF;

  ELSIF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF OLD.status IS DISTINCT FROM 'pending' OR OLD.recipient_id IS DISTINCT FROM me THEN
      RAISE EXCEPTION 'Принять запрос на связь может только его получатель'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_connections_consent_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_connections_consent_guard ON public.connections;
CREATE TRIGGER trg_connections_consent_guard
  BEFORE INSERT OR UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.trg_connections_consent_guard();

COMMIT;

NOTIFY pgrst, 'reload schema';
