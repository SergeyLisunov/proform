'use client'

import dynamic from 'next/dynamic'

// W20 Day 1 — Next 15 forbids `ssr: false` в next/dynamic из Server Components.
// Root layout (app/layout.tsx) — Server Component, поэтому client-only overlays
// (CommandPalette + AiChatBubble) перенесены сюда, в Client Component boundary.
// Поведение идентично: оба lazy-loaded, client-only.
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), { ssr: false })
const AiChatBubble = dynamic(() => import('@/components/ui/AiChatBubble'), { ssr: false })

export default function ClientOverlays() {
  return (
    <>
      <CommandPalette />
      <AiChatBubble />
    </>
  )
}
