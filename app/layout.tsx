import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ToastProvider } from '@/lib/hooks/useToast'

export const metadata: Metadata = {
  title: 'ProForm — Дневник тренировок',
  description: 'Профессиональный дневник тренировок для атлетов и тренеров с поддержкой данных WHOOP',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full light" data-kt-theme="true" data-kt-theme-mode="light">
      <body className="antialiased flex h-full text-base text-foreground bg-background demo1 kt-sidebar-fixed kt-header-fixed">
        <ToastProvider>
          {children}
        </ToastProvider>
        <Script src="/assets/js/core.bundle.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
