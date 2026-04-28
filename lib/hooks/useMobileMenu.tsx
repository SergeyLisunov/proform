'use client'

import {
  createContext, useContext, useState, useCallback, useEffect,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

interface MobileMenuCtx {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
  close: () => void
}

const Ctx = createContext<MobileMenuCtx | null>(null)

/**
 * MobileMenuProvider — single source of truth for the narrow-viewport
 * sidebar drawer. The previous implementation relied on Metronic's
 * `kt-drawer` JS (loaded via core.bundle.js after hydration) to wire up
 * `data-kt-drawer-toggle="#sidebar"` to `<div id="sidebar">`. That
 * vanilla JS does not survive React hydration cleanly — events on the
 * trigger fired before/after React re-rendered the DOM, leaving the
 * burger button non-functional on mobile.
 *
 * Replacing with a React context keeps state in the component tree:
 *   - TopBar's burger button calls `toggle()`
 *   - Sidebar applies a transform class based on `open`
 *   - Auto-closes on route change, ESC, viewport ≥lg, or backdrop click
 */
export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change — clicking a sidebar link should dismiss the
  // drawer so the user lands on the new page without a covering overlay.
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on ESC.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Close when the viewport becomes wide enough that the sidebar is
  // permanent again. Tailwind's `lg` breakpoint is 1024px.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    function onChange(e: MediaQueryListEvent) { if (e.matches) setOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Lock body scroll while drawer is open on mobile.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const toggle = useCallback(() => setOpen(v => !v), [])
  const close  = useCallback(() => setOpen(false), [])

  return (
    <Ctx.Provider value={{ open, setOpen, toggle, close }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMobileMenu(): MobileMenuCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Defensive default — components that mount outside the provider
    // (e.g. auth pages without sidebar) should still render without
    // throwing. Returns no-op handlers and a closed state.
    return {
      open: false,
      setOpen: () => {},
      toggle: () => {},
      close: () => {},
    }
  }
  return ctx
}
