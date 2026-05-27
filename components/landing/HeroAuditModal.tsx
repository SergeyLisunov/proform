/**
 * <HeroAuditModal /> — W16 Day 79 NEW.
 *
 * Client component что renders BOTH:
 *   1. Trigger button (passable className, label)
 *   2. Modal overlay с <LeadCaptureForm /> внутри
 *
 * Server components могут импортировать — Next.js handles boundary.
 *
 * Modal mechanics:
 *   - Open on button click, emit `landing.audit_modal_open`
 *   - Close on ESC, backdrop click, or X button
 *   - Body scroll lock пока open
 *   - Native <dialog> elem с reactив state (showModal()/close())
 *   - Auto-close через 3 sec после successful submit
 *
 * A11y: <dialog> handles focus trap natively. aria-labelledby points to
 * modal title.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'

// W17 Day 85 — perf: lazy-load LeadCaptureForm (280 LOC + zod-aligned
// validation + 9 fields) only when modal first opens. Visitor scrolls
// past Hero without clicking → form bundle never downloaded.
// `loading: () => null` — silent placeholder; form mount perceived as
// instant since user just clicked + dialog animation covers small lag.
const LeadCaptureForm = dynamic(() => import('./LeadCaptureForm'), {
  ssr:     false,
  loading: () => null,
})

interface HeroAuditModalProps {
  /** Trigger button label. */
  buttonLabel:      string
  /** Trigger button CSS classes. */
  buttonClassName?: string
  /** Optional hint text rendered below button. */
  hint?:            string
}

export default function HeroAuditModal({
  buttonLabel,
  buttonClassName,
  hint,
}: HeroAuditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  // W17 Day 85 — once modal opens, keep form mounted even after close.
  // Preserves user input если they reopen after accidentally closing.
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false)

  function openModal() {
    trackEvent({ name: 'landing.audit_modal_open' })
    setOpen(true)
    setHasOpenedOnce(true)
    dialogRef.current?.showModal()
    document.body.style.overflow = 'hidden'
  }

  function closeModal() {
    setOpen(false)
    dialogRef.current?.close()
    document.body.style.overflow = ''
  }

  // Cleanup body scroll lock if component unmounts while open
  useEffect(() => {
    return () => {
      if (open) document.body.style.overflow = ''
    }
  }, [open])

  // ESC and backdrop click handled natively by <dialog>; listen for close event
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => {
      setOpen(false)
      document.body.style.overflow = ''
    }
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [])

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    // Click outside content area (i.e. on the dialog backdrop)
    if (e.target === dialogRef.current) {
      closeModal()
    }
  }

  function handleSuccess() {
    // Auto-close after 3 sec on success
    setTimeout(closeModal, 3000)
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={openModal}
          className={buttonClassName}
        >
          {buttonLabel}
        </button>
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        aria-labelledby="audit-modal-title"
        className="w-full max-w-2xl rounded-3xl border border-border bg-white p-0 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
      >
        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-white px-6 py-4 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
              Бесплатный аудит
            </p>
            <h2
              id="audit-modal-title"
              className="text-lg font-bold leading-tight text-foreground sm:text-xl"
            >
              Health-score клуба + top-3 риска + план на 30 дней
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Закрыть"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-muted-foreground transition-colors hover:bg-slate-200 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — form (lazy-mounted on first open) */}
        <div className="p-6 sm:p-8">
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            Заполните 6 полей — пришлём персональный аудит на email.
            Без обязательств, без банковской карты.
          </p>
          {hasOpenedOnce && <LeadCaptureForm onSuccess={handleSuccess} />}
        </div>
      </dialog>
    </>
  )
}
