import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/liabilities', label: 'Liabilities' },
  { href: '/snapshots', label: 'Snapshots' },
  { href: '/projections', label: 'Projections' },
  { href: '/settings', label: 'Settings' },
]

export function AppShell({
  householdName,
  children,
}: {
  householdName: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">Clearfolio</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {householdName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action="/api/logout" method="post">
            <button type="submit" className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        <nav
          className="w-44 shrink-0 border-r p-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-2 py-1 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
