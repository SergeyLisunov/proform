import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SharedWorkout = {
  workout_id: string
  athlete_id: string
  athlete_name: string
  athlete_avatar: string | null
  athlete_sport: string | null
  event_date: string
  name: string | null
  description: string | null
  activity_type: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  recovery_score: number | null
  hrv: number | null
  mood: number | null
  expires_at: string | null
}

const MOOD_LABELS = ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично']

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

async function fetchShared(token: string): Promise<SharedWorkout | null> {
  const sb = anonClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc('get_shared_workout', { p_token: token })
  if (error || !data || !Array.isArray(data) || data.length === 0) return null
  return data[0] as SharedWorkout
}

function Stat({ label, value, hint }: { label: string; value: string | number | null; hint?: string }) {
  if (value == null || value === '' ) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-tight text-slate-900">{value}</div>
      {hint && <div className="text-2xs text-slate-500">{hint}</div>}
    </div>
  )
}

export default async function SharedWorkoutPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await fetchShared(token)

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <i className="ki-filled ki-lock-2 text-[22px]" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Ссылка недействительна</h1>
          <p className="mt-2 text-sm text-slate-600">
            Возможно, ссылка отозвана автором или срок её действия истёк.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            На главную
          </Link>
        </div>
      </div>
    )
  }

  const eventDateStr = new Date(data.event_date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
              <i className="ki-filled ki-abstract-26 text-[13px]" />
            </span>
            Sporteo
          </Link>
          <div className="text-2xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Публичная ссылка
          </div>
        </div>

        {/* Athlete card */}
        <div className="mb-5 flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500">
            {data.athlete_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.athlete_avatar} alt="" className="h-14 w-14 object-cover" />
            ) : (
              <i className="ki-filled ki-user text-[20px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold text-slate-900">{data.athlete_name}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {data.athlete_sport && <span>{data.athlete_sport}</span>}
              {data.athlete_sport && <span className="h-1 w-1 rounded-full bg-slate-300" />}
              <span>{eventDateStr}</span>
            </div>
          </div>
        </div>

        {/* Workout card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Тренировка</div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-900">
                {data.name || data.activity_type || 'Тренировка'}
              </h1>
              {data.activity_type && data.name && (
                <div className="mt-1 text-sm text-slate-500">{data.activity_type}</div>
              )}
            </div>
            {data.activity_duration_min != null && (
              <div className="shrink-0 rounded-2xl bg-orange-500 px-4 py-3 text-right text-white">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Длительность</div>
                <div className="text-xl font-bold leading-none">{data.activity_duration_min} мин</div>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Strain"    value={data.activity_strain != null ? data.activity_strain.toFixed(1) : null} />
            <Stat label="ЧСС ср."   value={data.avg_heart_rate  != null ? Math.round(Number(data.avg_heart_rate)) : null} hint="уд/мин" />
            <Stat label="ЧСС макс." value={data.max_heart_rate  != null ? Math.round(Number(data.max_heart_rate)) : null} hint="уд/мин" />
            <Stat label="Recovery"  value={data.recovery_score  != null ? `${Math.round(Number(data.recovery_score))}%` : null} />
            <Stat label="HRV"       value={data.hrv != null ? Math.round(Number(data.hrv)) : null} hint="мс" />
            <Stat
              label="Настроение"
              value={data.mood != null ? (MOOD_LABELS[data.mood] ?? String(data.mood)) : null}
            />
          </div>

          {data.description && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Заметки</div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {data.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-slate-500">
            {data.expires_at
              ? `Ссылка действительна до ${new Date(data.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Ссылка без срока действия'}
          </p>
          <Link
            href="/auth/register"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Создать свой дневник
            <i className="ki-filled ki-arrow-right text-[12px]" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Тренировка · Sporteo',
  description: 'Публичная ссылка на тренировку',
  robots: { index: false, follow: false },
}
