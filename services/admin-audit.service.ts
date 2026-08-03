/**
 * Журнал действий администратора — ревизия «выдуманные данные» (P1).
 *
 * Причина появления сервиса: вкладка «Журнал действий» на /admin рендерила
 * константу AUDIT из шести придуманных записей («Вход через веб-интерфейс»,
 * «Создана тренировка на 62 минуты»…). При этом таблица audit_logs существует
 * и полностью доступна администратору на чтение (политика audit_logs_select:
 * get_my_role() = 'admin'). Выдуманный журнал в разделе, который существует
 * ради доказуемости действий, — худший вид фейка: по нему нельзя ни
 * расследовать инцидент, ни заметить, что записи вообще не пишутся.
 */
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

/** Значения enum audit_action — БД отвергает всё остальное (ошибка 22P02). */
export type AuditAction = Database['public']['Enums']['audit_action']

export interface AuditLogEntry {
  id:           string
  action:       AuditAction
  target_table: string | null
  target_id:    string | null
  payload:      Record<string, unknown> | null
  created_at:   string | null
  actor_id:     string | null
  actor_name:   string | null
  actor_email:  string | null
}

/** Форма строки после embed'а автора по FK audit_logs_actor_id_fkey. */
interface AuditRow {
  id:           string
  action:       AuditAction
  target_table: string | null
  target_id:    string | null
  payload:      Record<string, unknown> | null
  created_at:   string | null
  actor_id:     string | null
  users:        { name: string | null; email: string | null } | null
}

/**
 * Последние записи журнала. Читать может только админ — это гарантирует RLS,
 * поэтому дополнительной проверки роли здесь нет: для не-админа запрос вернёт
 * пустой список, а не чужие данные.
 */
export async function listRecentAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('audit_logs')
    .select('id, action, target_table, target_id, payload, created_at, actor_id, users!audit_logs_actor_id_fkey(name, email)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[admin-audit.listRecentAuditLog]', error.message)
    return []
  }
  return ((data ?? []) as unknown as AuditRow[]).map(row => ({
    id:           row.id,
    action:       row.action,
    target_table: row.target_table,
    target_id:    row.target_id,
    payload:      row.payload,
    created_at:   row.created_at,
    actor_id:     row.actor_id,
    actor_name:   row.users?.name ?? null,
    actor_email:  row.users?.email ?? null,
  }))
}

/**
 * Русские ярлыки действий. Здесь, а не в компоненте, потому что журнал
 * читают уже два экрана (/admin и CRM-drawer), и словарь у них обязан быть
 * общим: разные переводы одного и того же action — это разные версии
 * правды об одном событии.
 *
 * Значения, которых нет в словаре, показываем сырыми — выдумывать перевод
 * для незнакомого action хуже, чем показать его как есть.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create:             'Создание',
  update:             'Обновление',
  delete:             'Удаление',
  login:              'Вход',
  logout:             'Выход',
  role_change:        'Смена роли',
  privacy_change:     'Приватность',
  assign_athlete:     'Назначение тренера',
  clearance_override: 'Обход допуска',
}

/**
 * Журнал по одному пользователю для CRM-карточки: и то, что он сделал сам
 * (actor_id), и то, что сделали с ним (target_table='users' + target_id).
 *
 * Почему audit_logs, а не user_events: таблица user_events в проекте только
 * читается — единственная ссылка на неё была здесь же, в CRM-drawer, ни одна
 * строка кода в неё не пишет, и в базе она пуста. Вкладка «События» из-за
 * этого гарантированно показывала «Нет событий» независимо от того, что
 * пользователь делал, — то есть врала про отсутствие активности. audit_logs,
 * напротив, реально наполняется (смена роли, обход допуска, назначения) и
 * полностью открыт админу политикой audit_logs_select.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listAuditLogForUser(userId: string, limit = 30): Promise<AuditLogEntry[]> {
  // userId склеивается в строку фильтра PostgREST (.or), а не уходит
  // параметром — запятая или скобка в значении изменила бы сам предикат.
  // Сейчас сюда приходит id из нашей же таблицы users, но полагаться на это
  // нельзя: проверяем форму до подстановки.
  if (!UUID_RE.test(userId)) {
    console.warn('[admin-audit.listAuditLogForUser] некорректный userId')
    return []
  }
  const sb = createClient()
  const { data, error } = await sb
    .from('audit_logs')
    .select('id, action, target_table, target_id, payload, created_at, actor_id, users!audit_logs_actor_id_fkey(name, email)')
    .or(`actor_id.eq.${userId},and(target_table.eq.users,target_id.eq.${userId})`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[admin-audit.listAuditLogForUser]', error.message)
    return []
  }
  return ((data ?? []) as unknown as AuditRow[]).map(row => ({
    id:           row.id,
    action:       row.action,
    target_table: row.target_table,
    target_id:    row.target_id,
    payload:      row.payload,
    created_at:   row.created_at,
    actor_id:     row.actor_id,
    actor_name:   row.users?.name ?? null,
    actor_email:  row.users?.email ?? null,
  }))
}

/**
 * Запись в журнал из браузера. Политика audit_logs_insert требует
 * actor_id = get_my_user_id(), поэтому actorId — обязательный аргумент
 * (users.id, а не auth.uid()).
 *
 * Ошибку намеренно возвращаем вызывающему, а не глотаем: «действие выполнено,
 * но не залогировано» — отдельное состояние, и пользователь должен его видеть.
 */
export async function writeAuditEntry(input: {
  actorId:     string
  action:      AuditAction
  targetTable: string
  targetId?:   string | null
  payload?:    Record<string, unknown> | null
}): Promise<{ ok: boolean; error: string | null }> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('audit_logs').insert({
    actor_id:     input.actorId,
    action:       input.action,
    target_table: input.targetTable,
    target_id:    input.targetId ?? null,
    payload:      input.payload ?? null,
  })
  if (error) {
    console.warn('[admin-audit.writeAuditEntry]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}
