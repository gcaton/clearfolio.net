import { describe, it, expect, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './client'
import { resetPassphraseIfRequested } from './reset-passphrase'
import { appSettings, sessions } from './schema'

const ORIGINAL_ENV = process.env.CLEARFOLIO_RESET_PASSPHRASE

function seedPassphraseAndSession(db: ReturnType<typeof createTestDb>['db']) {
  db.insert(appSettings).values({ key: 'passphrase', value: 'hashed-secret' }).run()
  db.insert(sessions).values({ token: 'tok-1', createdAt: 0, expiresAt: 9999999999 }).run()
}

describe('resetPassphraseIfRequested', () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CLEARFOLIO_RESET_PASSPHRASE
    } else {
      process.env.CLEARFOLIO_RESET_PASSPHRASE = ORIGINAL_ENV
    }
  })

  it('clears the passphrase and all sessions when set to "true"', () => {
    const { db, sqlite } = createTestDb()
    seedPassphraseAndSession(db)
    process.env.CLEARFOLIO_RESET_PASSPHRASE = 'true'

    resetPassphraseIfRequested(db)

    expect(db.select().from(appSettings).where(eq(appSettings.key, 'passphrase')).all()).toHaveLength(0)
    expect(db.select().from(sessions).all()).toHaveLength(0)
    sqlite.close()
  })

  it('leaves the passphrase and sessions untouched when unset', () => {
    const { db, sqlite } = createTestDb()
    seedPassphraseAndSession(db)
    delete process.env.CLEARFOLIO_RESET_PASSPHRASE

    resetPassphraseIfRequested(db)

    expect(db.select().from(appSettings).where(eq(appSettings.key, 'passphrase')).all()).toHaveLength(1)
    expect(db.select().from(sessions).all()).toHaveLength(1)
    sqlite.close()
  })

  it('leaves the passphrase and sessions untouched for any value other than "true"', () => {
    const { db, sqlite } = createTestDb()
    seedPassphraseAndSession(db)
    process.env.CLEARFOLIO_RESET_PASSPHRASE = 'yes'

    resetPassphraseIfRequested(db)

    expect(db.select().from(appSettings).where(eq(appSettings.key, 'passphrase')).all()).toHaveLength(1)
    expect(db.select().from(sessions).all()).toHaveLength(1)
    sqlite.close()
  })
})
