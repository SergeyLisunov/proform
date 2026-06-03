'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Alert } from '@/components/ui/metronic'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AthleteProfile = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  nickname: string | null
  sport: string | null
  sport_type: string | null
  city: string | null
  role: string | null
  avatar_url: string | null
}

type Workout = {
  event_date: string | null
  activity_type: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  recovery_score: number | null
  hrv: number | null
  mood: number | null
  coach_mark: string | null
  risk_flag: string | null
  name: string | null
}

type MedicalSummary = {
  overview: string
  key_findings: string[]
  risks: string[]
  recommendations: string[]
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function displayName(u: AthleteProfile | null): string {
  if (!u) return '—'
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || u.nickname || u.name || 'Пациент'
}
function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DoctorReportPage() {
  const params = useParams()
  const router = useRouter()
  const athleteId = String(params?.athleteId ?? '')

  const [from, setFrom] = useState(daysAgoISO(30))
  const [to, setTo]     = useState(todayISO())
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [summary, setSummary]   = useState<MedicalSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [doctorName, setDoctorName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkRole() {
      const { data: { user: authUser } } = await sb().auth.getUser()
      if (!authUser) { setAuthorized(false); return }
      const { data } = await sb().from('users').select('id, name, first_name, last_name, role').eq('auth_id', authUser.id).maybeSingle()
      const u = data as { role: string | null; name: string | null; first_name: string | null; last_name: string | null } | null
      const ok = u?.role === 'doctor' || u?.role === 'admin'
      setAuthorized(ok)
      const full = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim()
      setDoctorName(full || u?.name || 'Доктор')
    }
    checkRole()
  }, [])

  const loadData = useCallback(async () => {
    if (authorized !== true || !athleteId) return
    setLoading(true)
    setSummaryError(null)
    const [{ data: prof }, { data: ws }] = await Promise.all([
      sb().from('users')
        .select('id, name, first_name, last_name, nickname, sport, sport_type, city, role, avatar_url')
        .eq('id', athleteId).maybeSingle(),
      sb().from('workouts')
        .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood, coach_mark, risk_flag, name')
        .eq('athlete_id', athleteId)
        .gte('event_date', from)
        .lte('event_date', to)
        .order('event_date', { ascending: false }),
    ])
    setProfile(prof as AthleteProfile | null)
    setWorkouts((ws ?? []) as Workout[])

    // Fetch AI medical summary (optional; graceful degradation)
    try {
      const res = await fetch(`/api/ai/medical-summary?athlete_id=${athleteId}&from=${from}&to=${to}`, { cache: 'no-store' })
      if (res.status === 503) {
        setSummaryError('AI-резюме недоступно (ANTHROPIC_API_KEY не настроен)')
        setSummary(null)
      } else {
        const json = await res.json()
        if (json.ok) setSummary(json.data as MedicalSummary)
        else setSummaryError(json.error ?? 'AI_ERROR')
      }
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'AI_ERROR')
    }
    setLoading(false)
  }, [athleteId, from, to, authorized])

  useEffect(() => { loadData() }, [loadData])

  const stats = useMemo(() => {
    const total = workouts.length
    const totalMin = workouts.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
    const totalStrain = workouts.reduce((s, w) => s + (Number(w.activity_strain) || 0), 0)
    const hrVals = workouts.map(w => w.avg_heart_rate).filter((v): v is number => v != null && v > 0)
    const avgHr = hrVals.length ? hrVals.reduce((s, v) => s + v, 0) / hrVals.length : null
    const recVals = workouts.map(w => w.recovery_score).filter((v): v is number => v != null)
    const avgRec = recVals.length ? recVals.reduce((s, v) => s + v, 0) / recVals.length : null
    const hrvVals = workouts.map(w => w.hrv).filter((v): v is number => v != null)
    const avgHrv = hrvVals.length ? hrvVals.reduce((s, v) => s + v, 0) / hrvVals.length : null
    const risks = workouts.filter(w => w.coach_mark === 'risk' || w.risk_flag)
    return { total, totalMin, totalStrain, avgHr, avgRec, avgHrv, risks }
  }, [workouts])

  if (authorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <i className="ki-filled ki-shield-cross text-3xl text-red-500" />
          <h1 className="mt-3 text-lg font-bold text-foreground">Доступ ограничен</h1>
          <p className="mt-1 text-sm text-muted-foreground">Отчёт доступен только для роли doctor или admin.</p>
          <button onClick={() => router.back()} className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold">Назад</button>
        </div>
      </main>
    )
  }

  if (authorized === null) {
    return <main className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" /></main>
  }

  const patientLabel = displayName(profile)
  const patientSport = profile?.sport ?? profile?.sport_type ?? '—'

  return (
    <main className="min-h-screen bg-background py-6 print:bg-white print:py-0">
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          nav, header, .no-print, [data-kt-theme="true"] > aside, [data-kt-theme="true"] > header { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .report-root { box-shadow: none !important; border: none !important; }
          .page-break { break-before: page; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print mx-auto mb-4 flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent">
          <i className="ki-filled ki-arrow-left text-xs" /> Назад
        </button>
        <div className="flex items-center gap-2">
          <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">От</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-sm" />
          <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">До</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-sm" />
          <button onClick={() => loadData()} className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent">Обновить</button>
          <button onClick={() => window.print()} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-600">
            <i className="ki-filled ki-printer mr-1 text-xs" /> Печать / PDF
          </button>
        </div>
      </div>

      {/* Report body */}
      <article className="report-root mx-auto max-w-[900px] rounded-[20px] border border-border bg-card p-8 shadow-sm print:shadow-none">
        {/* Header */}
        <header className="border-b border-border pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                  <i className="ki-filled ki-heart text-red-600 text-sm" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-700">Sporteo · Медицинский отчёт</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold text-foreground">{patientLabel}</h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {patientSport}{profile?.city ? ` · ${profile.city}` : ''}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Период: <span className="font-semibold text-foreground">{fmtDate(from)} — {fmtDate(to)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xs uppercase tracking-widest text-muted-foreground">Дата отчёта</div>
              <div className="text-sm font-bold text-foreground">{fmtDate(todayISO())}</div>
              <div className="mt-2 text-2xs uppercase tracking-widest text-muted-foreground">Подготовил</div>
              <div className="text-sm font-bold text-foreground">{doctorName}</div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <section className="mt-5">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Сводка за период</h2>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                <StatCell label="Тренировок"    value={stats.total.toString()} />
                <StatCell label="Объём, мин"    value={stats.totalMin.toString()} />
                <StatCell label="Сум. strain"   value={stats.totalStrain.toFixed(1)} />
                <StatCell label="Ср. ЧСС"       value={stats.avgHr != null ? `${Math.round(stats.avgHr)}` : '—'} unit="уд/мин" />
                <StatCell label="Ср. recovery"  value={stats.avgRec != null ? `${Math.round(stats.avgRec)}%` : '—'} />
                <StatCell label="Ср. HRV"       value={stats.avgHrv != null ? `${Math.round(stats.avgHrv)}` : '—'} unit="мс" />
              </div>
            </section>

            {/* AI summary */}
            <section className="mt-6">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">AI-резюме</h2>
              {summaryError ? (
                <Alert variant="warning">{summaryError}</Alert>
              ) : summary ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-foreground">{summary.overview}</p>
                  {summary.key_findings.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ключевые находки</div>
                      <ul className="list-disc pl-5 space-y-0.5 text-sm text-foreground">
                        {summary.key_findings.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {summary.risks.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-red-700">Медицинские риски</div>
                      <ul className="list-disc pl-5 space-y-0.5 text-sm text-foreground">
                        {summary.risks.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {summary.recommendations.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Рекомендации</div>
                      <ul className="list-disc pl-5 space-y-0.5 text-sm text-foreground">
                        {summary.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">AI-резюме загружается…</p>
              )}
            </section>

            {/* Risks table */}
            {stats.risks.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-red-700">Отмеченные риски ({stats.risks.length})</h2>
                <div className="rounded-xl border border-red-200">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 text-2xs uppercase text-red-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Дата</th>
                        <th className="px-3 py-2 text-left">Активность</th>
                        <th className="px-3 py-2 text-left">Метка</th>
                        <th className="px-3 py-2 text-right">Strain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.risks.map((w, i) => (
                        <tr key={i} className="border-t border-red-100">
                          <td className="px-3 py-2">{fmtDate(w.event_date)}</td>
                          <td className="px-3 py-2">{w.activity_type ?? '—'}</td>
                          <td className="px-3 py-2">{w.coach_mark ?? w.risk_flag ?? '—'}</td>
                          <td className="px-3 py-2 text-right pf-num">{w.activity_strain != null ? Number(w.activity_strain).toFixed(1) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Workouts table */}
            <section className="mt-6">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                Тренировки в периоде ({workouts.length})
              </h2>
              {workouts.length === 0 ? (
                <Alert variant="info">Тренировки за указанный период отсутствуют.</Alert>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-accent/50 text-2xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Дата</th>
                        <th className="px-2 py-2 text-left">Тип</th>
                        <th className="px-2 py-2 text-right">Мин.</th>
                        <th className="px-2 py-2 text-right">ЧСС ср.</th>
                        <th className="px-2 py-2 text-right">ЧСС макс.</th>
                        <th className="px-2 py-2 text-right">Strain</th>
                        <th className="px-2 py-2 text-right">Recovery</th>
                        <th className="px-2 py-2 text-right">HRV</th>
                        <th className="px-2 py-2 text-center">Mood</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workouts.map((w, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5 font-semibold">{fmtDate(w.event_date)}</td>
                          <td className="px-2 py-1.5">{w.activity_type ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.activity_duration_min ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.avg_heart_rate ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.max_heart_rate ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.activity_strain != null ? Number(w.activity_strain).toFixed(1) : '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.recovery_score ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right pf-num">{w.hrv ?? '—'}</td>
                          <td className="px-2 py-1.5 text-center">{w.mood != null ? `${w.mood}/4` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Signature */}
            <section className="mt-8 border-t border-border pt-4">
              <div className="flex items-end justify-between gap-8">
                <div>
                  <div className="text-2xs uppercase tracking-widest text-muted-foreground">Подпись врача</div>
                  <div className="mt-6 border-b border-foreground/40 w-56" />
                  <div className="mt-1 text-xs text-foreground">{doctorName}</div>
                </div>
                <div className="text-right text-2xs text-muted-foreground max-w-[320px]">
                  Отчёт сгенерирован автоматически на основе данных платформы Sporteo. AI-резюме носит информационный характер и не заменяет клиническую оценку.
                </div>
              </div>
            </section>
          </>
        )}
      </article>
    </main>
  )
}

function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border bg-accent/30 p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="pf-num text-lg font-extrabold text-foreground">{value}</span>
        {unit && <span className="text-2xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}
