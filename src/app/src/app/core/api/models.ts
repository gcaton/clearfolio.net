export interface Household {
  id: string;
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
  createdAt: string;
}

export interface UpdateHouseholdRequest {
  name: string;
  baseCurrency: string;
  preferredPeriodType: string;
}

export interface Member {
  id: string;
  email: string;
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
}

export interface CreateLiabilityRequest {
  liabilityTypeId: string;
  ownerMemberId: string | null;
  ownershipType: string;
  jointSplit: number;
  label: string;
  currency: string;
  notes: string | null;
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

export interface GoalProjection {
  target: number;
  current: number;
  progressPercent: number;
  projectedPeriod: string | null;
  slope: number;
  dataPoints: number;
  rSquared: number;
}
