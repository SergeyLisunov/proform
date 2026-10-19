import AppShell from '@/components/layout/AppShell'

/**
 * Оболочка кабинета спортсмена.
 *
 * До этого у сегмента app/athlete/ не было layout.tsx вовсе: страницы
 * (/athlete/dashboard, /athlete/goals, /athlete/progress, /athlete/passes)
 * рендерились без сайдбара и верхней панели — root layout монтирует только
 * провайдеры и оверлеи. Мобильная навигация тоже пропадала, потому что
 * MobileBottomNav живёт внутри Sidebar. То есть попасть на страницу было
 * можно, а уйти с неё — только кнопкой «назад».
 *
 * Дефект стал заметен, когда /athlete/goals и /athlete/progress добавили в
 * меню: пункт ведёт на экран без меню.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  )
}
