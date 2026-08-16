import { describe, it, expect, afterEach, vi } from 'vitest'
import { createTestDb } from '@/db/client'
import { households } from '@/db/schema'
import { setPassphrase, createSession } from './auth'
import { resolveAuthState, sessionCookieOptions, isSetupComplete, SESSION_COOKIE } from './session'

const NOW = 1_800_000_000

function withHousehold(db: ReturnType<typeof createTestDb>['db']) {
  db.insert(households).values({
    id: 'household-1',
    name: 'Test Household',
    baseCurrency: 'AUD',
    preferredPeriodType: 'FY',
    locale: 'en-AU',
    createdAt: NOW,
  }).run()
}

describe('isSetupComplete', () => {
  it('is false with no household', () => {
    const { db, sqlite } = createTestDb()
    expect(isSetupComplete(db)).toBe(false)
    sqlite.close()
  })

  it('is true once a household exists', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    expect(isSetupComplete(db)).toBe(true)
    sqlite.close()
  })
})

describe('resolveAuthState', () => {
  it('reports no-setup before a household exists', () => {
    const { db, sqlite } = createTestDb()
    expect(resolveAuthState(db, null)).toEqual({ status: 'no-setup' })
    sqlite.close()
  })

  it('is authenticated when no passphrase is set', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    expect(resolveAuthState(db, null)).toEqual({ status: 'authenticated' })
    sqlite.close()
  })

  it('is unauthenticated with a passphrase and no token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    expect(resolveAuthState(db, null)).toEqual({ status: 'unauthenticated' })
    sqlite.close()
  })

  it('is unauthenticated with an invalid token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    expect(resolveAuthState(db, 'bogus')).toEqual({ status: 'unauthenticated' })
    sqlite.close()
  })

  it('is authenticated with a valid token', () => {
    const { db, sqlite } = createTestDb()
    withHousehold(db)
    setPassphrase(db, 'a good passphrase')
    const token = createSession(db)
    expect(resolveAuthState(db, token)).toEqual({ status: 'authenticated' })
    sqlite.close()
  })
})

describe('sessionCookieOptions', () => {
  it('is HttpOnly and strictly same-site', () => {
    const options = sessionCookieOptions(false)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('strict')
    expect(options.path).toBe('/')
  })

  it('is not Secure over plain HTTP', () => {
    expect(sessionCookieOptions(false).secure).toBe(false)
  })

  it('is Secure over HTTPS', () => {
    expect(sessionCookieOptions(true).secure).toBe(true)
  })

  it('uses the documented cookie name', () => {
    expect(SESSION_COOKIE).toBe('clearfolio_session')
  })

  it('defaults maxAge to 30 days when CLEARFOLIO_SESSION_DAYS is unset', () => {
    vi.stubEnv('CLEARFOLIO_SESSION_DAYS', '')
    expect(sessionCookieOptions(false).maxAge).toBe(30 * 24 * 60 * 60)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })
})
