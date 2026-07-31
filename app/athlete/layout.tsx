import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

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
    <div className="flex grow w-full">
      <Sidebar />
      <div className="kt-wrapper flex grow flex-col w-full min-w-0">
        <TopBar />
        <main className="grow w-full min-w-0 px-5 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
