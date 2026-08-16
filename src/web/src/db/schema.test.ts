import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Asserts against the generated migration SQL, which is what actually reaches
 * a user's database. Behavioural constraint tests live in seed.test.ts (Task 8),
 * once there is a migrated database to exercise.
 */
const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations')

function migrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  return files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
}

describe('generated migration', () => {
  it('creates all 15 tables', () => {
    const matches = migrationSql().match(/CREATE TABLE/g) ?? []
    expect(matches).toHaveLength(15)
  })

  it.each([
    'households', 'household_members', 'sessions', 'app_settings',
    'asset_types', 'liability_types', 'assets', 'liabilities',
    'ownership', 'snapshots', 'expense_categories', 'income_streams',
    'expenses', 'scenarios', 'scenario_assumptions',
  ])('creates %s', (table) => {
    expect(migrationSql()).toContain(`\`${table}\``)
  })

  it('enforces one snapshot per entity per period', () => {
    expect(migrationSql()).toMatch(/CREATE UNIQUE INDEX.*uq_snapshots_entity_period/)
  })

  it('enforces one ownership row per entity per member', () => {
    expect(migrationSql()).toMatch(/CREATE UNIQUE INDEX.*uq_ownership_entity_member/)
  })

  it('stores money as integer cents, never as REAL', () => {
    const sql = migrationSql()
    const centsColumns = sql.match(/`\w*_cents`\s+\w+/g) ?? []
    expect(centsColumns.length).toBeGreaterThan(0)
    for (const column of centsColumns) {
      expect(column).toMatch(/integer/i)
    }
  })

  it('stores price_per_unit as REAL, for sub-cent precision', () => {
    expect(migrationSql()).toMatch(/`price_per_unit`\s+real/i)
  })

  it('has no currency column on assets, liabilities or snapshots', () => {
    expect(migrationSql()).not.toMatch(/`currency`/)
  })
})
