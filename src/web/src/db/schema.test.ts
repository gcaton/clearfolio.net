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

/** Slices out a single `CREATE TABLE ... );` statement, for table-scoped assertions. */
function tableBlock(table: string): string {
  const sql = migrationSql()
  const start = sql.indexOf(`CREATE TABLE \`${table}\``)
  if (start === -1) throw new Error(`table ${table} not found in migration SQL`)
  const end = sql.indexOf(');', start)
  return sql.slice(start, end)
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
    // Explicit CREATE TABLE match — a bare `toContain` on the backtick-quoted
    // name would also pass for a table appearing only in a REFERENCES clause.
    expect(migrationSql()).toContain(`CREATE TABLE \`${table}\``)
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

  // Finding 3: the above only catches columns already named `_cents`. Guard the
  // inverse too — no amount/value-ish money column may be declared REAL under a
  // different name (price_per_unit is deliberately excluded — see below).
  it('never declares an amount/value-ish money column as REAL', () => {
    const sql = migrationSql()
    const suspiciousReal = sql.match(/`\w*(amount|value)\w*`\s+real/gi) ?? []
    expect(suspiciousReal).toEqual([])
  })

  it('stores price_per_unit as REAL, for sub-cent precision', () => {
    expect(migrationSql()).toMatch(/`price_per_unit`\s+real/i)
  })

  it('has no currency column on assets, liabilities or snapshots', () => {
    expect(migrationSql()).not.toMatch(/`currency`/)
  })

  it.each([
    'created_at', 'updated_at', 'recorded_at', 'expires_at',
  ])('stores %s as integer unix seconds', (column) => {
    expect(migrationSql()).toMatch(new RegExp('`' + column + '`\\s+integer', 'i'))
  })

  it.each([
    'return_rate', 'volatility', 'interest_rate', 'inflation_rate',
    'default_return_rate', 'default_volatility',
  ])('stores %s as REAL, not money', (column) => {
    expect(migrationSql()).toMatch(new RegExp('`' + column + '`\\s+real', 'i'))
  })

  it.each([
    'contribution_end_date', 'repayment_end_date',
  ])('stores %s as text (ISO YYYY-MM-DD), not a timestamp', (column) => {
    expect(migrationSql()).toMatch(new RegExp('`' + column + '`\\s+text', 'i'))
  })

  it.each([
    'assets', 'liabilities', 'income_streams', 'expenses',
  ])('%s has an is_active column for soft delete', (table) => {
    expect(tableBlock(table)).toMatch(/`is_active`\s+integer/i)
  })

  it('stores share_bp as integer basis points', () => {
    expect(migrationSql()).toMatch(/`share_bp`\s+integer/i)
  })

  describe('CHECK constraints (Finding 1: single-row invariants SQLite can enforce)', () => {
    it.each([
      'chk_assets_contribution_amount_cents_int',
      'chk_liabilities_repayment_amount_cents_int',
      'chk_ownership_entity_type',
      'chk_ownership_share_bp_range',
      'chk_snapshots_entity_type',
      'chk_snapshots_value_cents_int',
      'chk_income_streams_amount_cents_int',
      'chk_expenses_amount_cents_int',
      'chk_scenario_assumptions_entity_type',
      'chk_scenario_assumptions_contribution_amount_cents_int',
      'chk_scenario_assumptions_repayment_amount_cents_int',
    ])('defines CHECK constraint %s', (name) => {
      expect(migrationSql()).toContain(name)
    })

    it('constrains share_bp to the valid basis-point range', () => {
      expect(migrationSql()).toMatch(/"share_bp"\s+BETWEEN 0 AND 10000/)
    })

    it.each(['ownership', 'snapshots', 'scenario_assumptions'])(
      'constrains %s.entity_type to asset or liability',
      (table) => {
        expect(tableBlock(table)).toMatch(/"entity_type"\s+IN\s*\('asset',\s*'liability'\)/)
      },
    )

    it('tolerates NULL in nullable cents columns (does not over-constrain)', () => {
      // e.g. assets.contribution_amount_cents is optional; its CHECK must read
      // "IS NULL OR typeof(...) = 'integer'", not just "typeof(...) = 'integer'".
      expect(tableBlock('assets')).toMatch(
        /"contribution_amount_cents"\s+IS NULL OR typeof\("assets"\."contribution_amount_cents"\)\s*=\s*'integer'/,
      )
    })
  })

  describe('scenario_assumptions polymorphism (Finding 2)', () => {
    it('has an entity_type discriminator, like ownership and snapshots', () => {
      expect(tableBlock('scenario_assumptions')).toMatch(/`entity_type`\s+text/i)
    })

    it.each([
      'interest_rate', 'repayment_amount_cents', 'repayment_frequency', 'repayment_end_date',
    ])('carries liability override column %s', (column) => {
      expect(tableBlock('scenario_assumptions')).toMatch(new RegExp('`' + column + '`'))
    })
  })
})
