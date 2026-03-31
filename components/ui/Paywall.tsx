'use client'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
export type Plan = 'free' | 'pro' | 'team'
export type PlanStatus = 'active' | 'trial' | 'cancelled' | 'expired'

export type Subscription = {
  plan: Plan
  status: PlanStatus
  expires_at: string | null
}

// ── Limits per plan ────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  free: {
    workouts_per_month: 10,
    can_use_messenger:  false,
    can_use_analytics:  false,
    can_export:         false,
    can_use_cycles:     false,
    max_athletes:       0,      // для тренера
  },
  pro: {
    workouts_per_month: Infinity,
    can_use_messenger:  true,
    can_use_analytics:  true,
    can_export:         true,
    can_use_cycles:     true,
    max_athletes:       0,
  },
  team: {
    workouts_per_month: Infinity,
    can_use_messenger:  true,
    can_use_analytics:  true,
    can_export:         true,
    can_use_cycles:     true,
    max_athletes:       20,
  },
} as const

// ── Plan config ────────────────────────────────────────────────────────────────
export const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Free',
    price: 0,
    period: '',
    description: 'Для начала',
    color: '#64748B',
    bg: '#F8FAFC',
    features: [
      '10 тренировок в месяц',
      'Календарь',
      'Базовый профиль',
    ],
    limitations: [
      'Без мессенджера',
      'Без аналитики',
      'Без экспорта',
    ],
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: 599,
    period: '/мес',
    description: 'Для серьёзных атлетов',
    color: '#F97316',
    bg: '#FFF7ED',
    popular: true,
    features: [
      'Безлимитные тренировки',
      'Полная аналитика',
      'Мессенджер с тренером',
      'Тренировочные циклы',
      'Экспорт данных',
    ],
    limitations: [],
  },
  {
    id: 'team' as Plan,
    name: 'Team',
    price: 1999,
    period: '/мес',
    description: 'Для тренеров и организаций',
    color: '#2563EB',
    bg: '#EFF6FF',
    features: [
      'Всё из Pro',
      'До 20 атлетов',
      'CRM атлетов',
      'Командная аналитика',
      'Приоритетная поддержка',
    ],
    limitations: [],
  },
]

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Hook: useSubscription ──────────────────────────────────────────────────────
export function useSubscription() {
  const { user } = useUser()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [workoutsThisMonth, setWorkoutsThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const sb = getSB()
    const [{ data: subData }, { count }] = await Promise.all([
      sb.from('subscriptions').select('plan, status, expires_at').eq('user_id', user.id).single(),
      sb.from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('athlete_id', user.id)
        .gte('event_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
    ])
    setSub(subData ?? { plan: 'free', status: 'active', expires_at: null })
    setWorkoutsThisMonth(count ?? 0)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const plan: Plan = sub?.plan ?? 'free'
  const limits = PLAN_LIMITS[plan]
  const canAddWorkout = workoutsThisMonth < limits.workouts_per_month
  const workoutsLeft = limits.workouts_per_month === Infinity
    ? null
    : Math.max(0, limits.workouts_per_month - workoutsThisMonth)

  return {
    sub, plan, limits, loading,
    workoutsThisMonth, workoutsLeft,
    canAddWorkout,
    isPro: plan === 'pro' || plan === 'team',
    isTeam: plan === 'team',
    isFree: plan === 'free',
    reload: load,
  }
}

// ── Pricing Modal ──────────────────────────────────────────────────────────────
export function PricingModal({
  onClose,
  trigger,
  highlightPlan = 'pro',
}: {
  onClose: () => void
  trigger?: string  // причина показа: 'workout_limit' | 'analytics' | 'messenger' | etc
  highlightPlan?: Plan
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  const TRIGGER_MESSAGES: Record<string, string> = {
    workout_limit: '🏋️ Вы достигли лимита тренировок в этом месяце',
    analytics:     '📊 Аналитика доступна только на Pro и выше',
    messenger:     '💬 Мессенджер доступен только на Pro и выше',
    cycles:        '🔄 Тренировочные циклы доступны на Pro',
    export:        '📥 Экспорт данных доступен на Pro',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)',
        transition: 'opacity 0.22s', opacity: visible ? 1 : 0,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          background: 'var(--card)', borderRadius: 28,
          border: '1px solid var(--border)',
          width: '100%', maxWidth: 740,
          boxShadow: '0 40px 100px rgba(0,0,0,0.25)',
          transition: 'transform 0.22s, opacity 0.22s',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '28px 32px 24px',
            background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, transparent 60%)',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
          }}>
            <button onClick={handleClose} style={{
              position: 'absolute', top: 20, right: 20,
              width: 34, height: 34, borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <i className="ki-filled ki-cross text-muted-foreground text-sm" />
            </button>
            {trigger && TRIGGER_MESSAGES[trigger] && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: '#FFF7ED', border: '1px solid #FED7AA',
                color: '#EA580C', fontSize: 12, fontWeight: 700,
                marginBottom: 12,
              }}>
                {TRIGGER_MESSAGES[trigger]}
              </div>
            )}
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em' }}>
              Выберите план
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>
              Разблокируйте полный потенциал ProForm
            </p>
          </div>

          {/* Plans */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '24px 32px 32px' }}>
            {PLANS.map(p => {
              const isHighlight = p.id === highlightPlan
              return (
                <div key={p.id} style={{
                  borderRadius: 20,
                  border: `2px solid ${isHighlight ? p.color : 'var(--border)'}`,
                  background: isHighlight ? p.bg : 'var(--card)',
                  padding: '20px 20px 24px',
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  transition: 'all 0.15s',
                }}>
                  {p.popular && (
                    <div style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                      color: 'white', fontSize: 10, fontWeight: 800,
                      padding: '4px 14px', borderRadius: 20,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                      boxShadow: `0 4px 12px ${p.color}50`,
                    }}>
                      Популярный
                    </div>
                  )}

                  {/* Plan name */}
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 16 }}>{p.description}</div>

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 20 }}>
                    <span className="pf-num" style={{ fontSize: 32, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {p.price === 0 ? 'Бесплатно' : p.price.toLocaleString('ru-RU') + '₽'}
                    </span>
                    {p.period && <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{p.period}</span>}
                  </div>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <i className="ki-filled ki-check text-[9px]" style={{ color: p.color }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                    {p.limitations.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <i className="ki-filled ki-cross text-[9px] text-muted-foreground" />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => {
                      // Здесь будет интеграция с платёжной системой
                      // Например: window.open('https://pay.proform.app/?plan=' + p.id)
                      alert(`Оплата плана ${p.name} — здесь будет подключена платёжная система (ЮКassa / Stripe)`)
                    }}
                    style={{
                      marginTop: 20, width: '100%', padding: '11px 16px',
                      borderRadius: 12, border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700,
                      background: p.id === 'free' ? 'var(--accent)' : `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                      color: p.id === 'free' ? 'var(--muted-foreground)' : 'white',
                      transition: 'all 0.15s',
                      boxShadow: p.id !== 'free' ? `0 4px 14px ${p.color}40` : 'none',
                    }}>
                    {p.id === 'free' ? 'Текущий план' : `Выбрать ${p.name}`}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '0 32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
              Безопасная оплата · Отмена в любой момент · Без скрытых платежей
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Paywall Banner (встраивается в страницы) ───────────────────────────────────
export function PaywallBanner({
  feature,
  title,
  description,
  requiredPlan = 'pro',
}: {
  feature: string
  title: string
  description: string
  requiredPlan?: Plan
}) {
  const [showPricing, setShowPricing] = useState(false)
  const plan = PLANS.find(p => p.id === requiredPlan)!

  return (
    <>
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        border: `1.5px solid ${plan.color}30`,
        background: `linear-gradient(135deg, ${plan.bg}, var(--card))`,
        padding: '28px 32px',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, flexShrink: 0,
          background: plan.color + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>
          🔒
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            {plan.name} план
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {title}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>{description}</p>
        </div>

        {/* CTA */}
        <button onClick={() => setShowPricing(true)}
          style={{
            padding: '12px 24px', borderRadius: 14, border: 'none',
            background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 14px ${plan.color}40`, flexShrink: 0,
            transition: 'all 0.15s',
          }}>
          Открыть доступ →
        </button>
      </div>

      {showPricing && (
        <PricingModal onClose={() => setShowPricing(false)} trigger={feature} highlightPlan={requiredPlan} />
      )}
    </>
  )
}

// ── Workout Limit Warning (показывается при подходе к лимиту) ─────────────────
export function WorkoutLimitBadge() {
  const { workoutsLeft, isFree } = useSubscription()
  const [showPricing, setShowPricing] = useState(false)

  if (!isFree || workoutsLeft === null) return null

  const isLow = workoutsLeft <= 3
  const isEmpty = workoutsLeft === 0

  if (!isLow) return null

  return (
    <>
      <div onClick={() => setShowPricing(true)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 12,
        background: isEmpty ? '#FEF2F2' : '#FFF7ED',
        border: `1px solid ${isEmpty ? '#FECACA' : '#FED7AA'}`,
        color: isEmpty ? '#DC2626' : '#EA580C',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.15s',
      }} className="hover:opacity-80">
        <i className="ki-filled ki-warning text-sm" />
        {isEmpty
          ? 'Лимит тренировок исчерпан — перейдите на Pro'
          : `Осталось тренировок: ${workoutsLeft} — перейдите на Pro`
        }
        <i className="ki-filled ki-arrow-right text-xs" />
      </div>

      {showPricing && (
        <PricingModal onClose={() => setShowPricing(false)} trigger="workout_limit" highlightPlan="pro" />
      )}
    </>
  )
}

// ── Subscription Badge (в топбаре или профиле) ────────────────────────────────
export function SubscriptionBadge() {
  const { plan, isFree } = useSubscription()
  const [showPricing, setShowPricing] = useState(false)
  const cfg = PLANS.find(p => p.id === plan)!

  return (
    <>
      <button onClick={() => setShowPricing(true)}
        style={{
          padding: '4px 10px', borderRadius: 8,
          background: cfg.bg, border: `1px solid ${cfg.color}30`,
          color: cfg.color, fontSize: 11, fontWeight: 800,
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
          transition: 'all 0.15s',
        }}>
        {cfg.name} {isFree && '↑'}
      </button>

      {showPricing && (
        <PricingModal onClose={() => setShowPricing(false)} highlightPlan="pro" />
      )}
    </>
  )
}

// ── Guard: блокирует доступ к странице если нет нужного плана ─────────────────
export function PlanGuard({
  requiredPlan,
  feature,
  title,
  description,
  children,
}: {
  requiredPlan: Plan
  feature: string
  title: string
  description: string
  children: React.ReactNode
}) {
  const { plan, loading } = useSubscription()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const planOrder = { free: 0, pro: 1, team: 2 }
  const hasAccess = planOrder[plan] >= planOrder[requiredPlan]

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PaywallBanner feature={feature} title={title} description={description} requiredPlan={requiredPlan} />
      </div>
    )
  }

  return <>{children}</>
}

// ── Pricing Page (отдельная страница /pricing) ────────────────────────────────
export function PricingPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, minHeight: '80vh', justifyContent: 'center' }} className="pf-enter">
      {/* Кнопка назад */}
      <div style={{ width: '100%', maxWidth: 860 }}>
        <a href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 12,
          border: '1px solid var(--border)', background: 'var(--card)',
          color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', transition: 'all 0.15s',
        }}>
          <i className="ki-filled ki-arrow-left text-sm" />
          На главную
        </a>
      </div>
      <div className="text-center">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Тарифы</p>
        <h1 className="pf-num text-[40px] text-foreground leading-none mb-3" style={{ letterSpacing: '-0.03em' }}>
          Простые и честные цены
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Начни бесплатно. Переходи на Pro когда будешь готов. Отмена в любой момент.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, width: '100%', maxWidth: 860 }}>
        {PLANS.map(p => {
          const isPopular = !!p.popular
          return (
            <div key={p.id} style={{
              borderRadius: 24,
              border: `2px solid ${isPopular ? p.color : 'var(--border)'}`,
              background: isPopular ? p.bg : 'var(--card)',
              padding: '28px 24px 28px',
              position: 'relative',
              display: 'flex', flexDirection: 'column',
            }}>
              {isPopular && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, ${p.color}, ${p.color}bb)`,
                  color: 'white', fontSize: 10, fontWeight: 800,
                  padding: '4px 16px', borderRadius: 20,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  boxShadow: `0 4px 12px ${p.color}50`,
                }}>⭐ Популярный</div>
              )}

              <div style={{ fontSize: 20, fontWeight: 900, color: p.color, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 20 }}>{p.description}</div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 24 }}>
                <span className="pf-num" style={{ fontSize: 38, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {p.price === 0 ? '0₽' : `${p.price.toLocaleString('ru-RU')}₽`}
                </span>
                {p.period && <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>{p.period}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 24 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: p.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <i className="ki-filled ki-check text-[10px]" style={{ color: p.color }} />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{f}</span>
                  </div>
                ))}
                {p.limitations.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <i className="ki-filled ki-cross text-[10px] text-muted-foreground" />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setSelectedPlan(p.id); setShowModal(true) }}
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 14,
                  border: isPopular ? 'none' : '1.5px solid var(--border)',
                  background: isPopular ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)` : 'transparent',
                  color: isPopular ? 'white' : 'var(--foreground)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: isPopular ? `0 4px 16px ${p.color}40` : 'none',
                  transition: 'all 0.15s',
                }}>
                {p.id === 'free' ? 'Начать бесплатно' : `Выбрать ${p.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {showModal && (
        <PricingModal onClose={() => setShowModal(false)} highlightPlan={selectedPlan} />
      )}
    </div>
  )
}
