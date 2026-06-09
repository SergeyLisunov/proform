'use client'
import { createContext, useContext, useState, useCallback, ReactNode, useId } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastItem = { id: string; type: ToastType; message: string }

type ToastContextValue = {
  toast: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
})

const ICONS: Record<ToastType, string> = {
  success: 'ki-check-circle',
  error:   'ki-information-4',
  warning: 'ki-information',
  info:    'ki-information-2',
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', text: '#15803D' },
  error:   { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', text: '#B91C1C' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', text: '#B45309' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', text: '#1D4ED8' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { id, type, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const success = useCallback((m: string) => toast('success', m), [toast])
  const error   = useCallback((m: string) => toast('error', m),   [toast])
  const warning = useCallback((m: string) => toast('warning', m), [toast])
  const info    = useCallback((m: string) => toast('info', m),    [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: 8,
            maxWidth: 360, width: '100%',
          }}
        >
          {toasts.map(t => {
            const c = COLORS[t.type]
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 14px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  animation: 'slideInRight 0.25s ease',
                }}
              >
                <i className={`ki-filled ${ICONS[t.type]} text-base mt-0.5 shrink-0`} style={{ color: c.icon }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: c.text, flex: 1, lineHeight: 1.5 }}>
                  {t.message}
                </span>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: c.icon, opacity: 0.6, lineHeight: 1 }}
                >
                  <i className="ki-filled ki-cross text-xs" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
