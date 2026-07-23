'use client'

import dynamic from 'next/dynamic'

// W20 Day 1 — Next 15 forbids `ssr: false` в next/dynamic из Server Components.
// Root layout (app/layout.tsx) — Server Component, поэтому client-only overlays
// перенесены сюда, в Client Component boundary.
//
// AI: глобального плавающего чат-виджета НЕТ (продуктовое решение ролевых
// ассистентов) — вход в AI только через раздел «AI-помощник» (/assistant)
// и точечные контекстные кнопки.
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), { ssr: false })

export default function ClientOverlays() {
  return <CommandPalette />
}
