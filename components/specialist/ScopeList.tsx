import { Icon } from '@/components/ui/Icon'
import { SPECIALIST_SCOPE } from '@/lib/specialist'
import { cn } from '@/lib/utils'

/**
 * Границы роли специалиста — одинаково в мастере онбординга и в кабинете:
 * что входит в работу, что нет.
 */
export function ScopeList({ className, headingLevel = 'h3' }: {
  className?: string
  /** Уровень подзаголовков «Можно» / «Нельзя» — на ступень ниже заголовка
   *  блока, в котором стоит список. */
  headingLevel?: 'h3' | 'h4'
}) {
  const Heading = headingLevel
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <section aria-labelledby="specialist-scope-can">
        <Heading id="specialist-scope-can" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {SPECIALIST_SCOPE.canTitle}
        </Heading>
        <ul className="mt-2 flex flex-col gap-2">
          {SPECIALIST_SCOPE.can.map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
              <Icon name="ki-check-circle" className="mt-0.5 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="specialist-scope-cannot">
        <Heading id="specialist-scope-cannot" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {SPECIALIST_SCOPE.cannotTitle}
        </Heading>
        <ul className="mt-2 flex flex-col gap-2">
          {SPECIALIST_SCOPE.cannot.map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
              <Icon name="ki-cross-circle" className="mt-0.5 shrink-0 text-destructive" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
