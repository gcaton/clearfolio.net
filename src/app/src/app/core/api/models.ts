export interface Household {
  id: string;
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
  locale: string;
  createdAt: string;
}

export interface UpdateHouseholdRequest {
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
  locale: string;
}

export interface Member {
  id: string;
  email: string | null;
  displayName: string;
  memberTag: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface AssetType {
  id: string;
  name: string;
  category: string;
  liquidity: string;
  growthClass: string;
  isSuper: boolean;
  isCgtExempt: boolean;
  sortOrder: number;
  isSystem: boolean;
  defaultReturnRate: number;
  defaultVolatility: number;
}

export interface CreateAssetTypeRequest {
  name: string;
  category: string;
  liquidity: string;
  growthClass: string;
  isSuper: boolean;
  isCgtExempt: boolean;
  defaultReturnRate: number;
  defaultVolatility: number;
}

export interface UpdateAssetTypeRequest extends CreateAssetTypeRequest {
  sortOrder: number;
}

export interface LiabilityType {
  id: string;
  name: string;
  category: string;
  debtQuality: string;
  isHecs: boolean;
  sortOrder: number;
  isSystem: boolean;
}

export interface CreateLiabilityTypeRequest {
  name: string;
  category: string;
  debtQuality: string;
  isHecs: boolean;
}

export interface UpdateLiabilityTypeRequest extends CreateLiabilityTypeRequest {
  sortOrder: number;
}

export interface Asset {
  id: string;
  assetTypeId: string;
  assetTypeName: string;
  ownerMemberId: string | null;
  ownerDisplayName: string | null;
  ownershipType: string;
  jointSplit: number;
  label: string;
  symbol: string | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  contributionAmount: number | null;
  contributionFrequency: string | null;
  contributionEndDate: string | null;
  isPreTaxContribution: boolean;
  expectedReturnRate: number | null;
  expectedVolatility: number | null;
}

export interface CreateAssetRequest {
  assetTypeId: string;
  ownerMemberId: string | null;
  ownershipType: string;
  jointSplit: number;
  label: string;
  symbol: string | null;
  currency: string;
  notes: string | null;
  contributionAmount: number | null;
  contributionFrequency: string | null;
  contributionEndDate: string | null;
  isPreTaxContribution: boolean;
  expectedReturnRate: number | null;
  expectedVolatility: number | null;
}

export interface Quote {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  exchange: string | null;
}

export interface Liability {
  id: string;
  liabilityTypeId: string;
  liabilityTypeName: string;
  ownerMemberId: string | null;
  ownerDisplayName: string | null;
  ownershipType: string;
  jointSplit: number;
  label: string;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  repaymentAmount: number | null;
  repaymentFrequency: string | null;
  repaymentEndDate: string | null;
  interestRate: number | null;
}

export interface CreateLiabilityRequest {
  liabilityTypeId: string;
  ownerMemberId: string | null;
  ownershipType: string;
  jointSplit: number;
  label: string;
  currency: string;
  notes: string | null;
  repaymentAmount: number | null;
  repaymentFrequency: string | null;
  repaymentEndDate: string | null;
  interestRate: number | null;
}

export interface Snapshot {
  id: string;
  entityId: string;
  entityType: string;
  period: string;
  value: number;
  currency: string;
  notes: string | null;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
}

export interface CreateSnapshotRequest {
  entityId: string;
  entityType: string;
  period: string;
  value: number;
  currency: string;
  notes: string | null;
}

// Dashboard
export interface LatestSnapshot {
  entityId: string;
  entityType: string;
  period: string;
  value: number;
  currency: string;
}

export interface DashboardSummary {
  period: string;
  view: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  financialNetWorth: number;
  liquidNetWorth: number;
  previousNetWorth: number | null;
  netWorthChange: number | null;
  netWorthChangePercent: number | null;
  assetsByCategory: CategoryBreakdown[];
  liabilitiesByCategory: CategoryBreakdown[];
  liquidityBreakdown: LiquidityBreakdown[];
  growthBreakdown: GrowthBreakdown[];
  debtQualityBreakdown: DebtQualityBreakdown[];
}

export interface CategoryBreakdown {
  category: string;
  value: number;
}

export interface LiquidityBreakdown {
  liquidity: string;
  value: number;
}

export interface GrowthBreakdown {
  growthClass: string;
  value: number;
}

export interface DebtQualityBreakdown {
  debtQuality: string;
  value: number;
}

export interface TrendPoint {
  period: string;
  assets: number;
  financialAssets: number;
  liabilities: number;
  netWorth: number;
}

export interface CompositionPoint {
  period: string;
  category: string;
  value: number;
}

export interface MemberComparison {
  memberTag: string;
  displayName: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface SuperGap {
  memberTag: string;
  displayName: string;
  superBalance: number;
}

export interface AssetPerformance {
  assetId: string;
  label: string;
  category: string;
  owner: string | null;
  years: YearValue[];
}

export interface YearValue {
  year: string;
  value: number;
}

export interface GoalProjection {
  target: number;
  current: number;
  progressPercent: number;
  projectedPeriod: string | null;
  slope: number;
  dataPoints: number;
  rSquared: number;
}

// --- Cashflow ---

export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateExpenseCategoryRequest {
  name: string;
}

export interface UpdateExpenseCategoryRequest {
  name: string;
  sortOrder: number;
}

export interface IncomeStream {
  id: string;
  ownerMemberId: string;
  ownerDisplayName: string | null;
  label: string;
  incomeType: string;
  amount: number;
  frequency: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncomeStreamRequest {
  ownerMemberId: string;
  label: string;
  incomeType: string;
  amount: number;
  frequency: string;
  isActive: boolean;
  notes: string | null;
}

export interface Expense {
  id: string;
  ownerMemberId: string | null;
  ownerDisplayName: string | null;
  expenseCategoryId: string;
  expenseCategoryName: string;
  label: string;
  amount: number;
  frequency: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  ownerMemberId: string | null;
  expenseCategoryId: string;
  label: string;
  amount: number;
  frequency: string;
  isActive: boolean;
  notes: string | null;
}

export interface CashflowSummary {
  totalAnnualIncome: number;
  totalAnnualExpenses: number;
  totalAnnualContributions: number;
  totalAnnualRepayments: number;
  disposableIncome: number;
  netCashflow: number;
  savingsRate: number;
  debtToIncomeRatio: number;
  incomeByMember: { memberTag: string; displayName: string; annualIncome: number }[];
  expensesByCategory: { categoryName: string; annualAmount: number }[];
}

// --- Projections ---

export interface ProjectionRequest {
  horizon: number;
  view: string;
  scope: string;
  entityIds?: string[];
  simulations?: number;
  inflationRate?: number;
}

export interface CompoundYearData {
  year: number;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface EntityProjection {
  id: string;
  label: string;
  category: string;
  entityType: string;
  years: { year: number; value: number }[];
}

export interface CompoundResult {
  mode: 'compound';
  horizon: number;
  years: CompoundYearData[];
  entities: EntityProjection[];
}

export interface ScenarioValues {
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface ScenarioYearData {
  year: number;
  pessimistic: ScenarioValues;
  base: ScenarioValues;
  optimistic: ScenarioValues;
}

export interface ScenarioEntityYear {
  year: number;
  pessimistic: number;
  base: number;
  optimistic: number;
}

export interface ScenarioEntityProjection {
  id: string;
  label: string;
  category: string;
  entityType: string;
  years: ScenarioEntityYear[];
}

export interface ScenarioResult {
  mode: 'scenario';
  horizon: number;
  years: ScenarioYearData[];
  entities: ScenarioEntityProjection[];
}

export interface MonteCarloYearData {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MonteCarloEntityProjection {
  id: string;
  label: string;
  category: string;
  entityType: string;
  years: MonteCarloYearData[];
}

export interface MonteCarloResult {
  mode: 'monte-carlo';
  horizon: number;
  simulations: number;
  years: MonteCarloYearData[];
  entities: MonteCarloEntityProjection[];
}

export type ProjectionResult = CompoundResult | ScenarioResult | MonteCarloResult;

export interface ProjectionDefault {
  entityId: string;
  entityType: string;
  label: string;
  effectiveReturnRate: number | null;
  effectiveVolatility: number | null;
  effectiveInterestRate: number | null;
  rateSource: string;
  contributionAmount: number | null;
  contributionFrequency: string | null;
  annualContribution: number;
  repaymentAmount: number | null;
  repaymentFrequency: string | null;
  annualRepayment: number;
  currentValue: number | null;
  hasCurrentValue: boolean;
}

export interface HistoricalReturn {
  symbol: string;
  annualisedReturn: number;
  arithmeticReturn: number;
  volatility: number;
  dataPoints: number;
  periodYears: number;
}

export interface DashboardGoalProjection {
  target: number;
  current: number;
  progressPercent: number;
  projectedYear: number | null;
  goalReached: boolean;
}
