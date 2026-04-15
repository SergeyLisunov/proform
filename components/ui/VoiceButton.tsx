'use client'

import { useCallback } from 'react'
import { useVoiceRecorder, type RecorderState } from '@/hooks/useVoiceRecorder'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  className?: string
  size?: 'sm' | 'md'
}

function MicIcon({ state }: { state: RecorderState }) {
  if (state === 'processing') {
    return (
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    )
  }
  if (state === 'success') {
    return <i className="ki-filled ki-check text-[14px]" />
  }
  if (state === 'error') {
    return <i className="ki-filled ki-cross text-[14px]" />
  }
  return <i className="ki-filled ki-microphone text-[14px]" />
}

function getButtonStyles(state: RecorderState, size: 'sm' | 'md'): string {
  const base = [
    'relative inline-flex items-center justify-center rounded-xl border transition-all duration-200 shrink-0 select-none',
    size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
  ].join(' ')

  switch (state) {
    case 'idle':
      return `${base} border-gray-200 bg-white text-gray-400 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 cursor-pointer`
    case 'recording':
      return `${base} border-red-300 bg-red-50 text-red-500 cursor-pointer`
    case 'processing':
      return `${base} border-orange-200 bg-orange-50 text-orange-400 cursor-not-allowed`
    case 'success':
      return `${base} border-green-300 bg-green-50 text-green-500 cursor-default`
    case 'error':
      return `${base} border-red-300 bg-red-50 text-red-500 cursor-pointer`
  }
}

function getTitle(state: RecorderState): string {
  switch (state) {
    case 'idle': return 'Голосовой ввод'
    case 'recording': return 'Запись… нажмите для остановки'
    case 'processing': return 'Распознавание…'
    case 'success': return 'Готово'
    case 'error': return 'Ошибка'
  }
}

export default function VoiceButton({ onTranscript, className = '', size = 'sm' }: VoiceButtonProps) {
  const { state, errorMessage, start, stop, isSupported } = useVoiceRecorder({
    onTranscript,
  })

  const handleClick = useCallback(() => {
    if (state === 'recording') {
      stop()
    } else if (state === 'idle' || state === 'error') {
      start()
    }
  }, [state, start, stop])

  if (!isSupported) return null

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'processing' || state === 'success'}
        title={getTitle(state)}
        aria-label={getTitle(state)}
        className={getButtonStyles(state, size)}
      >
        {/* Pulse ring when recording */}
        {state === 'recording' && (
          <>
            <span className="absolute inset-0 rounded-xl animate-ping bg-red-400 opacity-25" />
            <span className="absolute inset-0 rounded-xl animate-pulse bg-red-200 opacity-20" />
          </>
        )}
        <MicIcon state={state} />
      </button>

      {/* Error tooltip */}
      {state === 'error' && errorMessage && (
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] text-red-600 shadow-lg">
          {errorMessage}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white -mt-px" />
        </div>
      )}

      {/* Recording label */}
      {state === 'recording' && (
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] text-red-500 shadow-lg">
          Запись…
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white -mt-px" />
        </div>
      )}
    </div>
  )
}
