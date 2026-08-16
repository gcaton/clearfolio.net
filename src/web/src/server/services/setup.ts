import { randomUUID } from 'node:crypto'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  households, householdMembers, scenarios, expenseCategories,
} from '@/db/schema'
import { seedReferenceData } from '@/db/seed'
import { setPassphrase, MIN_PASSPHRASE_LENGTH } from '../auth'
import { isSetupComplete } from '../session'

export interface SetupInput {
  householdName: string
  displayName: string
  secondMemberName?: string
  baseCurrency: string
  locale: string
  preferredPeriodType: 'FY' | 'CY'
  /** Optional. When omitted the app runs unauthenticated, as it does today. */
  passphrase?: string
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Housing', 'Utilities', 'Groceries', 'Transport',
  'Insurance', 'Health', 'Discretionary', 'Other',
]

export function completeSetup(
  db: BetterSQLite3Database,
  input: SetupInput,
  now = Math.floor(Date.now() / 1000),
): { householdId: string; memberIds: string[] } {
  if (isSetupComplete(db)) {
    throw new Error('Setup has already been completed.')
  }
  if (!input.householdName.trim()) {
    throw new Error('Household name is required.')
  }
  if (!input.displayName.trim()) {
    throw new Error('Display name is required.')
  }
  // Validate before writing anything, so a rejected passphrase leaves no
  // half-created household behind.
  if (input.passphrase && input.passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  }

  const householdId = randomUUID()
  const primaryId = randomUUID()
  const memberIds = [primaryId]

  db.transaction((tx) => {
    tx.insert(households).values({
      id: householdId,
      name: input.householdName.trim(),
      baseCurrency: input.baseCurrency,
      preferredPeriodType: input.preferredPeriodType,
      locale: input.locale,
      createdAt: now,
    }).run()

    tx.insert(householdMembers).values({
      id: primaryId,
      householdId,
      email: null,
      displayName: input.displayName.trim(),
      memberTag: 'p1',
      isPrimary: true,
      createdAt: now,
    }).run()

    if (input.secondMemberName?.trim()) {
      const secondId = randomUUID()
      memberIds.push(secondId)
      tx.insert(householdMembers).values({
        id: secondId,
        householdId,
        email: null,
        displayName: input.secondMemberName.trim(),
        memberTag: 'p2',
        isPrimary: false,
        createdAt: now,
      }).run()
    }

    tx.insert(scenarios).values({
      id: randomUUID(),
      householdId,
      name: 'Baseline',
      horizonYears: 20,
      inflationRate: 0,
      isBaseline: true,
      createdAt: now,
    }).run()

    tx.insert(expenseCategories).values(
      DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
        id: randomUUID(),
        householdId,
        name,
        sortOrder: index + 1,
        isDefault: true,
        createdAt: now,
      })),
    ).run()

    seedReferenceData(tx as unknown as BetterSQLite3Database)

    if (input.passphrase) {
      setPassphrase(tx as unknown as BetterSQLite3Database, input.passphrase)
    }
  })

  return { householdId, memberIds }
}
