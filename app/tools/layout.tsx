import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Инструменты для атлетов и тренеров — ProForm',
  description:
    'Бесплатные инструменты ProForm: калькулятор риска травмы (ACWR), тест на перетренированность, шаблоны планов. Научные подходы, результат за 30 секунд.',
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold">P</span>
            <span className="font-bold text-lg">ProForm</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tools/adaptive-plan" className="text-slate-600 hover:text-slate-900">7-day Plan</Link>
            <Link href="/tools/team-risk" className="text-slate-600 hover:text-slate-900">Team Risk</Link>
            <Link href="/tools/acwr" className="text-slate-600 hover:text-slate-900 hidden sm:inline">ACWR</Link>
            <Link href="/tools/overtraining" className="text-slate-600 hover:text-slate-900 hidden sm:inline">Перетренированность</Link>
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900 hidden sm:inline">Тарифы</Link>
            <Link href="/auth/login"
              className="rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-slate-800">
              Войти
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} ProForm · Платформа для атлетов, тренеров и спортивных врачей</div>
          <div className="flex items-center gap-4">
            <Link href="/auth/register" className="text-orange-600 hover:text-orange-700 font-semibold">Начать бесплатно</Link>
            <a href="mailto:hi@proform-delta.vercel.app" className="hover:text-slate-900">Связаться</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
