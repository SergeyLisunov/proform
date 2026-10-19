import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import { SidebarInset } from '@/components/reui/sidebar'
import { CabinetSidebarProvider } from '@/components/layout/CabinetSidebarProvider'
import { TooltipProvider } from '@/components/reui/tooltip'
import { UnreadCountsProvider } from '@/lib/hooks/useUnreadCounts'
import { cn } from '@/lib/utils'

/**
 * AppShell — каркас кабинета: боковая панель, шапка и область контента.
 *
 * ЗАЧЕМ ОДИН КОМПОНЕНТ. Эта обвязка была скопирована в 26 layout-файлов
 * разделов кабинета в трёх вариантах, и копии разошлись: в десяти разделах
 * не было отступа под мобильную нижнюю навигацию. Теперь каркас один.
 *
 * НА ЧЁМ ПОСТРОЕН. shadcn Sidebar в композиции ReUI app-shell-1:
 * SidebarProvider держит состояние панели (развёрнута, свёрнута в иконки,
 * открыта на мобильном), SidebarInset — область справа от неё. Раскладку
 * больше не задают классы Metronic kt-wrapper/kt-header с отступами на
 * ширину панели: инсет сам занимает оставшееся место.
 *
 * Провайдеры:
 *   - TooltipProvider — подсказки к пунктам свёрнутой панели;
 *   - UnreadCountsProvider — один счётчик непрочитанного на шапку и панель.
 *
 * Состояние «свёрнута/развёрнута» живёт в хранилище вне React
 * (CabinetSidebarProvider + lib/hooks/sidebarOpenStore): каркас
 * перемонтируется при переходе в другой раздел, а свёрнутость сохраняется.
 * Cookie при серверном рендере не читается — для этого нужен cookies(), и все
 * 26 разделов, включая отдаваемые статикой, стали бы динамическими.
 */
export type AppShellVariant = 'padded' | 'flush'

export default function AppShell({
  children,
  variant = 'padded',
  clipX = false,
}: {
  children: React.ReactNode
  /**
   * padded — обычная страница с полями и отступом под мобильную навигацию;
   * flush — без полей, страница сама управляет раскладкой на весь экран
   * (так устроены заметки).
   */
  variant?: AppShellVariant
  /**
   * Обрезать горизонтальное переполнение. Десять разделов исторически стояли
   * с overflow-hidden — он пришёл шаблоном, без объяснения, и проверить, не
   * прикрывает ли он широкие графики, без входа в кабинет нельзя. Поведение
   * сохранено, но через overflow-x-clip: он режет только по горизонтали и не
   * создаёт контейнер прокрутки — sticky внутри продолжает работать.
   */
  clipX?: boolean
}) {
  return (
    <TooltipProvider>
      <UnreadCountsProvider>
        <CabinetSidebarProvider>
          <Sidebar />
          {/* Без overflow-hidden на инсете даже у flush: шапка внутри него —
              sticky, а sticky не работает под предком с overflow-hidden — на
              /notes шапка с колокольчиком и бургером уезжала за верх экрана.
              Обрезка остаётся на <main>: он сосед шапки, а не её предок. */}
          <SidebarInset className="min-w-0">
            <TopBar />
            <main
              className={cn(
                'grow w-full min-w-0 bg-background',
                variant === 'padded' && 'px-5 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8',
                variant === 'padded' && clipX && 'overflow-x-clip',
                variant === 'flush' && 'flex flex-col overflow-hidden',
              )}
            >
              {children}
            </main>
          </SidebarInset>
          {/* Нижняя навигация на мобильном: раньше её рендерил сайдбар, теперь
              она часть каркаса — рядом с отступом, который под неё оставлен. */}
          <MobileBottomNav />
        </CabinetSidebarProvider>
      </UnreadCountsProvider>
    </TooltipProvider>
  )
}
