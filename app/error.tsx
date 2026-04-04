'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
        <i className="ki-filled ki-information-5 text-3xl text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Ошибка</p>
        <h1 className="pf-num text-4xl text-foreground mb-3">Что-то пошло не так</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </p>
        {error.digest && (
          <p className="text-2xs text-muted-foreground/50 mt-2 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={reset} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-arrows-circle text-sm" />
          Попробовать снова
        </button>
        <a href="/dashboard" className="kt-btn kt-btn-outline gap-2">
          <i className="ki-filled ki-home text-sm" />
          На главную
        </a>
      </div>
    </div>
  )
}
