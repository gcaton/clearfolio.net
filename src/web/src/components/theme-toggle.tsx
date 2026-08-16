'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const THEMES: readonly Theme[] = ['light', 'dark', 'system']

export function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('clearfolio-theme')
    if (isTheme(stored)) setTheme(stored)
  }, [])

  useEffect(() => {
    // Apply only. Persisting here would race the mount-time read above:
    // this effect's first run always sees the initial 'system' state, so
    // writing on every theme change would clobber a stored preference
    // before the read effect's setTheme has a chance to take effect.
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const label: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

  function choose(nextTheme: Theme) {
    setTheme(nextTheme)
    localStorage.setItem('clearfolio-theme', nextTheme)
  }

  return (
    <button
      type="button"
      onClick={() => choose(next[theme])}
      className="rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      aria-label={`Theme: ${label[theme]}. Click to change.`}
    >
      {label[theme]}
    </button>
  )
}
