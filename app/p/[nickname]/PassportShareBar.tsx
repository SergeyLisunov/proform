'use client'

import { useState } from 'react'

export default function PassportShareBar({
  url, displayName,
}: {
  url: string
  displayName: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await (navigator as any).share({ title: `${displayName} · Sporteo`, url }) } catch {}
    } else {
      copy()
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 -mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
          <span className="hidden sm:inline">🔗</span>
          <code className="font-mono text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded truncate max-w-[320px]">
            {url}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copy}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
          <button onClick={nativeShare}
            className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-xs font-semibold">
            Поделиться →
          </button>
        </div>
      </div>
    </div>
  )
}
