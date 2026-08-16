import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { resolveAuthState, SESSION_COOKIE } from './session'

/**
 * Server-only guard for use at the top of a protected route/layout. Resolves
 * the current auth state from the request's session cookie and redirects to
 * the setup wizard or login page as appropriate; returns normally only when
 * the caller is authenticated.
 *
 * Split out from session.ts so that module can stay framework-free (pure
 * with respect to the request, importable/testable without pulling in
 * Next's request-scoped `next/headers` / `next/navigation` APIs). This
 * module is the one that pays that cost.
 */
export async function requireSession(): Promise<void> {
  const cookieStore = await cookies()
  const db = getDb()
  const state = resolveAuthState(db, cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')
}
