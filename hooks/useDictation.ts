'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser voice dictation via the native Web Speech API.
 * Works offline in Chrome / Edge / Safari (partial), no backend call.
 * Falls back to `supported === false` if the browser doesn't expose it.
 */

type State = 'idle' | 'listening' | 'error'

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function useDictation({ lang = 'ru-RU' }: { lang?: string } = {}) {
  const [state, setState] = useState<State>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef<((text: string) => void) | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    (((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition))

  const start = useCallback((onFinal: (text: string) => void) => {
    if (!supported) { setError('Голосовой ввод не поддерживается браузером'); setState('error'); return }
    try {
      onFinalRef.current = onFinal
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const rec: SpeechRecognitionLike = new Ctor()
      rec.continuous     = true
      rec.interimResults = true
      rec.lang           = lang
      rec.onresult = (e: any) => {
        let finalText = ''
        let interimText = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) finalText += res[0].transcript
          else             interimText += res[0].transcript
        }
        if (finalText) {
          onFinalRef.current?.(finalText.trim())
          setInterim('')
        } else {
          setInterim(interimText)
        }
      }
      rec.onerror = (e: any) => {
        setError(e.error ?? 'Ошибка распознавания')
        setState('error')
      }
      rec.onend = () => {
        setState('idle')
        setInterim('')
      }
      rec.start()
      recRef.current = rec
      setError(null)
      setState('listening')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить диктовку')
      setState('error')
    }
  }, [supported, lang])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setState('idle')
  }, [])

  useEffect(() => () => { recRef.current?.stop() }, [])

  return { state, interim, error, supported: !!supported, start, stop }
}
