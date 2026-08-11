import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/gemma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Бюджет функции на Vercel. Обёртка Gemma (lib/ai/gemma.ts) держит общий
// дедлайн вызова 45 с и при провале валидации делает одну ремонтную попытку —
// это рассчитано на maxDuration=60. Без явного значения платформа даёт свой
// умолчательный лимит, он МЕНЬШЕ, и функция умирает раньше собственного
// дедлайна: watchdog внутри клиента не успевает отработать, а пользователь
// получает обрыв вместо понятной ошибки.
export const maxDuration = 60


/**
 * GET /api/diary/weekly-summary?days=7
 *
 * Для тренера: агрегирует все записи дневника за последние N дней (по
 * умолчанию 7), группирует по атлетам и просит Gemma сформировать
 * короткий отчёт по каждому. Возвращает JSON, который клиент рисует.
 */

const AthleteSummarySchema = z.object({
  athlete_id:    z.string().uuid(),
  athlete_name:  z.string(),
  summary:       z.string().max(400).describe('2–3 предложения про динамику недели'),
  highlights:    z.array(z.string().max(140)).max(3),
  concerns:      z.array(z.string().max(140)).max(3),
  focus_next:    z.string().max(200),
  entries_count: z.number().int().min(0),
})

const WeekSummarySchema = z.object({
  overview:   z.string().max(320).describe('Общий обзор группы за неделю'),
  athletes:   z.array(AthleteSummarySchema),
  team_focus: z.string().max(200).describe('Главный фокус для группы на следующую неделю'),
})

export async function GET(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }
  const url = new URL(req.url)
  const days = Math.min(30, Math.max(3, Number(url.searchParams.get('days') ?? 7)))

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const meRow = me as { id: string; role: string } | null
  if (!meRow) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  if (meRow.role !== 'coach') {
    return NextResponse.json({ ok: false, error: 'COACH_ONLY' }, { status: 403 })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: entriesRaw } = await sb
    .from('observation_diary')
    .select('id, athlete_id, date, entry_type, title, note, risk_level, category, mood, energy_level, tags')
    .eq('coach_id', meRow.id)
    .gte('date', sinceStr)
    .order('date', { ascending: false })
    .limit(500)
  const entries = (entriesRaw ?? []) as Array<{
    id: string; athlete_id: string | null; date: string; entry_type: string
    title: string | null; note: string; risk_level: string | null
    category: string | null; mood: number | null; energy_level: number | null; tags: string[] | null
  }>

  if (entries.length === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        overview:   'За указанный период нет записей в дневнике.',
        athletes:   [],
        team_focus: 'Начните фиксировать наблюдения — хотя бы по 2–3 ключевым атлетам в день.',
      },
    })
  }

  // Pull athlete names in one hop.
  const athleteIds = [...new Set(entries.map(e => e.athlete_id).filter(Boolean) as string[])]
  const { data: usersRaw } = athleteIds.length
    ? await sb.from('users').select('id, name').in('id', athleteIds)
    : { data: [] }
  const nameById = new Map(((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
    .map(u => [u.id, u.name ?? '—']))

  // Build compact payload for the model (avoid sending huge notes).
  const byAthlete: Record<string, any[]> = {}
  for (const e of entries) {
    const key = e.athlete_id ?? '_no_athlete'
    ;(byAthlete[key] ??= []).push({
      date: e.date,
      type: e.entry_type,
      title: e.title ?? undefined,
      note: e.note.slice(0, 400),
      risk: e.risk_level ?? undefined,
      category: e.category ?? undefined,
      mood: e.mood ?? undefined,
      energy: e.energy_level ?? undefined,
      tags: e.tags ?? undefined,
    })
  }
  const modelInput = Object.entries(byAthlete).map(([aid, items]) => ({
    athlete_id:   aid === '_no_athlete' ? null : aid,
    athlete_name: aid === '_no_athlete' ? 'Без атлета' : (nameById.get(aid) ?? '—'),
    entries:      items,
  }))

  try {
    const summary = await aiObject({
      schema: WeekSummarySchema,
      system: [
        'Ты ассистент спортивного тренера. Пиши коротко, по делу, на русском.',
        'Никогда не фантазируй данные, которых нет во входе. Если мало информации — прямо так и пиши.',
        'Возвращай JSON по схеме.',
      ].join(' '),
      prompt: [
        `Отчёт по дневнику за последние ${days} дней (${sinceStr} — сегодня).`,
        `Всего записей: ${entries.length}. Атлетов: ${modelInput.length}.`,
        '',
        'ДАННЫЕ ПО АТЛЕТАМ (JSON):',
        JSON.stringify(modelInput).slice(0, 12000),
        '',
        'Задача:',
        '1. В overview — 2–3 предложения про общую неделю группы.',
        '2. По каждому атлету (athletes[]): summary, highlights (победы), concerns (риски), focus_next — следующий акцент.',
        '3. team_focus — главный общий вывод и акцент на следующую неделю.',
      ].join('\n'),
      maxTokens: 2400,
    })

    // Make sure entries_count is populated from our own data (не доверяем модели).
    const withCounts = {
      ...summary,
      athletes: summary.athletes.map(a => ({
        ...a,
        entries_count: byAthlete[a.athlete_id]?.length ?? 0,
      })),
    }
    return NextResponse.json({ ok: true, data: withCounts })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
