'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMyReferralStats, type ReferralStats } from '@/services/referrals.service'
import { EmailInviteDialog } from '@/components/ui/EmailInviteDialog'
import { Card } from '@/components/ui/metronic'

/**
 * Панель «Приглашай и получай Pro» для дашборда тренера.
 * За каждого принявшего invite — +1 месяц Pro-подписки (автоматически
 * через RPC grant_referral_credit в /api/invite/[token]).
 */
export default function ReferralPanel({
  myRole,
}: {
  myRole: 'coach' | 'doctor' | 'organization' | 'admin'
}) {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [open, setOpen]   = useState(false)

  const load = useCallback(async () => {
    setStats(await getMyReferralStats())
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-2xl border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-white to-[#FEF2F2] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FED7AA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#EA580C]">
            🎁 Реферальная программа
          </span>
          <h3 className="pf-num text-xl font-bold text-foreground mt-2">
            Приглашай атлетов — получай Pro бесплатно
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            За каждого принявшего приглашение — <strong className="text-orange-600">+1 месяц Pro</strong>.
            Лимитов нет, кредиты накапливаются автоматически.
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
          <i className="ki-filled ki-sms text-xs mr-1"/>
          Пригласить по email
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Получено месяцев Pro</div>
          <div className="pf-num text-2xl mt-1 text-orange-600">{stats?.total_months ?? 0}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Приняли приглашение</div>
          <div className="pf-num text-2xl mt-1 text-green-600">{stats?.claimed_count ?? 0}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ожидают ответа</div>
          <div className="pf-num text-2xl mt-1 text-slate-600">{stats?.pending_count ?? 0}</div>
        </Card>
      </div>

      {stats && stats.credits.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Последние начисления
          </p>
          <div className="space-y-1">
            {stats.credits.slice(0, 5).map(c => (
              <div key={c.id}
                className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">
                  {new Date(c.applied_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
                <span className="font-semibold text-green-700">+{c.months_granted} мес Pro</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <EmailInviteDialog
          myRole={myRole}
          onClose={() => setOpen(false)}
          onSent={() => { load() }}
        />
      )}
    </div>
  )
}
