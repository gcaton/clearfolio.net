import { describe, it, expect } from 'vitest'
import { createTestDb } from './client'
import { seedReferenceData, SEED_ASSET_TYPES, SEED_LIABILITY_TYPES } from './seed'
import { assetTypes, liabilityTypes } from './schema'

// Frozen literal arrays, independent of seed.ts's own source. A typo'd GUID
// in seed.ts (e.g. a duplicated or transposed id) would still pass every
// other test here — count and flag assertions don't care which row carries
// which id — but would silently reclassify a user's asset/liability type on
// the next reseed. This is the guard for that specific failure mode.
const EXPECTED_ASSET_TYPE_IDS = [
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-00000000000f',
  'a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-00000000000e',
  'a0000000-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-00000000000a',
  'a0000000-0000-0000-0000-00000000000b',
  'a0000000-0000-0000-0000-00000000000c',
  'a0000000-0000-0000-0000-00000000000d',
] as const

const EXPECTED_LIABILITY_TYPE_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000007',
  'b0000000-0000-0000-0000-000000000008',
  'b0000000-0000-0000-0000-000000000009',
] as const

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

  it('assigns the exact, frozen asset-type ids', () => {
    expect(SEED_ASSET_TYPES.map((t) => t.id)).toEqual([...EXPECTED_ASSET_TYPE_IDS])
  })

  it('assigns the exact, frozen liability-type ids', () => {
    expect(SEED_LIABILITY_TYPES.map((t) => t.id)).toEqual([...EXPECTED_LIABILITY_TYPE_IDS])
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
