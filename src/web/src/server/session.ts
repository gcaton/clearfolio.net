import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { households } from '@/db/schema'
import { isPassphraseSet, validateSession } from './auth'

export const SESSION_COOKIE = 'clearfolio_session'

export type AuthState =
  | { status: 'no-setup' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }

export function isSetupComplete(db: BetterSQLite3Database): boolean {
  return db.select().from(households).limit(1).all().length > 0
}

/**
 * The single source of truth for what a request is allowed to do.
 * Pure with respect to the request — takes the token, returns a state.
 *
 * Ordering matters: no household means the setup wizard hasn't run yet, so
 * that check comes first. Once a household exists but no passphrase has been
 * set, the install is open by design — this is the default state on a fresh
 * install, and it must resolve to `authenticated` without requiring a
 * session token. Only once a passphrase is set does a valid session become
 * mandatory.
 */
export function resolveAuthState(
  db: BetterSQLite3Database,
  token: string | null,
): AuthState {
  if (!isSetupComplete(db)) return { status: 'no-setup' }
  if (!isPassphraseSet(db)) return { status: 'authenticated' }
  if (token && validateSession(db, token)) return { status: 'authenticated' }
  return { status: 'unauthenticated' }
}

export interface SessionCookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict'
  path: string
  maxAge: number
}

export function sessionCookieOptions(isHttps: boolean): SessionCookieOptions {
  const days = Number(process.env.CLEARFOLIO_SESSION_DAYS)
  const sessionDays = Number.isInteger(days) && days > 0 ? days : 30
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionDays * 24 * 60 * 60,
  }
}

/**
 * Server-only guard for use at the top of a protected route/layout. Resolves
 * the current auth state from the request's session cookie and redirects to
 * the setup wizard or login page as appropriate; returns normally only when
 * the caller is authenticated.
 */
export async function requireSession(): Promise<void> {
  const cookieStore = await cookies()
  const db = getDb()
  const state = resolveAuthState(db, cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')
}
