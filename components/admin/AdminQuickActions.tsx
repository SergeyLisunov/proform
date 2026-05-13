'use client'

import Link from 'next/link'

interface QuickAction {
  href: string
  external?: boolean
  icon: string
  label: string
  hint: string
  bg: string
  color: string
  border: string
}

const ACTIONS: QuickAction[] = [
  {
    href: '/admin/crm',
    icon: 'ki-people',
    label: 'CRM',
    hint: 'Пользователи и связи',
    bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF',
  },
  {
    href: '/admin/orgs',
    icon: 'ki-office-bag',
    label: 'Организации',
    hint: 'Команды и клубы',
    bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
  },
  {
    href: '/admin/commerce',
    icon: 'ki-credit-cart',
    label: 'Биллинг',
    hint: 'Подписки и ЮKassa',
    bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0',
  },
  {
    href: '/admin/ab-tests',
    icon: 'ki-chart-pie-simple',
    label: 'A/B тесты',
    hint: 'Drip-конверсия по вариантам',
    bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE',
  },
  {
    href: '/admin/onboarding-funnel',
    icon: 'ki-rocket',
    label: 'Funnel',
    hint: 'Wizard dropoff per persona',
    bg: '#FFF7ED', color: '#F97316', border: '#FED7AA',
  },
  {
    href: 'https://supabase.com/dashboard/project/hhyjihbctidtucvpgjzv',
    external: true,
    icon: 'ki-data',
    label: 'Supabase',
    hint: 'Логи и таблицы',
    bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA',
  },
  {
    href: 'https://vercel.com/sergeylisunovs-projects/proform',
    external: true,
    icon: 'ki-rocket',
    label: 'Vercel',
    hint: 'Деплои и runtime',
    bg: '#F8FAFC', color: '#0F172A', border: '#CBD5E1',
  },
]

export default function AdminQuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {ACTIONS.map(a => {
        const inner = (
          <>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: a.bg, color: a.color }}>
              <i className={`ki-filled ${a.icon} text-lg`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                {a.label}
                {a.external && <i className="ki-filled ki-exit-right-corner text-[9px] text-muted-foreground" />}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{a.hint}</div>
            </div>
          </>
        )
        const cn = 'group rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm flex items-center gap-3'
        return a.external ? (
          <a key={a.label} href={a.href} target="_blank" rel="noreferrer noopener" className={cn} style={{ borderColor: a.border }}>
            {inner}
          </a>
        ) : (
          <Link key={a.label} href={a.href} className={cn} style={{ borderColor: a.border }}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
