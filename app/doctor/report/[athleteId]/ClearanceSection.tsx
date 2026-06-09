'use client'

/**
 * <ClearanceSection /> — doctor UI для выставления и просмотра «светофора
 * допуска» атлета. Размещается в /doctor/report/[athleteId].
 *
 * Показывает:
 *   - текущий статус (из current_clearances view) + кто и когда выставил;
 *   - флаг "требуется review" если valid_until истёк (≠ full);
 *   - историю последних 5 изменений;
 *   - форму "Выставить/обновить".
 *
 * Изменение → POST /api/doctor/clearance → append-only row. RLS (миграция 092)
 * гарантирует, что доктор не свяжется с непривязанным атлетом.
 */
import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Status = 'full' | 'limited' | 'light_only' | 'banned'

interface ClearanceRow {
  id:          string
  status:      Status
  note:        string | null
  doctor_id:   string
  valid_from:  string
  valid_until: string | null
  created_at:  string
}

interface Current extends ClearanceRow {
  review_needed: boolean
}

interface Props {
  athleteId: string
}

const STATUS_META: Record<Status, { label: string; dot: string; color: string; bg: string; border: string; hint: string }> = {
  full:       { label: 'Полный',      dot: '#16A34A', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', hint: 'Без ограничений' },
  limited:    { label: 'Ограниченный', dot: '#CA8A04', color: '#A16207', bg: '#FEFCE8', border: '#FDE68A', hint: '~60% нормы' },
  light_only: { label: 'Лёгкий',      dot: '#F35703', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', hint: 'Только реаб / лёгкая зона' },
  banned:     { label: 'Запрет',      dot: '#DC2626', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', hint: 'Тренировка запрещена' },
}
const STATUS_ORDER: Status[] = ['full', 'limited', 'light_only', 'banned']

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayPlusDaysISO(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function ClearanceSection({ athleteId }: Props) {
  const [current, setCurrent] = useState<Current | null>(null)
  const [history, setHistory] = useState<ClearanceRow[]>([])
  const [loading, setLoading] = useState(true)

  const [status, setStatus]         = useState<Status>('full')
  const [note, setNote]             = useState('')
  const [validUntil, setValidUntil] = useState(todayPlusDaysISO(30))
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb() as any
    const [{ data: currRow }, { data: histRows }] = await Promise.all([
      sbAny.from('current_clearances').select('*').eq('athlete_id', athleteId).maybeSingle(),
      sbAny.from('clearances').select('id, status, note, doctor_id, valid_from, valid_until, created_at')
        .eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(5),
    ])
    setCurrent((currRow as Current | null) ?? null)
    setHistory(((histRows ?? []) as ClearanceRow[]))
    setLoading(false)
  }, [athleteId])

  useEffect(() => { void load() }, [load])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/doctor/clearance', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          athlete_id: athleteId,
          status,
          note:        note.trim() || undefined,
          // For 'full' we don't send valid_until (NULL = no expiry by default).
          valid_until: status === 'full' ? undefined : new Date(validUntil + 'T00:00:00').toISOString(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'failed')
      // Reset form to current state + reload list
      setNote('')
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed'
      setError(
        msg === 'not_connected'
          ? 'Вы не привязаны к этому атлету. Создайте активную связку doctor↔athlete сначала.'
          : msg === 'forbidden'
            ? 'Только доктор может выставлять допуск.'
            : `Не удалось сохранить: ${msg}`,
      )
    } finally {
      setSaving(false)
    }
  }

  const meta = current ? STATUS_META[current.status] : null
  const reviewBadge = current?.review_needed
    ? <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 700 }}>требуется review</span>
    : null

  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700">Допуск к нагрузке</p>
          <h2 className="mt-1 text-lg font-semibold text-navy-500">Светофор</h2>
        </div>
        {loading ? (
          <span className="text-2xs text-muted-foreground">Загрузка…</span>
        ) : current && meta ? (
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.dot }} />
            <span>{meta.label}</span>
            {reviewBadge}
          </div>
        ) : (
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-2xs font-semibold text-muted-foreground">Не выставлен</span>
        )}
      </div>

      {!loading && current && (
        <div className="mt-3 text-2xs text-muted-foreground">
          {current.note && <p className="leading-relaxed">{current.note}</p>}
          <p className="mt-1">
            Выставлен {fmtDateTime(current.created_at)}
            {current.valid_until && ` · действует до ${fmtDateTime(current.valid_until)}`}
          </p>
        </div>
      )}

      <hr className="my-5 border-border" />

      {/* Form */}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Выставить новый допуск
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUS_ORDER.map((s) => {
            const m   = STATUS_META[s]
            const sel = status === s
            return (
              <button key={s} type="button" onClick={() => setStatus(s)} title={m.hint}
                className="flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition"
                style={{ background: sel ? m.bg : 'var(--card)', borderColor: sel ? m.border : 'var(--border)' }}>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: sel ? m.color : 'var(--foreground)' }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.dot }} />
                  {m.label}
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">{m.hint}</span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Действует до
            </label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              disabled={status === 'full'}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 disabled:opacity-50" />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {status === 'full' ? 'Для full срок не задаётся (бессрочно)' : 'По умолчанию +30 дней'}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Заметка тренеру (опц.)
            </label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Без прыжков, без HIIT"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Видна тренеру. <strong>Без диагноза</strong> — только функциональные ограничения.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-2xs text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="mt-1 inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? 'Сохраняем…' : 'Выставить'}
        </button>
      </form>

      {/* History */}
      {!loading && history.length > 0 && (
        <>
          <hr className="my-5 border-border" />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            История (последние {history.length})
          </p>
          <ul className="space-y-1.5">
            {history.map((h) => {
              const m = STATUS_META[h.status]
              return (
                <li key={h.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5 text-2xs">
                  <span className="inline-flex items-center gap-1.5" style={{ color: m.color, fontWeight: 700 }}><span className="inline-block h-2 w-2 rounded-full" style={{ background: m.dot }} />{m.label}</span>
                  <span className="text-muted-foreground">{fmtDateTime(h.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
