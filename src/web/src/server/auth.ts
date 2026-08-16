import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { appSettings, sessions } from '@/db/schema'

export const MIN_PASSPHRASE_LENGTH = 8

const PASSPHRASE_KEY = 'passphrase'
const SCRYPT_KEYLEN = 64
const SALT_BYTES = 16
const TOKEN_BYTES = 32

/** Stored as `scrypt$<saltHex>$<hashHex>`. */
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(passphrase, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassphrase(passphrase: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    if (expected.length !== SCRYPT_KEYLEN) return false
    const actual = scryptSync(passphrase, salt, SCRYPT_KEYLEN)
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
  if (existing !== null) {
    if (!currentPassphrase || !verifyPassphrase(currentPassphrase, existing)) {
      throw new Error('Current passphrase is incorrect.')
    }
  }

  // Derive once — scrypt is deliberately expensive.
  const hashed = hashPassphrase(newPassphrase)

  db.insert(appSettings)
    .values({ key: PASSPHRASE_KEY, value: hashed })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: hashed } })
    .run()
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

  db.delete(appSettings).where(eq(appSettings.key, PASSPHRASE_KEY)).run()
  db.delete(sessions).run()
}

function sessionDays(): number {
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
  const result = db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
  return result.changes
}
