import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/db/client'
import { households, householdMembers, scenarios, expenseCategories } from '@/db/schema'
import { isPassphraseSet } from '@/server/auth'
import { completeSetup } from './setup'

const NOW = 1_800_000_000

const INPUT = {
  householdName: 'The Catons',
  displayName: 'Greg',
  baseCurrency: 'AUD',
  locale: 'en-AU',
  preferredPeriodType: 'FY' as const,
}

describe('completeSetup', () => {
  it('creates the household', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const rows = db.select().from(households).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('The Catons')
    expect(rows[0].preferredPeriodType).toBe('FY')
    expect(rows[0].locale).toBe('en-AU')
    sqlite.close()
  })

  it('creates a single primary member', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const members = db.select().from(householdMembers).all()
    expect(members).toHaveLength(1)
    expect(members[0].displayName).toBe('Greg')
    expect(members[0].isPrimary).toBe(true)
    sqlite.close()
  })

  it('creates a second member when supplied', () => {
    const { db, sqlite } = createTestDb()
    const result = completeSetup(db, { ...INPUT, secondMemberName: 'Sam' }, NOW)

    const members = db.select().from(householdMembers).all()
    expect(members).toHaveLength(2)
    expect(members.filter((m) => m.isPrimary)).toHaveLength(1)
    expect(result.memberIds).toHaveLength(2)
    sqlite.close()
  })

  it('seeds a baseline scenario', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    const rows = db.select().from(scenarios).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].isBaseline).toBe(true)
    expect(rows[0].name).toBe('Baseline')
    sqlite.close()
  })

  it('seeds reference data and default expense categories', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)

    expect(db.select().from(expenseCategories).all().length).toBeGreaterThan(0)
    sqlite.close()
  })

  it('refuses to run twice', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)
    expect(() => completeSetup(db, INPUT, NOW)).toThrow(/already/i)
    sqlite.close()
  })

  it('rejects a blank household name', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, householdName: '  ' }, NOW))
      .toThrow(/household name/i)
    sqlite.close()
  })

  it('rejects a blank display name', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, displayName: '' }, NOW))
      .toThrow(/display name/i)
    sqlite.close()
  })

  it('leaves the app open when no passphrase is supplied', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, INPUT, NOW)
    expect(isPassphraseSet(db)).toBe(false)
    sqlite.close()
  })

  it('sets the passphrase when supplied', () => {
    const { db, sqlite } = createTestDb()
    completeSetup(db, { ...INPUT, passphrase: 'a good passphrase' }, NOW)
    expect(isPassphraseSet(db)).toBe(true)
    sqlite.close()
  })

  it('rejects a too-short passphrase without creating a household', () => {
    const { db, sqlite } = createTestDb()
    expect(() => completeSetup(db, { ...INPUT, passphrase: 'short' }, NOW)).toThrow(/8/)
    expect(db.select().from(households).all()).toHaveLength(0)
    sqlite.close()
  })
})
