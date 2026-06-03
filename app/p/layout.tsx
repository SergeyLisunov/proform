import Link from 'next/link'

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold">P</span>
            <span className="font-bold text-lg">Sporteo</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/tools/acwr" className="text-slate-600 hover:text-slate-900 hidden sm:inline">ACWR</Link>
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900 hidden sm:inline">Тарифы</Link>
            <Link href="/auth/register?utm_source=passport"
              className="rounded-lg bg-orange-500 text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-orange-600">
              Создать свой паспорт
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 mt-16">
        <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Sporteo · Паспорт атлета</span>
          <Link href="/" className="text-orange-600 hover:underline">О платформе →</Link>
        </div>
      </footer>
    </div>
  )
}
