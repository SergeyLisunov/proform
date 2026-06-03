import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="w-20 h-20 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
        <i className="ki-filled ki-compass text-3xl text-orange-400" />
      </div>
      <div className="text-center">
        <p className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-2">404</p>
        <h1 className="pf-num text-4xl text-navy-500 mb-3">Страница не найдена</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Такой страницы не существует или она была перемещена.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-home text-sm" />
          На главную
        </Link>
        <Link href="javascript:history.back()" className="kt-btn kt-btn-outline gap-2">
          <i className="ki-filled ki-left text-sm" />
          Назад
        </Link>
      </div>
    </div>
  )
}
