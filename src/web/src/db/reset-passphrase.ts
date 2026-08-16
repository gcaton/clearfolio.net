import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { appSettings, sessions } from './schema'

/**
 * Passphrase recovery escape hatch, mirroring the old C# API's startup
 * behaviour (see src/api/Clearfolio.Api/Program.cs). When
 * CLEARFOLIO_RESET_PASSPHRASE=true, clears the stored passphrase and all
 * live sessions so the next request falls back to the first-run setup flow.
 * Sessions must be cleared alongside the passphrase, or a session created
 * before the reset would still grant access after it.
 */
export function resetPassphraseIfRequested(db: BetterSQLite3Database): void {
  if (process.env.CLEARFOLIO_RESET_PASSPHRASE !== 'true') return

  db.delete(appSettings).where(eq(appSettings.key, 'passphrase')).run()
  db.delete(sessions).run()
  console.log('CLEARFOLIO_RESET_PASSPHRASE=true: passphrase and all sessions cleared.')
}
