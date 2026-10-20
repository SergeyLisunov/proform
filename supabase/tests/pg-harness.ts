/**
 * Стенд для проверки RLS-миграций без живой базы: настоящий Postgres
 * (PGlite, WASM) в памяти процесса.
 *
 * ЗАЧЕМ. Политики и триггеры до сих пор проверялись только пробой
 * qa/ralph/rls-probe.mjs против живого Supabase. Когда база недоступна или
 * миграция ещё не применена, проверить её было нечем. Стенд накатывает
 * НАСТОЯЩИЕ файлы миграций из supabase/migrations поверх минимальной
 * заглушки схемы и выполняет запросы так, как их выполняет PostgREST:
 * под ролью authenticated, с JWT-claims в request.jwt.claims.
 *
 * Заглушка — не копия продовой схемы. В ней только то, на что опираются
 * проверяемые миграции. Данные только синтетические.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

/** Файл миграции без NOTIFY pgrst — PostgREST в стенде нет. */
function migration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/NOTIFY pgrst[^;]*;/g, '')
}

/**
 * То, что в проде создано панелью Supabase, а не миграциями репозитория:
 * роли PostgREST, auth.uid(), users, get_my_user_id(), get_my_role(),
 * connections; плюс пустые таблицы, на которые ссылаются миграции.
 *
 * Политика на connections — худший случай: участник связи может делать с
 * ней что угодно. Настоящих политик в репозитории нет, и защита не должна
 * от них зависеть.
 */
const PLATFORM_STUB = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

CREATE TABLE users (id uuid PRIMARY KEY, auth_id uuid UNIQUE, role text, email text);
CREATE FUNCTION get_my_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public AS $$ SELECT id FROM users WHERE auth_id = auth.uid() $$;
CREATE FUNCTION _touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id    uuid NOT NULL REFERENCES users(id),
  recipient_id    uuid NOT NULL REFERENCES users(id),
  connection_type text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  message         text,
  initiated_at    timestamptz DEFAULT now(),
  responded_at    timestamptz,
  terminated_at   timestamptz,
  terminated_by   uuid
);
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY conn_participant ON connections FOR ALL
  USING (initiator_id = get_my_user_id() OR recipient_id = get_my_user_id())
  WITH CHECK (initiator_id = get_my_user_id() OR recipient_id = get_my_user_id());

CREATE FUNCTION get_my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public AS $$ SELECT role FROM users WHERE auth_id = auth.uid() $$;

CREATE TABLE trainer_athletes (
  trainer_id uuid, athlete_id uuid, status text, assigned_by uuid, updated_at timestamptz,
  UNIQUE (trainer_id, athlete_id)
);
CREATE TABLE calendar_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE org_members (org_id uuid, user_id uuid, member_role text, status text);
`

/** Сам триггер создаёт 076, но остальное в ней — про другие таблицы. */
const PRESERVE_TRIGGER = `
CREATE TRIGGER trg_recommendations_preserve_content BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.trg_recommendations_preserve_content();
`

/** Синтетические пользователи. users.id ≠ auth_id — как в проде. */
export const USERS = {
  doctorA:  { id: '00000000-0000-0000-0000-0000000000a1', role: 'doctor' },
  doctorB:  { id: '00000000-0000-0000-0000-0000000000b1', role: 'doctor' },
  athleteA1: { id: '00000000-0000-0000-0000-0000000000a2', role: 'athlete' },
  athleteA2: { id: '00000000-0000-0000-0000-0000000000a3', role: 'athlete' },
  athleteA3: { id: '00000000-0000-0000-0000-0000000000a5', role: 'athlete' },
  athleteB: { id: '00000000-0000-0000-0000-0000000000b2', role: 'athlete' },
  coachA:   { id: '00000000-0000-0000-0000-0000000000a4', role: 'coach' },
} as const

export type UserKey = keyof typeof USERS

const authIdOf = (key: UserKey): string => USERS[key].id.replace(/^0/, 'f')

export interface QueryOutcome {
  rows: Record<string, unknown>[]
  /** Сколько строк вернул RETURNING/SELECT или затронул запрос. */
  count: number
  error?: string
  /** SQLSTATE ошибки: 42501 — отказ по правам (RLS или триггер). */
  code?: string
}

export interface Db {
  /** Запрос от имени пользователя, как через PostgREST. */
  as(user: UserKey, sql: string, params?: unknown[]): Promise<QueryOutcome>
  /** Запрос с действительным JWT, но без строки в users. */
  asUnknownUser(sql: string, params?: unknown[]): Promise<QueryOutcome>
  /** Запрос серверного кода с service role — без пользователя. */
  asService(sql: string, params?: unknown[]): Promise<QueryOutcome>
  /** Подготовка данных в обход RLS. */
  sys(sql: string, params?: unknown[]): Promise<QueryOutcome>
  close(): Promise<void>
}

async function run(
  pg: PGlite,
  setup: string[],
  sql: string,
  params: unknown[],
  claims?: string,
): Promise<QueryOutcome> {
  try {
    return await pg.transaction(async tx => {
      if (claims) await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims])
      for (const s of setup) await tx.exec(s)
      const r = await tx.query<Record<string, unknown>>(sql, params)
      return { rows: r.rows, count: Math.max(r.rows.length, r.affectedRows ?? 0) }
    })
  } catch (e) {
    return {
      rows: [],
      count: 0,
      error: e instanceof Error ? e.message : String(e),
      code: (e as { code?: string }).code,
    }
  }
}

/**
 * База с медицинскими таблицами в состоянии «до» и, если передать
 * migrations, — после этих миграций. Накатываются настоящие 023, 036, 048,
 * 052, 078, 085, 105.
 *
 * Связи как в qa/ralph/seed.sql, плюс второй пациент врача A:
 * врач A ↔ спортсмены A1 и A3, врач B ↔ спортсмен B (doctor_athlete);
 * тренер A ↔ спортсмен A1 (coach_athlete → trainer_athletes через 085).
 */
export async function createMedicalDb(migrations: string[] = []): Promise<Db> {
  const pg = new PGlite()
  await pg.exec(PLATFORM_STUB)
  for (const m of [
    '023_medical_checkups.sql',
    '036_medical_diary.sql',
    '048_medical_diary_coach_visibility.sql',
    '052_recommendations.sql',
    '078_fix_recommendations_preserve_content_org_id_typo.sql',
  ]) await pg.exec(migration(m))
  await pg.exec(PRESERVE_TRIGGER)
  await pg.exec(migration('085_sync_trainer_athletes_from_connections.sql'))
  await pg.exec(migration('105_p0_signup_role_and_medical_scope.sql'))
  await pg.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;')

  for (const [key, u] of Object.entries(USERS)) {
    await pg.query('INSERT INTO users (id, auth_id, role, email) VALUES ($1, $2, $3, $4)',
      [u.id, authIdOf(key as UserKey), u.role, `${key}@qa.test`])
  }
  await pg.query(
    `INSERT INTO connections (initiator_id, recipient_id, connection_type, status) VALUES
       ($1, $2, 'doctor_athlete', 'active'),
       ($1, $3, 'doctor_athlete', 'active'),
       ($4, $5, 'doctor_athlete', 'active'),
       ($6, $2, 'coach_athlete',  'active')`,
    [USERS.doctorA.id, USERS.athleteA1.id, USERS.athleteA3.id,
     USERS.doctorB.id, USERS.athleteB.id, USERS.coachA.id],
  )

  for (const m of migrations) await pg.exec(migration(m))

  return {
    as: (user, sql, params = []) => run(pg, ['SET LOCAL ROLE authenticated'], sql, params,
      JSON.stringify({ sub: authIdOf(user), role: 'authenticated' })),
    asUnknownUser: (sql, params = []) => run(pg, ['SET LOCAL ROLE authenticated'], sql, params,
      JSON.stringify({ sub: 'ffffffff-ffff-ffff-ffff-ffffffffffff', role: 'authenticated' })),
    asService: (sql, params = []) => run(pg, ['SET LOCAL ROLE service_role'], sql, params),
    sys: (sql, params = []) => run(pg, [], sql, params),
    close: () => pg.close(),
  }
}
