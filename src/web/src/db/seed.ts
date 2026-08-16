import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { assetTypes, liabilityTypes } from './schema'

export const SEED_ASSET_TYPES = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Cash — savings / transaction', category: 'cash', liquidity: 'immediate', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 1, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Cash — term deposit (≤90 days)', category: 'cash', liquidity: 'short_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 2, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'Term deposit (>90 days)', category: 'cash', liquidity: 'long_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 3, isSystem: true, defaultReturnRate: 0.045, defaultVolatility: 0.01 },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Australian shares / ETFs', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 4, isSystem: true, defaultReturnRate: 0.07, defaultVolatility: 0.15 },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'International shares / ETFs', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 5, isSystem: true, defaultReturnRate: 0.08, defaultVolatility: 0.17 },
  { id: 'a0000000-0000-0000-0000-00000000000f', name: 'Managed fund', category: 'investable', liquidity: 'short_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 6, isSystem: true, defaultReturnRate: 0.06, defaultVolatility: 0.12 },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Bonds / fixed income', category: 'investable', liquidity: 'short_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 7, isSystem: true, defaultReturnRate: 0.04, defaultVolatility: 0.05 },
  { id: 'a0000000-0000-0000-0000-000000000007', name: 'Cryptocurrency', category: 'investable', liquidity: 'immediate', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 8, isSystem: true, defaultReturnRate: 0.0, defaultVolatility: 0.50 },
  { id: 'a0000000-0000-0000-0000-00000000000e', name: 'Investment bond', category: 'investable', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 9, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.08 },
  { id: 'a0000000-0000-0000-0000-000000000008', name: 'Superannuation — Accumulation', category: 'retirement', liquidity: 'restricted', growthClass: 'mixed', isSuper: true, isCgtExempt: false, sortOrder: 10, isSystem: true, defaultReturnRate: 0.07, defaultVolatility: 0.12 },
  { id: 'a0000000-0000-0000-0000-000000000009', name: 'Superannuation — Pension phase', category: 'retirement', liquidity: 'long_term', growthClass: 'mixed', isSuper: true, isCgtExempt: false, sortOrder: 11, isSystem: true, defaultReturnRate: 0.06, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000a', name: 'Primary residence (PPOR)', category: 'property', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: true, sortOrder: 12, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000b', name: 'Investment property', category: 'property', liquidity: 'long_term', growthClass: 'growth', isSuper: false, isCgtExempt: false, sortOrder: 13, isSystem: true, defaultReturnRate: 0.05, defaultVolatility: 0.10 },
  { id: 'a0000000-0000-0000-0000-00000000000c', name: 'Vehicle', category: 'other', liquidity: 'long_term', growthClass: 'defensive', isSuper: false, isCgtExempt: false, sortOrder: 14, isSystem: true, defaultReturnRate: -0.10, defaultVolatility: 0.05 },
  { id: 'a0000000-0000-0000-0000-00000000000d', name: 'Other physical asset', category: 'other', liquidity: 'long_term', growthClass: 'mixed', isSuper: false, isCgtExempt: false, sortOrder: 15, isSystem: true, defaultReturnRate: 0.0, defaultVolatility: 0.10 },
] as const

export const SEED_LIABILITY_TYPES = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Home loan — PPOR', category: 'mortgage', debtQuality: 'neutral', isHecs: false, sortOrder: 1, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Home loan — Investment property', category: 'mortgage', debtQuality: 'productive', isHecs: false, sortOrder: 2, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Personal loan', category: 'personal', debtQuality: 'bad', isHecs: false, sortOrder: 3, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000004', name: 'Car loan', category: 'personal', debtQuality: 'bad', isHecs: false, sortOrder: 4, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000005', name: 'Credit card', category: 'credit', debtQuality: 'bad', isHecs: false, sortOrder: 5, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000006', name: 'Student loan (HECS-HELP)', category: 'student', debtQuality: 'neutral', isHecs: true, sortOrder: 6, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000007', name: 'Margin loan', category: 'personal', debtQuality: 'productive', isHecs: false, sortOrder: 7, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000008', name: 'Tax liability', category: 'tax', debtQuality: 'neutral', isHecs: false, sortOrder: 8, isSystem: true },
  { id: 'b0000000-0000-0000-0000-000000000009', name: 'Other liability', category: 'other', debtQuality: 'neutral', isHecs: false, sortOrder: 9, isSystem: true },
] as const

/** Idempotent — safe to call on every startup. */
export function seedReferenceData(db: BetterSQLite3Database): void {
  db.insert(assetTypes).values([...SEED_ASSET_TYPES]).onConflictDoNothing().run()
  db.insert(liabilityTypes).values([...SEED_LIABILITY_TYPES]).onConflictDoNothing().run()
}
