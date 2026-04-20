'use client'
import { useEffect, useRef, useState } from 'react'

type Debrief = {
  mood: number
  rpe: number
  summary: string
  key_takeaways: string[]
  recommended_tag: 'good' | 'risk' | 'break' | 'none'
}

type Stage = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'done' | 'error'

export default function VoiceDebriefButton({
  workoutId, onApplied,
}: {
  workoutId: string
  onApplied?: () => void
}) {
  const [stage, setStage]   = useState<Stage>('idle')
  const [error, setError]   = useState<string | null>(null)
  const [result, setResult] = useState<Debrief | null>(null)
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null); setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { void handleStop() }
      mr.start()
      mediaRef.current = mr
      setStage('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MIC_ERROR')
      setStage('error')
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
  }

  async function handleStop() {
    setStage('transcribing')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fd = new FormData()
    fd.append('audio', blob, 'debrief.webm')
    try {
      const trRes = await fetch('/api/notes/transcribe', { method: 'POST', body: fd })
      const trJson = await trRes.json()
      if (!trRes.ok || !trJson.text) throw new Error(trJson.error ?? 'TRANSCRIBE_FAILED')

      setStage('analyzing')
      const dbRes = await fetch('/api/ai/workout-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_id: workoutId, transcript: trJson.text }),
      })
      const dbJson = await dbRes.json()
      if (!dbRes.ok || !dbJson.ok) {
        if (dbRes.status === 503) throw new Error('AI не настроен')
        throw new Error(dbJson.error ?? 'AI_ERROR')
      }
      setResult(dbJson.data as Debrief)
      setStage('done')
      onApplied?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ERROR')
      setStage('error')
    }
  }

  const busy = stage === 'transcribing' || stage === 'analyzing'

  return (
    <div className="rounded-2xl border border-border bg-accent/30 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={stage === 'recording' ? stopRecording : startRecording}
          disabled={busy}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
            stage === 'recording'
              ? 'bg-red-500 text-white animate-pulse'
              : busy
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
          title={stage === 'recording' ? 'Остановить запись' : 'Записать голосовой дебриф'}
        >
          <i className={`ki-filled ${stage === 'recording' ? 'ki-abstract-8' : 'ki-microphone-2'} text-sm`} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-foreground">
            {stage === 'idle'         && 'Голосовой дебриф'}
            {stage === 'recording'    && `Запись… ${formatSec(seconds)}`}
            {stage === 'transcribing' && 'Расшифровка…'}
            {stage === 'analyzing'    && 'Анализ AI…'}
            {stage === 'done'         && 'Дебриф сохранён'}
            {stage === 'error'        && 'Ошибка'}
          </div>
          <div className="text-2xs text-muted-foreground leading-snug">
            {stage === 'idle'    && 'Нажми и расскажи как прошла тренировка — заполню mood и заметки.'}
            {stage === 'recording' && 'Говори свободно. Нажми чтобы остановить.'}
            {busy && 'Клод извлекает структуру из твоих слов.'}
            {stage === 'done' && result && `mood ${result.mood}/4 · RPE ${result.rpe}/10`}
            {stage === 'error' && (error ?? 'Что-то пошло не так')}
          </div>
        </div>
      </div>

      {stage === 'done' && result && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-foreground">{result.summary}</p>
          {result.key_takeaways.length > 0 && (
            <ul className="space-y-1">
              {result.key_takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <i className="ki-filled ki-check-circle mt-[2px] text-[10px] text-emerald-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {result.recommended_tag !== 'none' && (
            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-amber-800">
              метка: {result.recommended_tag}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function formatSec(s: number) {
  const m = Math.floor(s / 60); const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}
