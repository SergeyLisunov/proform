'use client'

/**
 * Modal — единая Metronic-стилизованная модалка (центрированный диалог).
 *
 * Образец: keenthemes Metronic docs base/modal — центрированный card с
 * header (иконка + заголовок + close-X), body, footer с кнопками справа.
 * Используется как презентационная основа для useDialog() (confirm/alert),
 * и доступна для любых кастомных модалок.
 *
 * Поведение: portal в document.body, backdrop с blur, Escape и клик по
 * фону закрывают (если closeOnBackdrop), плавный enter/exit transition,
 * блокировка скролла body пока открыта.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ModalTone = 'default' | 'info' | 'danger' | 'warning' | 'success'

const TONE_CFG: Record<ModalTone, { icon: string; color: string; bg: string }> = {
  default: { icon: 'ki-information-2', color: '#F35703', bg: '#FEF0E7' },
  info:    { icon: 'ki-information-2', color: '#0EA5E9', bg: '#F0F9FF' },
  danger:  { icon: 'ki-trash',         color: '#DC2626', bg: '#FEF2F2' },
  warning: { icon: 'ki-information-4',  color: '#B45309', bg: '#FFFBEB' },
  success: { icon: 'ki-check-circle',   color: '#16A34A', bg: '#F0FDF4' },
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  tone?: ModalTone
  /** Имя keenicon без префикса (напр. 'ki-trash'). null — без иконки. undefined — иконка по tone. */
  icon?: string | null
  closeOnBackdrop?: boolean
  /** Контент между заголовком и футером (формы и т.п.). */
  children?: ReactNode
  /** Кнопки футера (обычно справа). */
  footer?: ReactNode
  maxWidth?: number
}

export function Modal({
  open, onClose, title, description,
  tone = 'default', icon, closeOnBackdrop = true,
  children, footer, maxWidth = 460,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  const cfg = TONE_CFG[tone]
  const showIcon = icon !== null
  const iconClass = icon ?? cfg.icon

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        style={{ maxWidth }}
        className={`relative w-full rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pb-4 pt-6">
          {showIcon && (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <i className={`ki-filled ${iconClass} text-lg`} />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {description && (
              <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {children && <div className="px-6 pb-2">{children}</div>}

        {footer && (
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
