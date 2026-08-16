import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clearfolio',
  description: 'Household net worth tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
