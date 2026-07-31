/**
 * /api/admin/users/role — смена роли пользователя администратором платформы.
 *
 * Появился в ходе ролевого QA (Ralph-итерация 2). Раньше страница /admin
 * писала `users.role` напрямую из браузера клиентским клиентом Supabase:
 *   - действие нигде не фиксировалось (требование «любое изменение в CRM
 *     логируется» не выполнялось);
 *   - запись привилегированного поля из браузера — тот же путь, которым
 *     обычный пользователь повышал себе роль до admin (P0, миграция 104).
 *
 * Теперь единственный канал смены роли — этот маршрут:
 *   1) проверяет роль вызывающего НА СЕРВЕРЕ (не доверяя фронтенду);
 *   2) валидирует целевую роль по белому списку;
 *   3) запрещает администратору снимать роль с самого себя (защита от
 *      случайной потери последнего доступа);
 *   4) пишет запись в audit_logs с прежним и новым значением.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['athlete', 'coach', 'doctor', 'specialist', 'organization', 'admin'])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if ((me as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }
  const actorId = (me as { id: string }).id

  const body = await req.json().catch(() => ({})) as { userId?: string; role?: string }
  const userId = (body.userId ?? '').trim()
  const nextRole = (body.role ?? '').trim()

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.has(nextRole)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }
  if (userId === actorId) {
    return NextResponse.json({ error: 'self_role_change_forbidden' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('users')
    .select('id, role, email')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'target_not_found' }, { status: 404 })

  const prevRole = (target as { role: string }).role
  if (prevRole === nextRole) {
    return NextResponse.json({ ok: true, role: nextRole, unchanged: true })
  }

  const { error: updErr } = await admin
    .from('users')
    .update({ role: nextRole })
    .eq('id', userId)
  if (updErr) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // Аудит — обязателен: смена роли меняет объём доступа к данным.
  //
  // action — enum public.audit_action, а не свободный текст. Здесь стояло
  // 'admin.user.role_changed', которого в enum нет: Postgres отвечал 22P02,
  // результат insert никто не проверял, и маршрут возвращал 200 с пустым
  // журналом. Пишем валидное значение, детализацию — в payload.
  const { error: auditErr } = await admin.from('audit_logs').insert({
    actor_id: actorId,
    action: 'role_change',
    target_table: 'users',
    target_id: userId,
    payload: {
      kind: 'admin.user.role_changed',
      from: prevRole,
      to: nextRole,
      email: (target as { email: string }).email,
    },
  })

  // Роль уже изменена, откатывать её из-за журнала неверно — клиент получил
  // бы «не сработало» при фактически применённом изменении. Поэтому провал
  // аудита не отменяет операцию, но и не остаётся невидимым: пишем в лог
  // сервера и честно отдаём audited в ответе.
  if (auditErr) {
    console.error('[admin.users.role] запись в audit_logs не удалась:', auditErr.message)
  }

  return NextResponse.json({
    ok: true,
    role: nextRole,
    previousRole: prevRole,
    audited: !auditErr,
  })
}
