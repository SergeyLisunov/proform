import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { buttonVariants } from '@/components/reui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="w-20 h-20 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
        <Icon name="ki-compass" className="text-3xl text-orange-400" />
      </div>
      <div className="text-center">
        <p className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-2">404</p>
        <h1 className="pf-num text-4xl text-navy-500 mb-3">Страница не найдена</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Такой страницы не существует или она была перемещена.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className={cn(buttonVariants(), 'gap-2')}>
          <Icon name="ki-home" className="text-sm" />
          На главную
        </Link>
        <Link href="javascript:history.back()" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          <Icon name="ki-left" className="text-sm" />
          Назад
        </Link>
      </div>
    </div>
  )
}
