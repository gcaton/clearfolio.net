import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/db/client'
import { sessions } from '@/db/schema'
import {
  hashPassphrase, verifyPassphrase, isPassphraseSet, setPassphrase,
  removePassphrase, createSession, validateSession, destroySession,
  purgeExpiredSessions, MIN_PASSPHRASE_LENGTH,
} from './auth'

const NOW = 1_800_000_000 // fixed epoch seconds

describe('passphrase hashing', () => {
  it('verifies a correct passphrase', () => {
    const stored = hashPassphrase('correct horse battery')
    expect(verifyPassphrase('correct horse battery', stored)).toBe(true)
  })

  it('rejects an incorrect passphrase', () => {
    const stored = hashPassphrase('correct horse battery')
    expect(verifyPassphrase('wrong horse battery', stored)).toBe(false)
  })

  it('produces a different hash each time — the salt varies', () => {
    expect(hashPassphrase('same input')).not.toBe(hashPassphrase('same input'))
  })

  it('rejects a malformed stored value rather than throwing', () => {
    expect(verifyPassphrase('anything', 'not-a-valid-hash')).toBe(false)
  })

  it('rejects an empty stored value rather than throwing', () => {
    expect(verifyPassphrase('anything', '')).toBe(false)
  })

  it('rejects a stored value with the wrong segment count rather than throwing', () => {
    expect(verifyPassphrase('anything', 'scrypt$16384$8$1$deadbeef')).toBe(false)
  })

  it('rejects a stored value with a non-hex salt rather than throwing', () => {
    expect(
      verifyPassphrase('anything', 'scrypt$16384$8$1$not-hex-zz$' + 'ab'.repeat(64)),
    ).toBe(false)
  })

  it('rejects a stored value with a truncated hash rather than throwing', () => {
    expect(
      verifyPassphrase('anything', `scrypt$16384$8$1$${'ab'.repeat(16)}$dead`),
    ).toBe(false)
  })

  it('rejects a stored value with a non-numeric N rather than throwing', () => {
    expect(
      verifyPassphrase(
        'anything',
        `scrypt$not-a-number$8$1$${'ab'.repeat(16)}$${'ab'.repeat(64)}`,
      ),
    ).toBe(false)
  })
})

describe('passphrase lifecycle', () => {
  it('reports no passphrase on a fresh database', () => {
    const { db, sqlite } = createTestDb()
    expect(isPassphraseSet(db)).toBe(false)
    sqlite.close()
  })

  it('sets a passphrase when none exists', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(isPassphraseSet(db)).toBe(true)
    sqlite.close()
  })

  it('rejects a passphrase below the minimum length', () => {
    const { db, sqlite } = createTestDb()
    expect(() => setPassphrase(db, 'short')).toThrow(
      new RegExp(String(MIN_PASSPHRASE_LENGTH)),
    )
    sqlite.close()
  })

  it('requires the current passphrase to change it', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(() => setPassphrase(db, 'second passphrase')).toThrow(/current passphrase/i)
    expect(() => setPassphrase(db, 'second passphrase', 'wrong')).toThrow(/current passphrase/i)
    sqlite.close()
  })

  it('changes the passphrase when the current one is correct', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    setPassphrase(db, 'second passphrase', 'first passphrase')

    const token = createSession(db, NOW)
    expect(validateSession(db, token, NOW)).toBe(true)
    sqlite.close()
  })

  it('invalidates existing sessions when the passphrase is changed', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    const token = createSession(db, NOW)
    expect(validateSession(db, token, NOW)).toBe(true)

    setPassphrase(db, 'second passphrase', 'first passphrase')

    expect(validateSession(db, token, NOW)).toBe(false)
    sqlite.close()
  })

  it('removes the passphrase and all sessions', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    const token = createSession(db, NOW)

    removePassphrase(db, 'first passphrase')

    expect(isPassphraseSet(db)).toBe(false)
    expect(validateSession(db, token, NOW)).toBe(false)
    sqlite.close()
  })

  it('refuses to remove the passphrase with the wrong current value', () => {
    const { db, sqlite } = createTestDb()
    setPassphrase(db, 'first passphrase')
    expect(() => removePassphrase(db, 'wrong')).toThrow(/current passphrase/i)
    sqlite.close()
  })
})

describe('sessions', () => {
  it('creates a token that validates', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(validateSession(db, token, NOW)).toBe(true)
    sqlite.close()
  })

  it('rejects an unknown token', () => {
    const { db, sqlite } = createTestDb()
    expect(validateSession(db, 'nope', NOW)).toBe(false)
    sqlite.close()
  })

  it('rejects an expired token', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)
    const wayLater = NOW + 60 * 60 * 24 * 365

    expect(validateSession(db, token, wayLater)).toBe(false)
    sqlite.close()
  })

  it('destroys a session', () => {
    const { db, sqlite } = createTestDb()
    const token = createSession(db, NOW)
    destroySession(db, token)

    expect(validateSession(db, token, NOW)).toBe(false)
    sqlite.close()
  })

  it('purges only expired sessions', () => {
    const { db, sqlite } = createTestDb()
    const live = createSession(db, NOW)
    const stale = createSession(db, NOW - 60 * 60 * 24 * 400)

    const purged = purgeExpiredSessions(db, NOW)

    expect(purged).toBe(1)
    expect(validateSession(db, live, NOW)).toBe(true)
    expect(db.select().from(sessions).all()).toHaveLength(1)
    expect(stale).not.toBe(live)
    sqlite.close()
  })

  it('issues distinct tokens', () => {
    const { db, sqlite } = createTestDb()
    expect(createSession(db, NOW)).not.toBe(createSession(db, NOW))
    sqlite.close()
  })
})
