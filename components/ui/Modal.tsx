'use client'

/**
 * Modal — центрированный диалог приложения.
 *
 * Публичный API не менялся: это по-прежнему `open/onClose/title/tone/...`,
 * и все 26 файлов, которые ходят сюда через useDialog(), остались как были.
 * Изменилась начинка — вместо самодельного портала внутри Base UI Dialog.
 *
 * ЗАЧЕМ. Прежняя реализация делала portal, backdrop, Escape и блокировку
 * скролла руками, но не удерживала фокус: Tab уводил на страницу под
 * открытой модалкой, а после закрытия фокус не возвращался на кнопку,
 * которая её открыла. Для пользователя на клавиатуре это означало потерю
 * места в интерфейсе; для платформы с медицинскими данными — ещё и риск
 * подтвердить действие вслепую. Dialog даёт focus trap, возврат фокуса,
 * inert-фон и связку aria-labelledby/aria-describedby из коробки.
 */
import type { ReactNode } from 'react'
import { Info, Trash2, TriangleAlert, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/reui/dialog'

export type ModalTone = 'default' | 'info' | 'danger' | 'warning' | 'success'

type ToneConfig = { Icon: typeof Info; color: string; bg: string }

/** Цвета тонов — те же, что были: смена начинки не должна менять вид. */
const TONE_CFG: Record<ModalTone, ToneConfig> = {
  default: { Icon: Info,          color: '#F35703', bg: '#FEF0E7' },
  info:    { Icon: Info,          color: '#0EA5E9', bg: '#F0F9FF' },
  danger:  { Icon: Trash2,        color: '#DC2626', bg: '#FEF2F2' },
  warning: { Icon: TriangleAlert, color: '#B45309', bg: '#FFFBEB' },
  success: { Icon: CheckCircle2,  color: '#16A34A', bg: '#F0FDF4' },
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  tone?: ModalTone
  /**
   * null — без иконки. undefined — иконка по тону.
   * Строка принимается для обратной совместимости со старыми вызовами,
   * передававшими имя keenicon: имя игнорируется, берётся иконка тона.
   * Так вызывающий код не ломается, пока keenicons уезжают из проекта.
   */
  icon?: string | null
  closeOnBackdrop?: boolean
  children?: ReactNode
  footer?: ReactNode
  maxWidth?: number
}

export function Modal({
  open, onClose, title, description,
  tone = 'default', icon, closeOnBackdrop = true,
  children, footer, maxWidth = 460,
}: ModalProps) {
  const { Icon, color, bg } = TONE_CFG[tone]
  const showIcon = icon !== null

  return (
    <Dialog
      open={open}
      onOpenChange={next => { if (!next) onClose() }}
      // Клик по фону закрывает только когда это разрешено вызывающим кодом;
      // Escape продолжает работать в любом случае — это выход, а не действие.
      disablePointerDismissal={!closeOnBackdrop}
    >
      <DialogContent style={{ maxWidth }} className="w-full">
        <DialogHeader className="flex-row items-start gap-4 space-y-0">
          {showIcon && (
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: bg, color }}
            >
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5 text-left">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-sm leading-6">
                {description}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        {children}

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
