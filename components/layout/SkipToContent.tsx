/**
 * <SkipToContent /> — W15 Day 74.
 *
 * Keyboard-only skip-link that jumps past navigation chrome straight to
 * the `<main>` landmark. Lighthouse + WCAG SC 2.4.1 requirement.
 *
 * Visual: hidden until focused (sr-only по умолчанию), then materializes
 * как pill top-left. Anyone tabbing through the page sees it as first
 * focusable element — keyboard users save N tabs vs. walking through nav.
 *
 * Контракт: parent page должен иметь `<main id="main-content">`.
 * Если у page другой landmark id — pass via `targetId` prop.
 */
interface SkipToContentProps {
  /** Element id to focus on activation. Defaults к "main-content". */
  targetId?: string
  /** Anchor label. RU по умолчанию. */
  label?: string
}

export default function SkipToContent({
  targetId = 'main-content',
  label = 'Перейти к содержимому',
}: SkipToContentProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:items-center focus:rounded-xl focus:bg-orange-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-4 focus:ring-orange-500/30"
    >
      {label}
    </a>
  )
}
