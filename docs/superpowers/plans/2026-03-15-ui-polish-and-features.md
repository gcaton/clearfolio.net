# UI Polish & Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline value recording, latest values on tables, dashboard period selector, toast notifications, loading skeletons, net worth change badges, goal tracking, CSV export, dark mode toggle, mobile responsive nav, and empty state improvements.

**Architecture:** All changes are additive — no existing endpoints change shape. Two new API endpoints needed (latest values per entity, net worth change calculation). Frontend changes are mostly within existing components plus a few new shared components.

**Tech Stack:** .NET 10 minimal APIs, Angular 21, PrimeNG (Skeleton, Sidebar, Toast, ProgressBar), ECharts, file-saver (CSV export)

---

## File Map

### API Changes
| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/api/Clearfolio.Api/Endpoints/SnapshotsEndpoints.cs` | Add `GET /api/snapshots/latest` endpoint |
| Modify | `src/api/Clearfolio.Api/Endpoints/DashboardEndpoints.cs` | Add change calculation to summary response |
| Modify | `src/api/Clearfolio.Api/DTOs/DashboardDto.cs` | Add change fields to summary DTO |
| Modify | `src/api/Clearfolio.Api/DTOs/SnapshotDto.cs` | Add LatestSnapshotDto |

### Angular Changes
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/src/app/shared/components/record-value-dialog.component.ts` | Reusable inline snapshot entry dialog |
| Create | `src/app/src/app/shared/components/loading-skeleton.component.ts` | Generic skeleton wrapper |
| Create | `src/app/src/app/shared/components/dark-mode-toggle.component.ts` | Dark mode switch |
| Create | `src/app/src/app/shared/components/mobile-nav.component.ts` | Responsive sidebar nav |
| Create | `src/app/src/app/shared/components/empty-state.component.ts` | Illustrated empty states |
| Create | `src/app/src/app/shared/components/net-worth-change.component.ts` | Change badge with arrow |
| Create | `src/app/src/app/features/settings/goal-settings.component.ts` | Goal configuration UI |
| Modify | `src/app/src/app/core/api/api.service.ts` | Add latestSnapshots, exportCsv methods |
| Modify | `src/app/src/app/core/api/models.ts` | Add LatestSnapshot, Goal interfaces |
| Modify | `src/app/src/app/features/assets/assets.component.ts` | Add latest values column, record value button |
| Modify | `src/app/src/app/features/assets/assets.component.html` | Add columns and buttons |
| Modify | `src/app/src/app/features/liabilities/liabilities.component.ts` | Same as assets |
| Modify | `src/app/src/app/features/liabilities/liabilities.component.html` | Same as assets |
| Modify | `src/app/src/app/features/dashboard/dashboard.component.ts` | Period selector, change badges, goal progress |
| Modify | `src/app/src/app/features/dashboard/dashboard.component.html` | Add selector, badges, goal bar |
| Modify | `src/app/src/app/features/dashboard/dashboard.component.scss` | Styles for new elements |
| Modify | `src/app/src/app/features/snapshots/snapshots.component.ts` | Add CSV export, toast on all actions |
| Modify | `src/app/src/app/app.ts` | Mobile nav, dark mode toggle |
| Modify | `src/app/src/app/app.scss` | Responsive styles, dark mode |
| Modify | `src/app/src/styles.scss` | Dark mode class |

---

## Chunk 1: API — Latest Snapshots & Net Worth Change

### Task 1: Add Latest Snapshots Endpoint

Returns the most recent snapshot value for each entity in the household.

**Files:**
- Modify: `src/api/Clearfolio.Api/DTOs/SnapshotDto.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/SnapshotsEndpoints.cs`

- [ ] **Step 1: Add LatestSnapshotDto**

In `DTOs/SnapshotDto.cs`, add:

```csharp
public record LatestSnapshotDto(
    Guid EntityId,
    string EntityType,
    string Period,
    double Value,
    string Currency);
```

- [ ] **Step 2: Add GetLatestSnapshots endpoint**

In `Endpoints/SnapshotsEndpoints.cs`, register the route in `MapSnapshotsEndpoints`:

```csharp
app.MapGet("/api/snapshots/latest", GetLatestSnapshots);
```

Add the handler:

```csharp
private static async Task<IResult> GetLatestSnapshots(HttpContext context, ClearfolioDbContext db)
{
    var member = GetMember(context);

    var latest = await db.Snapshots
        .AsNoTracking()
        .Where(s => s.HouseholdId == member.HouseholdId)
        .GroupBy(s => s.EntityId)
        .Select(g => g.OrderByDescending(s => s.Period).First())
        .Select(s => new LatestSnapshotDto(s.EntityId, s.EntityType, s.Period, s.Value, s.Currency))
        .ToListAsync();

    return Results.Ok(latest);
}
```

- [ ] **Step 3: Build and verify**

Run: `cd src/api && dotnet build`
Expected: Build succeeded, 0 errors

- [ ] **Step 4: Commit**

```
feat(api): add latest snapshots endpoint
```

---

### Task 2: Add Net Worth Change to Dashboard Summary

**Files:**
- Modify: `src/api/Clearfolio.Api/DTOs/DashboardDto.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/DashboardEndpoints.cs`

- [ ] **Step 1: Update DashboardSummaryDto**

Add change fields to the record in `DTOs/DashboardDto.cs`:

```csharp
public record DashboardSummaryDto(
    string Period,
    string View,
    double TotalAssets,
    double TotalLiabilities,
    double NetWorth,
    double? PreviousNetWorth,
    double? NetWorthChange,
    double? NetWorthChangePercent,
    List<CategoryBreakdownDto> AssetsByCategory,
    List<CategoryBreakdownDto> LiabilitiesByCategory,
    List<LiquidityBreakdownDto> LiquidityBreakdown,
    List<GrowthBreakdownDto> GrowthBreakdown,
    List<DebtQualityBreakdownDto> DebtQualityBreakdown);
```

- [ ] **Step 2: Update GetSummary to calculate change**

In `Endpoints/DashboardEndpoints.cs`, in the `GetSummary` method, after calculating current totals, add:

```csharp
var previousPeriod = PeriodHelper.PreviousPeriod(period);
var prevSnapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, previousPeriod);
var prevAssetTotal = CalculateAssetValues(prevSnapshots, assets, members, view).Sum(v => v.Value);
var prevLiabilityTotal = CalculateLiabilityValues(prevSnapshots, liabilities, members, view).Sum(v => v.Value);
var prevNetWorth = prevAssetTotal - prevLiabilityTotal;

double? previousNetWorth = prevSnapshots.Count > 0 ? prevNetWorth : null;
double? netWorthChange = previousNetWorth.HasValue ? (totalAssets - totalLiabilities) - previousNetWorth.Value : null;
double? netWorthChangePercent = previousNetWorth is > 0 ? (netWorthChange!.Value / previousNetWorth.Value) * 100 : null;
```

Update the return to include the new fields:

```csharp
return Results.Ok(new DashboardSummaryDto(
    period, view, totalAssets, totalLiabilities, totalAssets - totalLiabilities,
    previousNetWorth, netWorthChange, netWorthChangePercent,
    assetsByCategory, liabilitiesByCategory, liquidityBreakdown, growthBreakdown, debtQualityBreakdown));
```

(Keep the existing breakdown list variables — just add the three new fields between `NetWorth` and the lists.)

- [ ] **Step 3: Build and verify**

Run: `cd src/api && dotnet build`

- [ ] **Step 4: Rebuild API container and test**

```bash
just rebuild api
sleep 3
curl -s "http://localhost:5000/api/dashboard/summary" | python3 -m json.tool
```

Verify response includes `previousNetWorth`, `netWorthChange`, `netWorthChangePercent`.

- [ ] **Step 5: Commit**

```
feat(api): add net worth change to dashboard summary
```

---

## Chunk 2: Toast Notifications, Loading Skeletons, Empty States

### Task 3: Add Toast Notifications to Assets and Liabilities

Currently only Settings has toast notifications. Add them to Assets and Liabilities.

**Files:**
- Modify: `src/app/src/app/features/assets/assets.component.ts`
- Modify: `src/app/src/app/features/assets/assets.component.html`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.ts`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.html`

- [ ] **Step 1: Add Toast to Assets component**

In `assets.component.ts`:
- Add import: `import { Toast } from 'primeng/toast';` and `import { MessageService } from 'primeng/api';`
- Add `Toast` to `imports` array
- Add `MessageService` to `providers` array (alongside existing `ConfirmationService`)
- Add `private messageService = inject(MessageService);`
- In `save()`, after `this.loadAssets()` in both create and update subscribe callbacks, add:
  ```typescript
  this.messageService.add({ severity: 'success', summary: 'Saved', detail: current ? 'Asset updated' : 'Asset created' });
  ```
- In `confirmDelete` accept callback, after `this.loadAssets()`, add:
  ```typescript
  this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Asset removed' });
  ```

In `assets.component.html`:
- Add `<p-toast />` after the opening `<div class="page-header">` line (before it, at the top level)

- [ ] **Step 2: Add Toast to Liabilities component**

Same changes as Step 1 but for `liabilities.component.ts` and `liabilities.component.html`, with "Liability" in the messages.

- [ ] **Step 3: Build and verify**

Run: `cd src/app && npx ng build`

- [ ] **Step 4: Commit**

```
feat(app): add toast notifications to assets and liabilities
```

---

### Task 4: Create Empty State Component

**Files:**
- Create: `src/app/src/app/shared/components/empty-state.component.ts`

- [ ] **Step 1: Create component**

```typescript
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <div class="empty-icon">
        <i [class]="'pi ' + icon()" style="font-size: 2.5rem"></i>
      </div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }
    .empty-icon {
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      background: var(--p-surface-100, #f3f4f6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      color: var(--p-surface-400, #9ca3af);
    }
    h3 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
      color: var(--p-surface-700, #374151);
    }
    p {
      margin: 0;
      color: var(--p-surface-500, #6b7280);
      font-size: 0.875rem;
      max-width: 300px;
    }
  `,
})
export class EmptyStateComponent {
  icon = input<string>('pi-inbox');
  title = input<string>('No data yet');
  message = input<string>('');
}
```

- [ ] **Step 2: Use in Assets empty message**

In `assets.component.html`, replace the emptymessage `ng-template` content:

```html
<ng-template #emptymessage>
  <tr>
    <td colspan="7">
      <app-empty-state
        icon="pi-wallet"
        title="No assets yet"
        message="Add your first asset to start tracking your net worth."
      >
        <p-button label="Add Asset" icon="pi pi-plus" (onClick)="openNew()" />
      </app-empty-state>
    </td>
  </tr>
</ng-template>
```

Add `EmptyStateComponent` to the imports array.

- [ ] **Step 3: Use in Liabilities empty message**

Same pattern with `icon="pi-credit-card"`, `title="No liabilities yet"`, `message="Add your first liability to get a complete picture."`.

- [ ] **Step 4: Build and verify**

Run: `cd src/app && npx ng build`

- [ ] **Step 5: Commit**

```
feat(app): add empty state component with illustrations
```

---

### Task 5: Add Loading Skeletons

**Files:**
- Modify: `src/app/src/app/features/assets/assets.component.ts`
- Modify: `src/app/src/app/features/assets/assets.component.html`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.ts`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.html`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.html`

- [ ] **Step 1: Add loading signal to Assets**

In `assets.component.ts`:
- Add import: `import { Skeleton } from 'primeng/skeleton';`
- Add `Skeleton` to imports array
- Add signal: `protected loading = signal(true);`
- In `loadAssets()`, set `this.loading.set(true)` before the subscribe, and `this.loading.set(false)` inside the subscribe callback

In `assets.component.html`, wrap the table:

```html
@if (loading()) {
  <div class="skeleton-table">
    @for (i of [1,2,3,4,5]; track i) {
      <p-skeleton height="2.5rem" styleClass="mb-2" />
    }
  </div>
} @else {
  <p-table ...>...</p-table>
}
```

- [ ] **Step 2: Same for Liabilities**

- [ ] **Step 3: Add loading to Dashboard stat cards**

In `dashboard.component.html`, before the `@if (summary())` block:

```html
@if (!summary()) {
  <div class="stat-cards">
    @for (i of [1,2,3,4]; track i) {
      <div class="stat-card">
        <p-skeleton width="5rem" height="0.875rem" />
        <p-skeleton width="8rem" height="1.75rem" />
      </div>
    }
  </div>
}
```

Add `Skeleton` to dashboard imports.

- [ ] **Step 4: Build and verify**

Run: `cd src/app && npx ng build`

- [ ] **Step 5: Commit**

```
feat(app): add loading skeletons to tables and dashboard
```

---

## Chunk 3: Latest Values & Record Value from Asset/Liability Pages

### Task 6: Add Latest Value Column and Record Button

**Files:**
- Modify: `src/app/src/app/core/api/models.ts`
- Modify: `src/app/src/app/core/api/api.service.ts`
- Create: `src/app/src/app/shared/components/record-value-dialog.component.ts`
- Modify: `src/app/src/app/features/assets/assets.component.ts`
- Modify: `src/app/src/app/features/assets/assets.component.html`
- Modify: `src/app/src/app/features/assets/assets.component.scss`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.ts`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.html`

- [ ] **Step 1: Add models and API method**

In `models.ts`, add:

```typescript
export interface LatestSnapshot {
  entityId: string;
  entityType: string;
  period: string;
  value: number;
  currency: string;
}
```

In `api.service.ts`, add:

```typescript
getLatestSnapshots() {
  return this.http.get<LatestSnapshot[]>('/api/snapshots/latest');
}
```

- [ ] **Step 2: Create RecordValueDialogComponent**

```typescript
import { Component, ChangeDetectionStrategy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-record-value-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, InputNumber, InputText, Button],
  template: `
    <p-dialog
      header="Record Value"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '350px' }"
    >
      <div class="form-grid">
        <label>{{ entityLabel() }}</label>

        <label for="period">Period</label>
        <input pInputText id="period" [(ngModel)]="period" placeholder="e.g. FY2026-Q3" />

        <label for="value">Value</label>
        <p-inputnumber
          id="value"
          [(ngModel)]="value"
          mode="currency"
          currency="AUD"
          locale="en-AU"
        />
      </div>

      <ng-template #footer>
        <p-button label="Cancel" [text]="true" (onClick)="visible = false" />
        <p-button label="Save" (onClick)="save()" [disabled]="!period || !value" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      label { font-weight: 600; font-size: 0.875rem; color: var(--p-surface-700); }
    }
  `,
})
export class RecordValueDialogComponent {
  private api = inject(ApiService);

  entityId = input.required<string>();
  entityType = input.required<string>();
  entityLabel = input.required<string>();
  currency = input<string>('AUD');

  saved = output<void>();

  visible = false;
  period = '';
  value: number | null = null;

  open(currentPeriod?: string) {
    this.period = currentPeriod ?? '';
    this.value = null;
    this.visible = true;
  }

  save() {
    if (!this.value || !this.period) return;
    this.api.upsertSnapshot({
      entityId: this.entityId(),
      entityType: this.entityType(),
      period: this.period,
      value: this.value,
      currency: this.currency(),
      notes: null,
    }).subscribe(() => {
      this.visible = false;
      this.saved.emit();
    });
  }
}
```

- [ ] **Step 3: Update Assets component**

In `assets.component.ts`:
- Add imports for `RecordValueDialogComponent` and `LatestSnapshot`
- Add `RecordValueDialogComponent` to component imports
- Add signal: `protected latestValues = signal<Map<string, LatestSnapshot>>(new Map());`
- In `loadAssets()`, also call:
  ```typescript
  this.api.getLatestSnapshots().subscribe((snapshots) => {
    const map = new Map(snapshots.filter(s => s.entityType === 'asset').map(s => [s.entityId, s]));
    this.latestValues.set(map);
  });
  ```
- Add method: `getLatestValue(assetId: string): LatestSnapshot | undefined { return this.latestValues().get(assetId); }`
- Add `ViewChild` ref for the dialog isn't needed since we use a per-row approach. Instead, add signal for inline recording:
  ```typescript
  protected recordingAssetId = signal<string | null>(null);
  protected recordingLabel = signal('');
  ```

In `assets.component.html`:
- Add column header `<th style="text-align: right">Latest Value</th>` after Currency
- Add column body:
  ```html
  <td style="text-align: right; font-variant-numeric: tabular-nums;">
    @if (getLatestValue(asset.id); as lv) {
      <span class="latest-value">{{ lv.value | number: '1.0-0' }}</span>
      <span class="latest-period">{{ lv.period }}</span>
    } @else {
      <span class="no-value">—</span>
    }
  </td>
  ```
- Add a record button in the actions column:
  ```html
  <p-button icon="pi pi-dollar" [rounded]="true" [text]="true" severity="success"
    pTooltip="Record value" (onClick)="recordDialog.entityId = asset.id; recordDialog.open()" />
  ```
- Add `<app-record-value-dialog #recordDialog ... />` at the bottom

Update colspan in emptymessage to 8.

In `assets.component.scss`, add:
```scss
.latest-value {
  font-weight: 600;
}
.latest-period {
  display: block;
  font-size: 0.75rem;
  color: var(--p-surface-400);
}
.no-value {
  color: var(--p-surface-300);
}
```

- [ ] **Step 4: Same changes for Liabilities**

Same pattern but filter by `entityType === 'liability'`.

- [ ] **Step 5: Build and verify**

Run: `cd src/app && npx ng build`

- [ ] **Step 6: Commit**

```
feat(app): add latest value column and inline record button to asset/liability tables
```

---

## Chunk 4: Dashboard Period Selector & Net Worth Change Badge

### Task 7: Dashboard Period Selector

**Files:**
- Modify: `src/app/src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.html`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.scss`

- [ ] **Step 1: Add period selection to dashboard**

In `dashboard.component.ts`:
- Add imports for `PeriodSelectorComponent`, `PeriodLabelPipe`, `Select`, `FormsModule`
- Add signal: `protected selectedPeriod = signal<string | null>(null);`
- Update `loadData()` to accept optional period and pass it to `getDashboardSummary`:
  ```typescript
  private loadData(view: string) {
    const period = this.selectedPeriod() ?? undefined;
    this.api.getDashboardSummary({ view, period }).subscribe((d) => this.summary.set(d));
    this.api.getDashboardTrend({ periods: 8, view }).subscribe((d) => this.trend.set(d));
    this.api.getDashboardComposition({ period }).subscribe((d) => this.composition.set(d));
    this.api.getDashboardMembers({ period }).subscribe((d) => this.members.set(d));
    this.api.getSuperGap().subscribe((d) => this.superGap.set(d));
  }
  ```
- Add method:
  ```typescript
  onPeriodChange(period: string) {
    this.selectedPeriod.set(period);
    this.loadData(this.viewState.view());
  }
  ```

In `dashboard.component.html`, add above the stat cards:

```html
<div class="dashboard-header">
  <h1>Dashboard</h1>
  <app-period-selector (periodChange)="onPeriodChange($event)" />
</div>
```

In `dashboard.component.scss`:
```scss
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
```

- [ ] **Step 2: Build and verify**

- [ ] **Step 3: Commit**

```
feat(app): add period selector to dashboard
```

---

### Task 8: Net Worth Change Badge

**Files:**
- Create: `src/app/src/app/shared/components/net-worth-change.component.ts`
- Modify: `src/app/src/app/core/api/models.ts`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.html`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.scss`

- [ ] **Step 1: Update DashboardSummary model**

In `models.ts`, update the `DashboardSummary` interface:

```typescript
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
```

- [ ] **Step 2: Create NetWorthChangeComponent**

```typescript
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-net-worth-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    @if (change() !== null) {
      <span class="change-badge" [class]="direction()">
        <i [class]="'pi ' + (isUp() ? 'pi-arrow-up' : 'pi-arrow-down')"></i>
        {{ absChange() | currency: 'AUD' : 'symbol-narrow' : '1.0-0' }}
        @if (percent() !== null) {
          ({{ absPercent() | number: '1.1-1' }}%)
        }
      </span>
    }
  `,
  styles: `
    .change-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
    }
    .up {
      color: var(--p-green-700, #15803d);
      background: var(--p-green-50, #f0fdf4);
    }
    .down {
      color: var(--p-red-700, #b91c1c);
      background: var(--p-red-50, #fef2f2);
    }
  `,
})
export class NetWorthChangeComponent {
  change = input.required<number | null>();
  percent = input.required<number | null>();

  protected isUp = computed(() => (this.change() ?? 0) >= 0);
  protected direction = computed(() => this.isUp() ? 'up' : 'down');
  protected absChange = computed(() => Math.abs(this.change() ?? 0));
  protected absPercent = computed(() => Math.abs(this.percent() ?? 0));
}
```

- [ ] **Step 3: Add to dashboard**

In `dashboard.component.ts`, add `NetWorthChangeComponent` to imports.

In `dashboard.component.html`, in the Net Worth stat card, after `<app-currency>`:

```html
<div class="stat-card highlight">
  <span class="stat-label">Net Worth</span>
  <app-currency [value]="s.netWorth" [colorize]="true" />
  <app-net-worth-change [change]="s.netWorthChange" [percent]="s.netWorthChangePercent" />
</div>
```

- [ ] **Step 4: Build and verify**

- [ ] **Step 5: Commit**

```
feat(app): add net worth change badge to dashboard
```

---

## Chunk 5: Dark Mode, Mobile Nav, CSV Export

### Task 9: Dark Mode Toggle

**Files:**
- Create: `src/app/src/app/shared/components/dark-mode-toggle.component.ts`
- Modify: `src/app/src/app/app.ts`
- Modify: `src/app/src/app/app.config.ts`

- [ ] **Step 1: Create DarkModeToggleComponent**

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ToggleButton } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dark-mode-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleButton, FormsModule],
  template: `
    <p-togglebutton
      [(ngModel)]="dark"
      onIcon="pi pi-moon"
      offIcon="pi pi-sun"
      (ngModelChange)="toggle($event)"
      [style]="{ width: '2.5rem', height: '2.5rem' }"
    />
  `,
})
export class DarkModeToggleComponent {
  dark = this.loadPreference();

  constructor() {
    this.applyTheme(this.dark);
  }

  toggle(dark: boolean) {
    this.applyTheme(dark);
    localStorage.setItem('clearfolio_dark', String(dark));
  }

  private applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('app-dark', dark);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem('clearfolio_dark');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
```

- [ ] **Step 2: Configure PrimeNG dark mode selector**

In `app.config.ts`, update the `providePrimeNG` config:

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
}),
```

- [ ] **Step 3: Add to app nav**

In `app.ts`:
- Add `DarkModeToggleComponent` to imports
- Add `<app-dark-mode-toggle />` in the `nav-right` div, before the view toggle

- [ ] **Step 4: Build and verify**

- [ ] **Step 5: Commit**

```
feat(app): add dark mode toggle with localStorage persistence
```

---

### Task 10: Mobile Responsive Nav

**Files:**
- Modify: `src/app/src/app/app.ts`
- Modify: `src/app/src/app/app.scss`

- [ ] **Step 1: Add mobile sidebar**

In `app.ts`:
- Add imports: `import { Sidebar } from 'primeng/sidebar';` and `import { Button } from 'primeng/button';`
- Add to component imports: `Sidebar, Button`
- Add signal: `protected mobileMenuVisible = signal(false);`

Update template — add a hamburger button (visible only on mobile) and a sidebar:

```html
<nav class="app-nav">
  <div class="nav-brand">
    <p-button icon="pi pi-bars" [text]="true" class="mobile-menu-btn"
      (onClick)="mobileMenuVisible.set(true)" />
    <a routerLink="/dashboard" class="brand-link">clearfolio</a>
  </div>
  <div class="nav-links desktop-only">
    ...existing links...
  </div>
  <div class="nav-right">
    ...existing content...
  </div>
</nav>

<p-sidebar [(visible)]="mobileMenuVisible" [showCloseIcon]="true" styleClass="mobile-nav-sidebar">
  <nav class="mobile-nav">
    <a routerLink="/dashboard" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Dashboard</a>
    <a routerLink="/assets" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Assets</a>
    <a routerLink="/liabilities" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Liabilities</a>
    <a routerLink="/snapshots" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Snapshots</a>
    <a routerLink="/settings" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Settings</a>
  </nav>
</p-sidebar>
```

- [ ] **Step 2: Add responsive styles**

In `app.scss`, add:

```scss
.mobile-menu-btn {
  display: none;
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 1rem;

  a {
    padding: 0.75rem 1rem;
    color: var(--p-surface-700);
    text-decoration: none;
    border-radius: var(--p-border-radius);
    font-size: 1rem;

    &:hover { background: var(--p-surface-100); }
    &.active { color: var(--p-primary-600); background: var(--p-primary-50); font-weight: 600; }
  }
}

@media (max-width: 768px) {
  .desktop-only { display: none; }
  .mobile-menu-btn { display: inline-flex; }
  .nav-right { gap: 0.5rem; }
  .app-content { padding: 1rem; }
  .stat-cards { grid-template-columns: repeat(2, 1fr); }
  .chart-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

```
feat(app): add mobile responsive nav with sidebar
```

---

### Task 11: CSV Export for Snapshots

**Files:**
- Modify: `src/app/src/app/features/snapshots/snapshots.component.ts`
- Modify: `src/app/src/app/features/snapshots/snapshots.component.html`

- [ ] **Step 1: Add export method**

In `snapshots.component.ts`, add a method:

```typescript
exportCsv() {
  const data = this.snapshots();
  if (data.length === 0) return;

  const headers = ['Entity', 'Type', 'Period', 'Value', 'Currency', 'Recorded By', 'Recorded At'];
  const rows = data.map((s) => [
    this.getTargetLabel(s.entityId),
    s.entityType,
    s.period,
    s.value,
    s.currency,
    s.recordedByName,
    s.recordedAt,
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `snapshots-${this.selectedPeriod()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add export button**

In `snapshots.component.html`, in the `header-actions` div, add:

```html
<p-button label="Export CSV" icon="pi pi-download" severity="secondary"
  [disabled]="snapshots().length === 0" (onClick)="exportCsv()" />
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

```
feat(app): add CSV export for snapshots
```

---

## Chunk 6: Goal Tracking

### Task 12: Goal Tracking

This is a frontend-only feature — stores goals in localStorage (no API needed for personal use). Shows a progress bar on the dashboard.

**Files:**
- Create: `src/app/src/app/core/auth/goal.service.ts`
- Modify: `src/app/src/app/features/settings/settings.component.ts`
- Modify: `src/app/src/app/features/settings/settings.component.html`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.html`
- Modify: `src/app/src/app/features/dashboard/dashboard.component.scss`

- [ ] **Step 1: Create GoalService**

```typescript
import { Injectable, signal, computed } from '@angular/core';

export interface Goal {
  netWorthTarget: number | null;
  superTarget: number | null;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private _goal = signal<Goal>(this.load());

  readonly goal = this._goal.asReadonly();

  setGoal(goal: Goal) {
    this._goal.set(goal);
    localStorage.setItem('clearfolio_goals', JSON.stringify(goal));
  }

  private load(): Goal {
    const stored = localStorage.getItem('clearfolio_goals');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return { netWorthTarget: null, superTarget: null };
  }
}
```

- [ ] **Step 2: Add Goals tab to Settings**

In `settings.component.ts`:
- Import `GoalService`, `InputNumber`
- Inject `goalService`
- Add properties: `netWorthTarget` and `superTarget` initialized from `goalService.goal()`
- Add `saveGoals()` method

In `settings.component.html`, add a third tab "Goals":

```html
<p-tab value="2">Goals</p-tab>
...
<p-tabpanel value="2">
  <div class="settings-form">
    <label for="nwTarget">Net Worth Target</label>
    <p-inputnumber id="nwTarget" [(ngModel)]="netWorthTarget"
      mode="currency" currency="AUD" locale="en-AU" />

    <label for="superTarget">Super Target</label>
    <p-inputnumber id="superTarget" [(ngModel)]="superTarget"
      mode="currency" currency="AUD" locale="en-AU" />

    <p-button label="Save Goals" icon="pi pi-check" (onClick)="saveGoals()" />
  </div>
</p-tabpanel>
```

- [ ] **Step 3: Show progress on Dashboard**

In `dashboard.component.ts`:
- Import `GoalService`, `ProgressBar` from `primeng/progressbar`
- Inject `goalService`
- Add computed signals:
  ```typescript
  protected netWorthGoal = computed(() => this.goalService.goal().netWorthTarget);
  protected netWorthProgress = computed(() => {
    const target = this.netWorthGoal();
    const current = this.summary()?.netWorth ?? 0;
    if (!target || target <= 0) return null;
    return Math.min(Math.round((current / target) * 100), 100);
  });
  ```

In `dashboard.component.html`, after the stat cards, before the chart grid:

```html
@if (netWorthProgress() !== null) {
  <div class="goal-progress">
    <div class="goal-header">
      <span class="goal-label">Net Worth Goal</span>
      <span class="goal-target">
        {{ netWorthProgress() }}% of
        <app-currency [value]="netWorthGoal()!" />
      </span>
    </div>
    <p-progressbar [value]="netWorthProgress()!" [showValue]="false" />
  </div>
}
```

In `dashboard.component.scss`:
```scss
.goal-progress {
  margin-bottom: 1.5rem;
  background: var(--p-surface-0, #fff);
  border: 1px solid var(--p-surface-200, #e5e7eb);
  border-radius: 0.5rem;
  padding: 1rem;
}
.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.goal-label { font-weight: 600; font-size: 0.875rem; }
.goal-target { font-size: 0.8125rem; color: var(--p-surface-500); }
```

- [ ] **Step 4: Build and verify**

- [ ] **Step 5: Commit**

```
feat(app): add goal tracking with progress bar on dashboard
```

---

## Chunk 7: Final Polish

### Task 13: Update Favicon and App Title

**Files:**
- Modify: `src/app/src/index.html`

- [ ] **Step 1: Update title and meta**

In `index.html`, change:

```html
<title>Clearfolio</title>
<meta name="description" content="Household net worth tracker">
```

- [ ] **Step 2: Commit**

```
chore(app): update page title and meta description
```

---

### Task 14: Confirmation Before Leaving Unsaved Bulk Entry

**Files:**
- Modify: `src/app/src/app/features/snapshots/snapshots.component.ts`
- Modify: `src/app/src/app/features/snapshots/snapshots.component.html`

- [ ] **Step 1: Add dirty check to bulk dialog**

In `snapshots.component.ts`, add computed:

```typescript
protected bulkDirty = computed(() => this.bulkGrid().some(c => c.value !== null && c.value > 0));
```

Update the bulk dialog's close behavior — in the template, change the Cancel button:

```typescript
closeBulk() {
  if (this.bulkDirty()) {
    this.confirmService.confirm({
      message: 'You have unsaved values. Discard changes?',
      header: 'Unsaved Changes',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.bulkVisible.set(false),
    });
  } else {
    this.bulkVisible.set(false);
  }
}
```

In template, change Cancel button: `(onClick)="closeBulk()"` and add `[closable]="false"` to the dialog to prevent clicking X from bypassing the check, then add a custom close button.

- [ ] **Step 2: Build and verify**

- [ ] **Step 3: Commit**

```
feat(app): add unsaved changes warning on bulk entry
```

---

### Task 15: Final Build, Test, and Push

- [ ] **Step 1: Full build**

```bash
cd src/api && dotnet build
cd ../app && npx ng build
```

- [ ] **Step 2: Rebuild containers and smoke test**

```bash
just init
sleep 5
curl -s http://localhost:5000/api/dashboard/summary | python3 -m json.tool
curl -s http://localhost:5000/api/snapshots/latest | python3 -m json.tool
```

- [ ] **Step 3: Final commit and push**

```
chore: final polish build verification
```

```bash
git push
```
