'use client'

/**
 * useDialog — promise-based замена нативным window.confirm / window.alert.
 *
 * Рендерит единую Metronic-стилизованную <Modal> (components/ui/Modal.tsx)
 * вместо браузерного диалога. Provider монтируется один раз в корне
 * (app/layout.tsx).
 *
 * API:
 *   const { confirm, alert } = useDialog()
 *   if (!(await confirm('Удалить запись?'))) return     // строка-шорткат
 *   await confirm({ title: 'Отменить подписку?', description: '...', tone: 'warning' })
 *   await alert({ title: 'Готово', description: 'Сохранено', tone: 'success' })
 *
 * tone выводится автоматически из текста (удалить/навсегда/необратимо →
 * danger), если не задан явно. Promise резолвится true при подтверждении,
 * false при отмене/закрытии (для confirm); void для alert.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal, type ModalTone } from '@/components/ui/Modal'

interface ConfirmOptions {
  title:        string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?:        ModalTone
  icon?:        string | null
}

interface AlertOptions {
  title:        string
  description?: ReactNode
  okLabel?:     string
  tone?:        ModalTone
  icon?:        string | null
}

export interface DialogApi {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>
  alert:   (opts: AlertOptions | string) => Promise<void>
}

type DialogState =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert';   opts: AlertOptions;   resolve: () => void }
  | null

const DialogContext = createContext<DialogApi | null>(null)

/** Эвристика tone по тексту заголовка — красный для деструктивных действий. */
function inferTone(title: string): ModalTone {
  return /удал|навсегда|необратим|нельзя отменить|архивир|отключить|снять|скрыть/i.test(title)
    ? 'danger'
    : 'default'
}

const TONE_BTN: Record<ModalTone, string> = {
  default: 'bg-orange-500 hover:bg-orange-600 text-white',
  info:    'bg-sky-500 hover:bg-sky-600 text-white',
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) => {
        const normalized: ConfirmOptions = typeof opts === 'string' ? { title: opts } : opts
        setState({ kind: 'confirm', opts: normalized, resolve })
      }),
    [],
  )

  const alert = useCallback(
    (opts: AlertOptions | string) =>
      new Promise<void>((resolve) => {
        const normalized: AlertOptions = typeof opts === 'string' ? { title: opts } : opts
        setState({ kind: 'alert', opts: normalized, resolve })
      }),
    [],
  )

  // resolve() на settled Promise — no-op, поэтому повторный вызов безопасен.
  const cancel = useCallback(() => {
    setState((s) => {
      if (s?.kind === 'confirm') s.resolve(false)
      else if (s?.kind === 'alert') s.resolve()
      return null
    })
  }, [])

  const accept = useCallback(() => {
    setState((s) => {
      if (s?.kind === 'confirm') s.resolve(true)
      else if (s?.kind === 'alert') s.resolve()
      return null
    })
  }, [])

  const tone: ModalTone =
    state?.opts.tone ?? (state ? inferTone(state.opts.title) : 'default')

  const footer = state && (
    <>
      {state.kind === 'confirm' && (
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {state.opts.cancelLabel ?? 'Отмена'}
        </button>
      )}
      <button
        type="button"
        onClick={accept}
        autoFocus
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${TONE_BTN[tone]}`}
      >
        {state.kind === 'confirm'
          ? (state.opts.confirmLabel ?? 'Подтвердить')
          : ((state.opts as AlertOptions).okLabel ?? 'OK')}
      </button>
    </>
  )

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <Modal
        open={state !== null}
        onClose={cancel}
        title={state?.opts.title ?? ''}
        description={state?.opts.description}
        tone={tone}
        icon={state?.opts.icon}
        footer={footer}
      />
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useDialog must be used within <DialogProvider>')
  }
  return ctx
}
