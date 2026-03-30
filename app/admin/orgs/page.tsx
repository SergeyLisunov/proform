'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { getAllOrgs, verifyOrg } from '@/services/org.service'
import type { Organization } from '@/types/org.types'

const SPORT_LABELS: Record<string, string> = {
  athletics: 'Лёгкая атлетика', swimming: 'Плавание', cycling: 'Велоспорт',
  triathlon: 'Триатлон', football: 'Футбол', basketball: 'Баскетбол',
  tennis: 'Теннис', volleyball: 'Волейбол', wrestling: 'Борьба', other: 'Другое',
}

export default function AdminOrgsPage() {
  const { user, loading: userLoading } = useUser()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'admin') { setLoading(false); return }
    async function load() {
      const data = await getAllOrgs()
      setOrgs(data)
      setLoading(false)
    }
    load()
  }, [user, userLoading])

  async function handleVerify(orgId: string) {
    setVerifying(orgId)
    await verifyOrg(orgId)
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, is_verified: true } : o))
    setVerifying(null)
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <i className="ki-filled ki-shield-cross text-2xl text-red-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Требуются права администратора</p>
        <p className="text-2sm text-muted-foreground">У вас нет доступа к этому разделу.</p>
      </div>
    )
  }

  const unverified = orgs.filter(o => !o.is_verified)
  const verified = orgs.filter(o => o.is_verified)

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Администратор · Организации</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Организации</h2>
        </div>
        <div className="flex gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <div className="pf-num text-2xl text-foreground">{orgs.length}</div>
            <div className="text-2xs text-muted-foreground">Всего</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-center">
            <div className="pf-num text-2xl text-orange-600">{unverified.length}</div>
            <div className="text-2xs text-orange-500">Ожидают</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-center">
            <div className="pf-num text-2xl text-green-600">{verified.length}</div>
            <div className="text-2xs text-green-500">Проверено</div>
          </div>
        </div>
      </div>

      {/* Pending verification */}
      {unverified.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Ожидают проверки</span>
            <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-2xs font-bold">{unverified.length}</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {unverified.map(org => (
                <OrgRow
                  key={org.id}
                  org={org}
                  verifying={verifying === org.id}
                  onVerify={() => handleVerify(org.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verified */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Проверенные организации</span>
          <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-2xs font-bold">{verified.length}</span>
        </div>
        {verified.length === 0 ? (
          <div className="bg-card border border-border rounded-xl px-5 py-8 text-center text-muted-foreground text-2sm">
            Проверенных организаций пока нет
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {verified.map(org => (
                <OrgRow key={org.id} org={org} verifying={false} onVerify={() => {}} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OrgRow({ org, verifying, onVerify }: { org: Organization; verifying: boolean; onVerify: () => void }) {
  const initials = org.org_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 text-sm font-bold pf-num text-orange-600">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">{org.org_name}</span>
          {org.is_verified && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
              <i className="ki-filled ki-verify text-xs" />
              Проверено
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xs text-muted-foreground font-mono">/{org.org_slug}</span>
          {org.sport_type && (
            <span className="text-2xs text-muted-foreground">{SPORT_LABELS[org.sport_type] ?? org.sport_type}</span>
          )}
          {org.city && (
            <span className="text-2xs text-muted-foreground">{org.city}</span>
          )}
        </div>
      </div>
      <div className="text-2xs text-muted-foreground shrink-0 hidden md:block">
        {new Date(org.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {!org.is_verified ? (
        <button
          onClick={onVerify}
          disabled={verifying}
          className="kt-btn kt-btn-sm kt-btn-primary gap-1.5 shrink-0"
        >
          {verifying ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full pf-spin" />
              Проверка…
            </>
          ) : (
            <>
              <i className="ki-filled ki-verify text-xs" />
              Верифицировать
            </>
          )}
        </button>
      ) : (
        <span className="text-2xs text-green-600 font-semibold shrink-0">✓ Проверено</span>
      )}
    </div>
  )
}
