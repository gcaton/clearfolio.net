import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { households } from '@/db/schema'
import { isPassphraseSet, sessionDays, validateSession } from './auth'

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
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionDays() * 24 * 60 * 60,
  }
}
