import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Инструменты для атлетов и тренеров — Sporteo',
  description:
    'Бесплатные инструменты Sporteo: калькулятор риска травмы (ACWR), тест на перетренированность, шаблоны планов. Научные подходы, результат за 30 секунд.',
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold">P</span>
            <span className="font-bold text-lg">Sporteo</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tools/medical-summary" className="text-slate-600 hover:text-foreground">Медсводка</Link>
            <Link href="/tools/club-audit" className="text-slate-600 hover:text-foreground hidden sm:inline">Аудит клуба</Link>
            <Link href="/tools/adaptive-plan" className="text-slate-600 hover:text-foreground hidden sm:inline">План на 7 дней</Link>
            <Link href="/tools/team-risk" className="text-slate-600 hover:text-foreground hidden md:inline">Риск команды</Link>
            <Link href="/tools/acwr" className="text-slate-600 hover:text-foreground hidden lg:inline">ACWR</Link>
            <Link href="/tools/overtraining" className="text-slate-600 hover:text-foreground hidden lg:inline">Перетренированность</Link>
            <Link href="/pricing" className="text-slate-600 hover:text-foreground hidden sm:inline">Тарифы</Link>
            <Link href="/auth/login"
              className="rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-slate-800">
              Войти
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Sporteo · Платформа для атлетов, тренеров и спортивных врачей</div>
          <div className="flex items-center gap-4">
            <Link href="/auth/register" className="text-orange-600 hover:text-orange-700 font-semibold">Начать бесплатно</Link>
            <a href="mailto:hi@proform-delta.vercel.app" className="hover:text-foreground">Связаться</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
