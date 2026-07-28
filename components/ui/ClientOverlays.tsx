'use client'

import dynamic from 'next/dynamic'

// W20 Day 1 — Next 15 forbids `ssr: false` в next/dynamic из Server Components.
// Root layout (app/layout.tsx) — Server Component, поэтому client-only overlays
// перенесены сюда, в Client Component boundary.
//
// FloatingAssistant — плавающий ролевой AI-помощник (Gemma). Сам решает,
// существовать ли ему: на публичных страницах и без сессии компонент
// возвращает null (не CSS-скрытие), роль/тариф проверяет сервер.
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), { ssr: false })
const FloatingAssistant = dynamic(() => import('@/components/assistant/FloatingAssistant'), { ssr: false })

export default function ClientOverlays() {
  return (
    <>
      <CommandPalette />
      <FloatingAssistant />
    </>
  )
}
