import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

/**
 * AppShell — каркас кабинета: боковая панель, шапка и область контента.
 *
 * ЗАЧЕМ ОДИН КОМПОНЕНТ. Эта обвязка была скопирована в 26 layout-файлов
 * разделов кабинета, причём в трёх слегка разных вариантах. Копии разошлись
 * не только косметически: в десяти разделах не было отступа снизу под
 * мобильную нижнюю навигацию (она fixed bottom-0 и рендерится на всех
 * разделах), и на телефоне низ страницы уходил под панель. Теперь каркас
 * один, и меняется он в одном месте.
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
   * Обрезать горизонтальное переполнение контента.
   *
   * Десять разделов исторически стояли с overflow-hidden — он пришёл
   * шаблоном в одном пакете новых страниц, без объяснения. Проверить, не
   * прикрывает ли он широкие графики, без входа в кабинет нельзя, поэтому
   * поведение сохранено точно, но через overflow-x-clip: он режет только по
   * горизонтали и, в отличие от overflow-hidden, не создаёт контейнер
   * прокрутки — sticky-элементы внутри продолжают работать.
   */
  clipX?: boolean
}) {
  return (
    <div className="flex grow w-full">
      <Sidebar />
      <div className={cn('kt-wrapper flex grow flex-col w-full min-w-0', variant === 'flush' && 'overflow-hidden')}>
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
      </div>
    </div>
  )
}
