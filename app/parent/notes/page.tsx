/**
 * /parent/notes — кросс-детский фид заметок тренера (sidebar этап 8b).
 *
 * Dashboard показывает по 3 свежих заметки на ребёнка в карточке. При
 * двух+ детях это снова не feed, а карточки — родитель не видит, какая
 * заметка действительно «свежая» относительно всех детей.
 *
 * Эта страница — единый chronological feed: последние 50 записей по
 * observation_diary всех детей, новые сверху. risk_level / category
 * рендерятся как цветные чипы. RLS-policy
 * `observation_diary_parent_select` (migration 089) уже разрешает доступ.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/metronic'

interface ChildLink {
  child_id: string
}

interface ChildUser {
  id:   string
  name: string | null
}

interface Note {
  id:         string
  child_id:   string
  child_name: string
  date:       string
  title:      string | null
  note:       string | null
  category:   string | null
  risk_level: string | null
}

const RISK_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: 'Высокий риск',   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  medium: { label: 'Средний риск',   color: '#B45309', bg: '#FFFBEB', border: '#FEF3C7' },
  low:    { label: 'Низкий риск',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

const CATEGORY_CFG: Record<string, { color: string; bg: string; border: string }> = {
  technique:   { color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  attitude:    { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  competition: { color: '#F35703', bg: '#FEF0E7', border: '#FBC1A0' },
  recovery:    { color: '#0F766E', bg: '#ECFDF5', border: '#A7F3D0' },
  health:      { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

const CATEGORY_LABEL: Record<string, string> = {
  technique:   'Техника',
  attitude:    'Настрой',
  competition: 'Соревнования',
  recovery:    'Восстановление',
  health:      'Здоровье',
}

function fmtDateLabel(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (dt.getTime() === today.getTime())     return 'Сегодня'
  if (dt.getTime() === yesterday.getTime()) return 'Вчера'
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: dt.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function truncate(s: string | null, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export default async function ParentNotesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: meRow } = await supabase
    .from('users').select('id, name').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) redirect('/auth/login')
  const meId = (meRow as { id: string }).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linksRaw } = await (supabase as any)
    .from('parent_links')
    .select('child_id')
    .eq('parent_id', meId)
    .eq('status', 'active')
  const childIds = ((linksRaw ?? []) as ChildLink[]).map(l => l.child_id)

  if (childIds.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Card className="rounded-[28px] p-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">Здесь будут заметки тренера</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Подключите ребёнка на странице{' '}
            <Link href="/parent/dashboard" className="font-semibold text-orange-700 underline">«Дети»</Link>{' '}
            — тогда здесь появятся комментарии тренера по всем вашим детям.
          </p>
        </Card>
      </div>
    )
  }

  const { data: childrenRaw } = await supabase
    .from('users').select('id, name').in('id', childIds)
  const childMap = new Map<string, string>(
    ((childrenRaw ?? []) as ChildUser[]).map(c => [c.id, c.name ?? 'Без имени'])
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: notesRaw } = await sb
    .from('observation_diary')
    .select('id, athlete_id, date, title, note, category, risk_level')
    .in('athlete_id', childIds)
    .order('date',       { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const notes: Note[] = ((notesRaw ?? []) as Array<{
    id: string; athlete_id: string; date: string;
    title: string | null; note: string | null;
    category: string | null; risk_level: string | null;
  }>).map(n => ({
    id:         n.id,
    child_id:   n.athlete_id,
    child_name: childMap.get(n.athlete_id) ?? '—',
    date:       n.date,
    title:      n.title,
    note:       n.note,
    category:   n.category,
    risk_level: n.risk_level,
  }))

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <header className="rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_50%,#FFF4EC_100%)] p-7 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Кабинет родителя</p>
        <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-navy-500">
          Заметки тренера
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Последние 50 записей по {childMap.size === 1 ? 'ребёнку' : `${childMap.size} детям`} в хронологическом порядке.
          Подробный профиль ребёнка — на странице{' '}
          <Link href="/parent/dashboard" className="font-semibold text-orange-700 underline">«Дети»</Link>.
        </p>
      </header>

      {notes.length === 0 ? (
        <Card className="rounded-[28px] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-400 shadow-sm">
            <i className="ki-filled ki-notepad-edit text-3xl" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Заметок ещё нет</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Тренер пока не оставил ни одного комментария. Они появятся здесь сразу,
            как только начнёт работать с детьми.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map(n => {
            const riskCfg = n.risk_level ? RISK_CFG[n.risk_level] : null
            const catCfg  = n.category   ? CATEGORY_CFG[n.category]   : null
            const catLbl  = n.category   ? (CATEGORY_LABEL[n.category] ?? n.category) : null
            return (
              <Card key={n.id} className="rounded-[20px] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-500">
                      {n.title?.trim() ? n.title : 'Заметка тренера'}
                    </h3>
                    {catCfg && (
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: catCfg.bg, color: catCfg.color, border: `1px solid ${catCfg.border}` }}>
                        {catLbl}
                      </span>
                    )}
                    {riskCfg && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: riskCfg.bg, color: riskCfg.color, border: `1px solid ${riskCfg.border}` }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: riskCfg.color }} />
                        {riskCfg.label}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{fmtDateLabel(n.date)}</span>
                </div>
                {n.note && (
                  <p className="mt-2 text-sm leading-6 text-foreground/85">
                    {truncate(n.note, 280)}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <i className="ki-filled ki-user text-[10px]" />
                  Про {n.child_name}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
