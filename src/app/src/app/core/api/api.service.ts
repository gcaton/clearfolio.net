import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  TrendPoint,
  CompositionPoint,
  MemberComparison,
  SuperGap,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Reference
  getAssetTypes() {
    return this.http.get<AssetType[]>('/api/asset-types');
  }

  getLiabilityTypes() {
    return this.http.get<LiabilityType[]>('/api/liability-types');
  }

  // Household
  getHousehold() {
    return this.http.get<Household>('/api/household');
  }

  updateHousehold(request: UpdateHouseholdRequest) {
    return this.http.put<Household>('/api/household', request);
  }

  // Members
  getMembers() {
    return this.http.get<Member[]>('/api/members');
  }

  getCurrentMember() {
    return this.http.get<Member>('/api/members/me');
  }

  createMember(email: string, displayName: string) {
    return this.http.post<Member>('/api/members', { email, displayName });
  }

  updateMember(id: string, displayName: string) {
    return this.http.put<Member>(`/api/members/${id}`, { displayName });
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
  getDashboardSummary(params?: { period?: string; view?: string }) {
    return this.http.get<DashboardSummary>('/api/dashboard/summary', { params: params as Record<string, string> });
  }

  getDashboardTrend(params?: { periods?: number; view?: string }) {
    return this.http.get<TrendPoint[]>('/api/dashboard/trend', { params: params as Record<string, string> });
  }

  getDashboardComposition(params?: { period?: string }) {
    return this.http.get<CompositionPoint[]>('/api/dashboard/composition', { params: params as Record<string, string> });
  }

  getDashboardMembers(params?: { period?: string }) {
    return this.http.get<MemberComparison[]>('/api/dashboard/members', { params: params as Record<string, string> });
  }

  getSuperGap() {
    return this.http.get<SuperGap[]>('/api/dashboard/super-gap');
  }
}
