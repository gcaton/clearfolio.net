import { describe, it, expect } from 'vitest'
import { createTestDb } from './client'
import { seedReferenceData } from './seed'
import { assetTypes, liabilityTypes } from './schema'

describe('seedReferenceData', () => {
  it('inserts the reference types', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    expect(db.select().from(assetTypes).all()).toHaveLength(15)
    expect(db.select().from(liabilityTypes).all()).toHaveLength(9)
    sqlite.close()
  })

  it('is idempotent', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)
    seedReferenceData(db)

    expect(db.select().from(assetTypes).all()).toHaveLength(15)
    sqlite.close()
  })

  it('preserves the AU-specific classification flags', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    const types = db.select().from(assetTypes).all()
    expect(types.filter((t) => t.isSuper)).toHaveLength(2)
    expect(types.filter((t) => t.isCgtExempt)).toHaveLength(1)

    const hecs = db.select().from(liabilityTypes).all().filter((t) => t.isHecs)
    expect(hecs).toHaveLength(1)
    expect(hecs[0].name).toContain('HECS')
    sqlite.close()
  })

  it('classifies investment bond as long-term liquidity', () => {
    const { db, sqlite } = createTestDb()
    seedReferenceData(db)

    const bond = db.select().from(assetTypes).all()
      .find((t) => t.name === 'Investment bond')
    expect(bond?.liquidity).toBe('long_term')
    sqlite.close()
  })
})

describe('createTestDb', () => {
  it('applies all migrations', () => {
    const { sqlite } = createTestDb()
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'")
      .all() as { name: string }[]

    expect(tables).toHaveLength(15)
    sqlite.close()
  })

  it('enforces the snapshot period uniqueness constraint', () => {
    const { sqlite } = createTestDb()
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='uq_snapshots_entity_period'")
      .all()

    expect(indexes).toHaveLength(1)
    sqlite.close()
  })
})
