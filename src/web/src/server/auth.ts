import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq, lte } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { appSettings, sessions } from '@/db/schema'

export const MIN_PASSPHRASE_LENGTH = 8

const PASSPHRASE_KEY = 'passphrase'
const SCRYPT_KEYLEN = 64
const SALT_BYTES = 16
const TOKEN_BYTES = 32

// Node's scrypt cost parameters, recorded explicitly in the stored hash so a
// future change to these constants cannot silently break verification of
// hashes written under the old ones. These are Node's own defaults — do not
// raise SCRYPT_N here; raising it is a separate decision (and above 16384
// also requires passing an explicit `maxmem` to scryptSync, since Node's
// default maxmem of 32MB caps N at 16384).
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

/** Stored as `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`. */
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(passphrase, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassphrase(passphrase: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts
  const n = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (n <= 0 || r <= 0 || p <= 0) return false

  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    if (expected.length !== SCRYPT_KEYLEN) return false
    const actual = scryptSync(passphrase, salt, SCRYPT_KEYLEN, { N: n, r, p })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function storedPassphrase(db: BetterSQLite3Database): string | null {
  const row = db.select().from(appSettings)
    .where(eq(appSettings.key, PASSPHRASE_KEY)).get()
  return row?.value ?? null
}

export function isPassphraseSet(db: BetterSQLite3Database): boolean {
  return storedPassphrase(db) !== null
}

export function setPassphrase(
  db: BetterSQLite3Database,
  newPassphrase: string,
  currentPassphrase?: string,
): void {
  if (newPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  }

  const existing = storedPassphrase(db)
  const isRotation = existing !== null
  if (isRotation) {
    if (!currentPassphrase || !verifyPassphrase(currentPassphrase, existing)) {
      throw new Error('Current passphrase is incorrect.')
    }
  }

  // Derive once — scrypt is deliberately expensive.
  const hashed = hashPassphrase(newPassphrase)

  db.transaction((tx) => {
    tx.insert(appSettings)
      .values({ key: PASSPHRASE_KEY, value: hashed })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: hashed } })
      .run()

    // Changing an existing passphrase must revoke every outstanding session —
    // the realistic reason to rotate it is suspected compromise, and a stale
    // session cookie should not outlive that. On first-time bootstrap there
    // are no sessions yet, so there is nothing to clear.
    if (isRotation) {
      tx.delete(sessions).run()
    }
  })
}

export function removePassphrase(
  db: BetterSQLite3Database,
  currentPassphrase: string,
): void {
  const existing = storedPassphrase(db)
  if (existing === null) throw new Error('No passphrase is set.')
  if (!verifyPassphrase(currentPassphrase, existing)) {
    throw new Error('Current passphrase is incorrect.')
  }

  db.transaction((tx) => {
    tx.delete(appSettings).where(eq(appSettings.key, PASSPHRASE_KEY)).run()
    tx.delete(sessions).run()
  })
}

/**
 * Shared by `createSession` here and `sessionCookieOptions` in `./session` —
 * both need the same `CLEARFOLIO_SESSION_DAYS` parsing with the same
 * fallback, and a duplicated env-var guard is asking for the two to drift.
 */
export function sessionDays(): number {
  const parsed = Number(process.env.CLEARFOLIO_SESSION_DAYS)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function createSession(db: BetterSQLite3Database, now = nowSeconds()): string {
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  db.insert(sessions).values({
    token,
    createdAt: now,
    expiresAt: now + sessionDays() * 24 * 60 * 60,
  }).run()
  purgeExpiredSessions(db, now)
  return token
}

export function validateSession(
  db: BetterSQLite3Database,
  token: string,
  now = nowSeconds(),
): boolean {
  if (!token) return false
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get()
  if (!row) return false
  if (row.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.token, token)).run()
    return false
  }
  return true
}

export function destroySession(db: BetterSQLite3Database, token: string): void {
  if (!token) return
  db.delete(sessions).where(eq(sessions.token, token)).run()
}

/** Returns the number of rows removed. */
export function purgeExpiredSessions(
  db: BetterSQLite3Database,
  now = nowSeconds(),
): number {
  // `<=`, matching validateSession's expiry reading below — a row expiring
  // exactly at `now` is already invalid, so purge should sweep it too.
  const result = db.delete(sessions).where(lte(sessions.expiresAt, now)).run()
  return result.changes
}
