import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AuthStatus {
  passphraseEnabled: boolean;
  authenticated: boolean;
  setupComplete: boolean;
}
import {
  Household,
  UpdateHouseholdRequest,
  Member,
  AssetType,
  LiabilityType,
  Asset,
  CreateAssetRequest,
  Liability,
  CreateLiabilityRequest,
  Snapshot,
  CreateSnapshotRequest,
  Quote,
  LatestSnapshot,
  DashboardSummary,
  GoalProjection,
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
  ProjectionRequest,
  CompoundResult,
  ScenarioResult,
  MonteCarloResult,
  ProjectionDefault,
  HistoricalReturn,
  AssetPerformance,
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
  IncomeStream,
  CreateIncomeStreamRequest,
  Expense,
  CreateExpenseRequest,
  CashflowSummary,
  CreateAssetTypeRequest,
  UpdateAssetTypeRequest,
  CreateLiabilityTypeRequest,
  UpdateLiabilityTypeRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Auth
  getAuthStatus() { return this.http.get<AuthStatus>('/api/auth/status'); }
  login(passphrase: string) { return this.http.post('/api/auth/login', { passphrase }); }
  logout() { return this.http.post('/api/auth/logout', {}); }
  setPassphrase(currentPassphrase: string | null, newPassphrase: string) {
    return this.http.put('/api/auth/passphrase', { currentPassphrase, newPassphrase });
  }
  removePassphrase(currentPassphrase: string) {
    return this.http.delete('/api/auth/passphrase', { body: { currentPassphrase } });
  }

  // Reference
  getAssetTypes() {
    return this.http.get<AssetType[]>('/api/asset-types');
  }

  getLiabilityTypes() {
    return this.http.get<LiabilityType[]>('/api/liability-types');
  }

  // Asset Type CRUD
  createAssetType(request: CreateAssetTypeRequest) {
    return this.http.post<AssetType>('/api/asset-types', request);
  }

  updateAssetType(id: string, request: UpdateAssetTypeRequest) {
    return this.http.put<AssetType>(`/api/asset-types/${id}`, request);
  }

  deleteAssetType(id: string) {
    return this.http.delete(`/api/asset-types/${id}`);
  }

  // Liability Type CRUD
  createLiabilityType(request: CreateLiabilityTypeRequest) {
    return this.http.post<LiabilityType>('/api/liability-types', request);
  }

  updateLiabilityType(id: string, request: UpdateLiabilityTypeRequest) {
    return this.http.put<LiabilityType>(`/api/liability-types/${id}`, request);
  }

  deleteLiabilityType(id: string) {
    return this.http.delete(`/api/liability-types/${id}`);
  }

  // Household
  getHousehold() {
    return this.http.get<Household>('/api/household');
  }

  updateHousehold(request: UpdateHouseholdRequest) {
    return this.http.put<Household>('/api/household', request);
  }

  // Household - destructive
  deleteAllData() {
    return this.http.delete('/api/household');
  }

  // Export / Import
  exportData() {
    return this.http.get('/api/export');
  }

  importData(data: unknown) {
    return this.http.post('/api/import', data);
  }

  // Members
  getMembers() {
    return this.http.get<Member[]>('/api/members');
  }

  getCurrentMember() {
    return this.http.get<Member>('/api/members/me');
  }

  createMember(displayName: string, email?: string) {
    return this.http.post<Member>('/api/members', { email, displayName });
  }

  updateMember(id: string, displayName: string, email?: string) {
    return this.http.put<Member>(`/api/members/${id}`, { displayName, email });
  }

  setup(displayName: string, householdName?: string, currency?: string, periodType?: string) {
    return this.http.post<Member>('/api/members/setup', { displayName, householdName, currency, periodType });
  }

  deleteMember(id: string) {
    return this.http.delete(`/api/members/${id}`);
  }

  // Assets
  getAssets() {
    return this.http.get<Asset[]>('/api/assets');
  }

  createAsset(request: CreateAssetRequest) {
    return this.http.post<Asset>('/api/assets', request);
  }

  updateAsset(id: string, request: CreateAssetRequest) {
    return this.http.put<Asset>(`/api/assets/${id}`, request);
  }

  deleteAsset(id: string) {
    return this.http.delete(`/api/assets/${id}`);
  }

  getQuote(symbol: string) {
    return this.http.get<Quote>(`/api/quote/${encodeURIComponent(symbol)}`);
  }

  // Liabilities
  getLiabilities() {
    return this.http.get<Liability[]>('/api/liabilities');
  }

  createLiability(request: CreateLiabilityRequest) {
    return this.http.post<Liability>('/api/liabilities', request);
  }

  updateLiability(id: string, request: CreateLiabilityRequest) {
    return this.http.put<Liability>(`/api/liabilities/${id}`, request);
  }

  deleteLiability(id: string) {
    return this.http.delete(`/api/liabilities/${id}`);
  }

  // Snapshots
  getSnapshots(params?: { period?: string; entityId?: string }) {
    return this.http.get<Snapshot[]>('/api/snapshots', { params: params as Record<string, string> });
  }

  upsertSnapshot(request: CreateSnapshotRequest) {
    return this.http.post<Snapshot>('/api/snapshots', request);
  }

  updateSnapshot(id: string, request: { value: number; currency: string; notes: string | null }) {
    return this.http.put<Snapshot>(`/api/snapshots/${id}`, request);
  }

  deleteSnapshot(id: string) {
    return this.http.delete(`/api/snapshots/${id}`);
  }

  getLatestSnapshots() {
    return this.http.get<LatestSnapshot[]>('/api/snapshots/latest');
  }

  getPeriods() {
    return this.http.get<string[]>('/api/periods');
  }

  // Dashboard
  getDashboardSummary(params?: { period?: string; view?: string; scope?: string }) {
    return this.http.get<DashboardSummary>('/api/dashboard/summary', { params: params as Record<string, string> });
  }

  getDashboardTrend(params?: { view?: string; scope?: string }) {
    return this.http.get<TrendPoint[]>('/api/dashboard/trend', { params: params as Record<string, string> });
  }

  getDashboardComposition(params?: { period?: string; scope?: string }) {
    return this.http.get<CompositionPoint[]>('/api/dashboard/composition', { params: params as Record<string, string> });
  }

  getDashboardMembers(params?: { period?: string; scope?: string }) {
    return this.http.get<MemberComparison[]>('/api/dashboard/members', { params: params as Record<string, string> });
  }

  getGoalProjection(target: number, view = 'household', scope = 'all') {
    return this.http.get<GoalProjection>('/api/dashboard/goal-projection', {
      params: { target: target.toString(), view, scope },
    });
  }

  getSuperGap() {
    return this.http.get<SuperGap[]>('/api/dashboard/super-gap');
  }

  getAssetPerformance(params?: { view?: string }) {
    return this.http.get<AssetPerformance[]>('/api/dashboard/asset-performance', { params: params as Record<string, string> });
  }

  // Projections
  runCompoundProjection(request: ProjectionRequest) {
    return this.http.post<CompoundResult>('/api/projections/compound', request);
  }

  runScenarioProjection(request: ProjectionRequest) {
    return this.http.post<ScenarioResult>('/api/projections/scenario', request);
  }

  runMonteCarloProjection(request: ProjectionRequest) {
    return this.http.post<MonteCarloResult>('/api/projections/monte-carlo', request);
  }

  getProjectionDefaults() {
    return this.http.get<ProjectionDefault[]>('/api/projections/defaults');
  }

  getHistoricalReturns(symbol: string) {
    return this.http.get<HistoricalReturn>(`/api/historical-returns/${encodeURIComponent(symbol)}`);
  }

  // Cashflow — Expense Categories
  getExpenseCategories() {
    return this.http.get<ExpenseCategory[]>('/api/expense-categories');
  }

  createExpenseCategory(request: CreateExpenseCategoryRequest) {
    return this.http.post<ExpenseCategory>('/api/expense-categories', request);
  }

  updateExpenseCategory(id: string, request: UpdateExpenseCategoryRequest) {
    return this.http.put<ExpenseCategory>(`/api/expense-categories/${id}`, request);
  }

  deleteExpenseCategory(id: string) {
    return this.http.delete(`/api/expense-categories/${id}`);
  }

  // Cashflow — Income Streams
  getIncomeStreams() {
    return this.http.get<IncomeStream[]>('/api/income-streams');
  }

  createIncomeStream(request: CreateIncomeStreamRequest) {
    return this.http.post<IncomeStream>('/api/income-streams', request);
  }

  updateIncomeStream(id: string, request: CreateIncomeStreamRequest) {
    return this.http.put<IncomeStream>(`/api/income-streams/${id}`, request);
  }

  deleteIncomeStream(id: string) {
    return this.http.delete(`/api/income-streams/${id}`);
  }

  // Cashflow — Expenses
  getExpenses() {
    return this.http.get<Expense[]>('/api/expenses');
  }

  createExpense(request: CreateExpenseRequest) {
    return this.http.post<Expense>('/api/expenses', request);
  }

  updateExpense(id: string, request: CreateExpenseRequest) {
    return this.http.put<Expense>(`/api/expenses/${id}`, request);
  }

  deleteExpense(id: string) {
    return this.http.delete(`/api/expenses/${id}`);
  }

  // Cashflow — Summary
  getCashflowSummary(params?: { view?: string }) {
    return this.http.get<CashflowSummary>('/api/cashflow/summary', { params: params as Record<string, string> });
  }
}
