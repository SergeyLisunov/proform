'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/lib/hooks/useToast'

type Issue = { frame: number; title: string; description: string; severity: 'low' | 'medium' | 'high' }
type Feedback = {
  summary: string
  overall_score: number
  strengths: string[]
  issues: Issue[]
  recommendations: string[]
}

type Analysis = {
  id: string
  title: string
  sport: string | null
  exercise: string | null
  status: 'pending' | 'analyzing' | 'done' | 'error'
  ai_summary: string | null
  ai_feedback: Feedback | Record<string, unknown> | null
  video_public_url: string | null
  frames_count: number
  created_at: string
}

const FRAME_COUNT = 6
const MAX_VIDEO_MB = 50

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function sevTone(sev: Issue['severity']): string {
  if (sev === 'high')   return 'bg-rose-50 text-rose-700 border-rose-200'
  if (sev === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function scoreTone(s: number): string {
  if (s >= 7) return 'text-emerald-600'
  if (s >= 5) return 'text-amber-600'
  return 'text-rose-600'
}

async function extractFrames(file: File, count: number): Promise<{ frames: string[]; duration: number }> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.src = url

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('VIDEO_LOAD_TIMEOUT')), 15000)
      video.addEventListener('loadedmetadata', () => { clearTimeout(t); resolve() }, { once: true })
      video.addEventListener('error', () => { clearTimeout(t); reject(new Error('VIDEO_LOAD_ERROR')) }, { once: true })
    })

    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1
    const w = Math.min(640, video.videoWidth || 640)
    const scale = w / (video.videoWidth || w)
    const h = Math.max(1, Math.round((video.videoHeight || 360) * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('NO_CANVAS_CTX')

    const frames: string[] = []
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count
      await new Promise<void>((resolve, reject) => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); resolve() }
        const onErr  = () => { video.removeEventListener('error', onErr); reject(new Error('SEEK_ERROR')) }
        video.addEventListener('seeked', onSeek, { once: true })
        video.addEventListener('error', onErr, { once: true })
        video.currentTime = Math.min(Math.max(0, t), Math.max(0, duration - 0.05))
      })
      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      frames.push(dataUrl.split(',')[1] ?? '')
    }
    return { frames: frames.filter(Boolean), duration }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function FormAnalysisPage() {
  const { success, error } = useToast()
  const [items, setItems] = useState<Analysis[] | null>(null)
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState('')
  const [exercise, setExercise] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [selected, setSelected] = useState<Analysis | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/form-analysis')
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setItems(json.items as Analysis[])
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка загрузки')
    }
  }, [error])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const reset = () => {
    setFile(null); setTitle(''); setSport(''); setExercise('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = useCallback(async () => {
    if (!file) { error('Выберите видео'); return }
    if (!title.trim()) { error('Укажите название'); return }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { error(`Видео больше ${MAX_VIDEO_MB} МБ`); return }

    setBusy(true)
    setProgress('Извлечение кадров…')
    try {
      const { frames } = await extractFrames(file, FRAME_COUNT)
      if (!frames.length) throw new Error('Не удалось получить кадры')

      setProgress('Загрузка видео…')
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Не авторизован')
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${authUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('form-videos').upload(path, file, {
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
      })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('form-videos').getPublicUrl(path)

      setProgress('Анализ техники (Claude)…')
      const res = await fetch('/api/form-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          sport: sport.trim() || undefined,
          exercise: exercise.trim() || undefined,
          videoPath: path,
          videoPublicUrl: pub.publicUrl,
          frames,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      success('Разбор готов')
      setSelected(json.analysis as Analysis)
      reset()
      load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка анализа')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }, [file, title, sport, exercise, supabase, success, error, load])

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,0.14),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-600">
            AI разбор техники
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-foreground">
            Загрузите видео — Claude найдёт ошибки в технике
          </h1>
          <p className="max-w-[680px] text-sm text-muted-foreground">
            Короткое видео (до {MAX_VIDEO_MB} МБ), {FRAME_COUNT} ключевых кадров уходят в vision-модель.
            Вы получаете разбор: сильные стороны, проблемы по кадрам, рекомендации и оценку.
          </p>
        </div>
      </section>

      {/* Upload form */}
      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50">
            <i className="ki-filled ki-video text-base text-rose-500" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Новый разбор
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Название
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: приседания с грифом, 2-й подход"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Вид спорта
            </label>
            <input
              value={sport}
              onChange={e => setSport(e.target.value)}
              placeholder="Бег, тяжёлая атлетика, плавание…"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Упражнение
            </label>
            <input
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              placeholder="Присед, становая, рывок…"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Видео
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-rose-600 hover:file:bg-rose-100"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">MP4/MOV/WebM · До {MAX_VIDEO_MB} МБ</p>
          </div>
        </div>

        {preview && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 md:flex-row md:items-center">
            <video src={preview} controls className="w-full rounded-xl bg-black md:w-[320px]" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-foreground">{file?.name}</div>
              <div className="text-xs text-muted-foreground">{((file?.size ?? 0) / 1024 / 1024).toFixed(1)} МБ</div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{progress || 'Готово к загрузке'}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !file || !title.trim()}
              className="rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-50"
            >
              {busy ? 'Обработка…' : 'Проанализировать'}
            </button>
          </div>
        </div>
      </section>

      {/* Result (selected) */}
      {selected && selected.ai_feedback && typeof selected.ai_feedback === 'object' && 'summary' in selected.ai_feedback && (
        <ResultCard analysis={selected} onClose={() => setSelected(null)} />
      )}

      {/* History */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            История разборов · {items?.length ?? 0}
          </div>
          <button
            type="button"
            onClick={load}
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Обновить
          </button>
        </div>

        {items === null ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            Загрузка…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
            Пока нет ни одного разбора. Загрузите первое видео выше.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex w-full flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-rose-300 hover:shadow-md"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {a.status === 'done' ? 'Готов' : a.status === 'error' ? 'Ошибка' : 'В процессе'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(a.created_at)}</span>
                    {typeof (a.ai_feedback as Feedback)?.overall_score === 'number' && (
                      <span className={`ml-auto text-[13px] font-bold ${scoreTone((a.ai_feedback as Feedback).overall_score)}`}>
                        {(a.ai_feedback as Feedback).overall_score.toFixed(1)}/10
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{a.title}</div>
                  {(a.sport || a.exercise) && (
                    <div className="text-xs text-muted-foreground">
                      {[a.sport, a.exercise].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {a.ai_summary && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.ai_summary}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ResultCard({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  const fb = analysis.ai_feedback as Feedback
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <i className="ki-filled ki-check-circle text-[18px] text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Разбор · {fmtDate(analysis.created_at)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-lg font-bold text-foreground">{analysis.title}</div>
            <div className={`text-xl font-bold ${scoreTone(fb.overall_score)}`}>{fb.overall_score.toFixed(1)}/10</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold text-muted-foreground hover:bg-accent"
        >
          Закрыть
        </button>
      </div>

      {analysis.video_public_url && (
        <video src={analysis.video_public_url} controls className="mb-5 w-full max-w-[540px] rounded-xl bg-black" />
      )}

      <p className="mb-5 text-sm text-foreground/90">{fb.summary}</p>

      {fb.strengths?.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Сильные стороны</div>
          <ul className="space-y-1.5">
            {fb.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <i className="ki-filled ki-check mt-0.5 text-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fb.issues?.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-600">Проблемы по кадрам</div>
          <ul className="space-y-2">
            {fb.issues.map((it, i) => (
              <li key={i} className={`rounded-xl border px-3 py-2 text-sm ${sevTone(it.severity)}`}>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">Кадр {it.frame}</span>
                  <span className="font-semibold">{it.title}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider">{it.severity}</span>
                </div>
                <div className="mt-1 text-[13px] opacity-90">{it.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fb.recommendations?.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Рекомендации</div>
          <ul className="space-y-1.5">
            {fb.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <i className="ki-filled ki-arrow-right mt-0.5 text-indigo-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
