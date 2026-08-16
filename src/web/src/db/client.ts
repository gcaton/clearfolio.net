import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src/db/migrations')

let instance: BetterSQLite3Database | null = null

function configure(sqlite: Database.Database): void {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
}

/** Process-wide singleton. Safe because the app runs as a single container. */
export function getDb(): BetterSQLite3Database {
  if (instance) return instance
  const dbPath = process.env.DB_PATH ?? 'clearfolio.db'
  const sqlite = new Database(dbPath)
  configure(sqlite)
  instance = drizzle(sqlite)
  return instance
}

/** Applies all pending migrations. Called at startup before serving traffic. */
export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

/** Fresh in-memory database with migrations applied, for tests. */
export function createTestDb(): {
  db: BetterSQLite3Database
  sqlite: Database.Database
} {
  const sqlite = new Database(':memory:')
  configure(sqlite)
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, sqlite }
}
