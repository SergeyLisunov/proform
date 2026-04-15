'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'recording' | 'processing' | 'success' | 'error'

interface UseVoiceRecorderOptions {
  silenceThresholdMs?: number   // ms of silence before auto-stop (default 2500)
  maxDurationMs?: number        // max recording ms (default 120000)
  onTranscript?: (text: string) => void
  onError?: (msg: string) => void
}

interface UseVoiceRecorderReturn {
  state: RecorderState
  errorMessage: string | null
  start: () => Promise<void>
  stop: () => void
  isSupported: boolean
}

// RMS amplitude check — returns 0..1
function getRms(analyser: AnalyserNode, buffer: Float32Array): number {
  analyser.getFloatTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

export function useVoiceRecorder({
  silenceThresholdMs = 2500,
  maxDurationMs = 120_000,
  onTranscript,
  onError,
}: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => null)
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    analyserRef.current = null
  }, [])

  const sendForTranscription = useCallback(async (blob: Blob) => {
    if (!mountedRef.current) return
    setState('processing')

    try {
      const form = new FormData()
      form.append('audio', blob, 'recording.webm')

      const res = await fetch('/api/notes/transcribe', {
        method: 'POST',
        body: form,
      })

      const json = await res.json() as { transcript?: string; error?: string }

      if (!mountedRef.current) return

      if (!res.ok || json.error) {
        throw new Error(json.error ?? `Server error ${res.status}`)
      }

      if (!json.transcript) {
        throw new Error('Речь не распознана')
      }

      setState('success')
      onTranscript?.(json.transcript)
      setTimeout(() => {
        if (mountedRef.current) setState('idle')
      }, 1500)
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Ошибка распознавания'
      setErrorMessage(msg)
      setState('error')
      onError?.(msg)
      setTimeout(() => {
        if (mountedRef.current) {
          setState('idle')
          setErrorMessage(null)
        }
      }, 3000)
    }
  }, [onTranscript, onError])

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    mr.stop()
    cleanup()
  }, [cleanup])

  const startSilenceDetection = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const bufferLength = analyser.fftSize
    const buffer = new Float32Array(bufferLength)
    const SILENCE_RMS = 0.01

    const tick = () => {
      if (!analyserRef.current) return
      const rms = getRms(analyser, buffer)

      if (rms < SILENCE_RMS) {
        if (silenceTimerRef.current === null) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording()
          }, silenceThresholdMs)
        }
      } else {
        if (silenceTimerRef.current !== null) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [silenceThresholdMs, stopRecording])

  const start = useCallback(async () => {
    if (state !== 'idle') return

    setErrorMessage(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Доступ к микрофону запрещён'
        : 'Не удалось получить доступ к микрофону'
      setErrorMessage(msg)
      setState('error')
      onError?.(msg)
      setTimeout(() => {
        if (mountedRef.current) {
          setState('idle')
          setErrorMessage(null)
        }
      }, 3000)
      return
    }

    streamRef.current = stream

    // AudioContext for silence detection
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    analyserRef.current = analyser

    // Choose best supported MIME
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ].find(m => MediaRecorder.isTypeSupported(m)) ?? ''

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = mr
    chunksRef.current = []

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mr.onstop = () => {
      const chunks = chunksRef.current
      if (!chunks.length) return
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      sendForTranscription(blob)
    }

    mr.start(250) // collect every 250ms
    setState('recording')
    startSilenceDetection()

    // Hard limit
    maxTimerRef.current = setTimeout(() => {
      stopRecording()
    }, maxDurationMs)
  }, [state, onError, startSilenceDetection, stopRecording, sendForTranscription, maxDurationMs])

  const stop = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    typeof MediaRecorder !== 'undefined'

  return { state, errorMessage, start, stop, isSupported }
}
