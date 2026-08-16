import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull().default('AUD'),
  preferredPeriodType: text('preferred_period_type').notNull().default('FY'),
  locale: text('locale').notNull().default('en-AU'),
  createdAt: integer('created_at').notNull(),
})

export const householdMembers = sqliteTable('household_members', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  email: text('email'),
  displayName: text('display_name').notNull(),
  memberTag: text('member_tag').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_members_household').on(t.householdId)])

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (t) => [index('idx_sessions_expires').on(t.expiresAt)])

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const assetTypes = sqliteTable('asset_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  liquidity: text('liquidity').notNull(),
  growthClass: text('growth_class').notNull(),
  isSuper: integer('is_super', { mode: 'boolean' }).notNull().default(false),
  isCgtExempt: integer('is_cgt_exempt', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  defaultReturnRate: real('default_return_rate').notNull().default(0),
  defaultVolatility: real('default_volatility').notNull().default(0),
})

export const liabilityTypes = sqliteTable('liability_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  debtQuality: text('debt_quality').notNull(),
  isHecs: integer('is_hecs', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
})

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  assetTypeId: text('asset_type_id').notNull().references(() => assetTypes.id),
  label: text('label').notNull(),
  symbol: text('symbol'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  // Baseline projection inputs; scenarios may override these.
  contributionAmountCents: integer('contribution_amount_cents'),
  contributionFrequency: text('contribution_frequency'),
  contributionEndDate: text('contribution_end_date'), // ISO YYYY-MM-DD
  isPreTaxContribution: integer('is_pre_tax_contribution', { mode: 'boolean' }).notNull().default(false),
  expectedReturnRate: real('expected_return_rate'),
  expectedVolatility: real('expected_volatility'),
}, (t) => [index('idx_assets_household_active').on(t.householdId, t.isActive)])

export const liabilities = sqliteTable('liabilities', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  liabilityTypeId: text('liability_type_id').notNull().references(() => liabilityTypes.id),
  label: text('label').notNull(),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  repaymentAmountCents: integer('repayment_amount_cents'),
  repaymentFrequency: text('repayment_frequency'),
  repaymentEndDate: text('repayment_end_date'), // ISO YYYY-MM-DD
  interestRate: real('interest_rate'),
}, (t) => [index('idx_liabilities_household_active').on(t.householdId, t.isActive)])

/**
 * Polymorphic: entityId points at an asset or a liability, discriminated by
 * entityType. No FK is possible on a polymorphic column — integrity is
 * enforced in the service layer.
 */
export const ownership = sqliteTable('ownership', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(), // 'asset' | 'liability'
  memberId: text('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  shareBp: integer('share_bp').notNull(),
}, (t) => [
  uniqueIndex('uq_ownership_entity_member').on(t.entityId, t.memberId),
  index('idx_ownership_entity').on(t.entityId),
])

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(), // 'asset' | 'liability'
  period: text('period').notNull(),
  valueCents: integer('value_cents').notNull(),
  units: real('units'),
  pricePerUnit: real('price_per_unit'), // REAL, not cents — needs sub-cent precision
  notes: text('notes'),
  recordedBy: text('recorded_by').notNull().references(() => householdMembers.id),
  recordedAt: integer('recorded_at').notNull(),
}, (t) => [
  uniqueIndex('uq_snapshots_entity_period').on(t.entityId, t.period),
  index('idx_snapshots_household_period').on(t.householdId, t.period),
])

export const expenseCategories = sqliteTable('expense_categories', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_expense_categories_household').on(t.householdId)])

export const incomeStreams = sqliteTable('income_streams', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  ownerMemberId: text('owner_member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  incomeType: text('income_type').notNull().default('Additional'),
  amountCents: integer('amount_cents').notNull(),
  frequency: text('frequency').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [index('idx_income_household_active').on(t.householdId, t.isActive)])

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  ownerMemberId: text('owner_member_id').references(() => householdMembers.id, { onDelete: 'set null' }),
  expenseCategoryId: text('expense_category_id').notNull().references(() => expenseCategories.id),
  label: text('label').notNull(),
  amountCents: integer('amount_cents').notNull(),
  frequency: text('frequency').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  index('idx_expenses_household_active').on(t.householdId, t.isActive),
  index('idx_expenses_category').on(t.expenseCategoryId),
])

export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  horizonYears: integer('horizon_years').notNull().default(20),
  inflationRate: real('inflation_rate').notNull().default(0),
  isBaseline: integer('is_baseline', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_scenarios_household').on(t.householdId)])

export const scenarioAssumptions = sqliteTable('scenario_assumptions', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  returnRate: real('return_rate'),
  volatility: real('volatility'),
  contributionAmountCents: integer('contribution_amount_cents'),
  contributionFrequency: text('contribution_frequency'),
  contributionEndDate: text('contribution_end_date'),
}, (t) => [uniqueIndex('uq_assumption_scenario_entity').on(t.scenarioId, t.entityId)])
