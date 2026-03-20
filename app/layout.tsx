import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ProForm — Training Diary',
  description: 'Professional athlete & coach training diary powered by WHOOP data',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-kt-theme="true" data-kt-theme-mode="light" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/assets/vendors/keenicons/styles.bundle.css" />
        <link rel="stylesheet" href="/assets/css/core.bundle.css" />
        <link rel="stylesheet" href="/assets/css/styles.css" />
      </head>
      <body className="antialiased flex h-full text-base demo1 kt-sidebar-fixed kt-header-fixed">
        {children}
        <script src="/assets/js/core.bundle.js" defer />
      </body>
    </html>
  )
}
