'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'
import { getAllOrgs, verifyOrg } from '@/services/org.service'
import type { Organization } from '@/types/org.types'
import { Card, Badge } from '@/components/ui/metronic'

const SPORT_LABELS: Record<string, string> = {
  athletics: 'Лёгкая атлетика', swimming: 'Плавание', cycling: 'Велоспорт',
  triathlon: 'Триатлон', football: 'Футбол', basketball: 'Баскетбол',
  tennis: 'Теннис', volleyball: 'Волейбол', wrestling: 'Борьба', other: 'Другое',
}

export default function AdminOrgsPage() {
  const { user, loading: userLoading } = useUser()
  const { success, error: toastError } = useToast()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)

  // Флаг loading взводит инициатор перезагрузки (кнопка «Повторить»), а не
  // сам load: так в синхронной части эффекта не остаётся ни одного setState.
  const load = useCallback(async () => {
    // Сбой загрузки больше не маскируется под «организаций нет»: раньше
    // getAllOrgs при любой ошибке возвращала [], и экран показывал пустую
    // модерацию вместо причины.
    const { orgs: data, error } = await getAllOrgs()
    setOrgs(data)
    setLoadError(error)
    setLoading(false)
  }, [])

  function retry() {
    setLoadError(null)
    setLoading(true)
    load()
  }

  // Роль выведена в переменную: раньше эффект гасил спиннер вызовом
  // setLoading(false) прямо в своём теле — каскадный ререндер (правило
  // react-hooks/set-state-in-effect).
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (userLoading || !isAdmin) return
    load()
  }, [isAdmin, userLoading, load])

  async function handleVerify(orgId: string) {
    setVerifying(orgId)
    const { ok, error } = await verifyOrg(orgId)
    // Оптимистичный апдейт только после подтверждённой записи. Без RLS-политики
    // на organizations UPDATE не менял ни одной строки, но UI всё равно ставил
    // «Проверено» — расхождение с базой жило до перезагрузки страницы.
    if (ok) {
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, is_verified: true } : o))
      success('Организация верифицирована')
    } else {
      toastError(error ?? 'Не удалось верифицировать организацию')
    }
    setVerifying(null)
  }

  if (userLoading || (isAdmin && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!isAdmin) {
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

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <i className="ki-filled ki-information-4 text-2xl text-red-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Не удалось загрузить организации</p>
        <p className="text-2sm text-muted-foreground">{loadError}</p>
        <button onClick={retry} className="kt-btn kt-btn-sm kt-btn-primary">Повторить</button>
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
          <h2 className="pf-num text-[36px] text-navy-500 leading-none">Организации</h2>
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
          <Card className="overflow-hidden">
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
          </Card>
        </div>
      )}

      {/* Verified */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Проверенные организации</span>
          <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-2xs font-bold">{verified.length}</span>
        </div>
        {verified.length === 0 ? (
          <Card className="px-5 py-8 text-center text-muted-foreground text-2sm">
            Проверенных организаций пока нет
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {verified.map(org => (
                <OrgRow key={org.id} org={org} verifying={false} onVerify={() => {}} />
              ))}
            </div>
          </Card>
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
            <Badge variant="info" size="sm">
              <i className="ki-filled ki-verify text-xs" />
              Проверено
            </Badge>
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
        <span className="inline-flex items-center gap-1 text-2xs text-green-600 font-semibold shrink-0"><i className="ki-filled ki-check text-2xs" />Проверено</span>
      )}
    </div>
  )
}
