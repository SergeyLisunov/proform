import { resolveIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

/**
 * Icon — мост со старых keenicon-имён на Lucide.
 *
 * Появился, чтобы снять иконочный шрифт Metronic (227 КБ CSS + 421 КБ
 * keenicons-filled.woff на каждой странице), не переписывая полсотни
 * компонентов, которые передают иконку строкой. Словарь имён — в
 * lib/icons.ts, там же разобраны абстрактные имена Metronic.
 *
 * Размер по умолчанию 1em: старая разметка задавала размер шрифтом
 * (text-sm, text-3xl, style={{fontSize:16}}), и такой глиф подстраивался
 * под кегль сам. Наследуя 1em, SVG ведёт себя так же — размеры в сотнях
 * мест не приходится пересматривать.
 *
 * Иконка декоративна по умолчанию (aria-hidden): рядом почти всегда есть
 * текст. Если иконка несёт смысл сама по себе, передайте `label` — тогда
 * она получит role="img" и доступное имя.
 */
export function Icon({
  name,
  className,
  label,
  style,
  strokeWidth = 2,
}: {
  /** Имя keenicon: 'ki-cross' или 'ki-filled ki-cross'. */
  name: string
  className?: string
  /** Доступное имя. Без него иконка считается декоративной. */
  label?: string
  /**
   * Инлайн-стили переносятся как есть. Важен fontSize: старая разметка
   * задавала им размер глифа, и вместе с size-[1em] он продолжает работать
   * ровно так же — 1em считается от font-size самого элемента.
   */
  style?: React.CSSProperties
  strokeWidth?: number
}) {
  const Glyph = resolveIcon(name)
  return (
    <Glyph
      className={cn('inline-block size-[1em] shrink-0 align-[-0.125em]', className)}
      style={style}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
