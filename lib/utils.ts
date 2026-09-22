import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Склейка Tailwind-классов с разрешением конфликтов.
 *
 * Нужна компонентам реестра (shadcn/ReUI): они принимают `className` и
 * обязаны дать вызывающему коду переопределить любой свой класс. Простой
 * `clsx` этого не даёт — `px-2` и `px-4` остались бы оба, и выиграл бы тот,
 * что стоит позже в собранном CSS, а не в разметке. `twMerge` оставляет
 * последний по списку, то есть переданный снаружи.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
