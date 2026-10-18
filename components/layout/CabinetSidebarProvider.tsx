'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { SidebarProvider } from '@/components/reui/sidebar'
import { getServerSnapshot, getSnapshot, setOpen, subscribe } from '@/lib/hooks/sidebarOpenStore'

/**
 * SidebarProvider в управляемом режиме: развёрнутость берётся из хранилища
 * вне React (lib/hooks/sidebarOpenStore), поэтому свёрнутая панель остаётся
 * свёрнутой при переходе в другой раздел, когда AppShell перемонтируется.
 */
export function CabinetSidebarProvider({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      {children}
    </SidebarProvider>
  )
}
