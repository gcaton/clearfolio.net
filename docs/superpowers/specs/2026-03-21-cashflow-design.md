# Cashflow Section Design

## Overview

Add a cashflow tracking layer to Clearfolio that serves as the source of truth for household finances. Tracks all income streams (per-member primary income plus additional sources) and categorised outgoings. Pulls in existing asset contributions and liability repayments to provide a complete financial picture with key metrics: savings rate, disposable income, net cashflow, breakdown charts, and debt-to-income ratio.

## Goals

- Track household income and expenses with full CRUD
- Calculate and display savings rate, disposable income, net cashflow, debt-to-income ratio
- Provide visual breakdowns (income vs expenses, spending by category)
- Integrate with existing contribution/repayment data without modifying those fields
- Add a dashboard summary widget for at-a-glance health
- Establish a reference data pattern in settings (starting with expense categories)

## Non-Goals

- Projection engine changes (future: income growth modelling, what-if scenarios)
- Period-based cashflow history (current budget only, representing "right now")
- Hard budget validation against contributions (visibility only, no enforcement)

## Data Model

### IncomeStream

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `HouseholdId` | Guid | FK to Households |
| `OwnerMemberId` | Guid | FK to Members |
| `Label` | string | e.g. "Greg's Salary", "Rental - 42 Smith St" |
| `IncomeType` | string | `Primary` or `Additional` |
| `Amount` | double | Per-period amount, must be > 0 |
| `Frequency` | string | Validated: weekly/fortnightly/monthly/quarterly/yearly |
| `IsActive` | bool | Soft delete / pause |
| `Notes` | string? | Optional |
| `CreatedAt` | string | ISO 8601 timestamp, set on creation |
| `UpdatedAt` | string | ISO 8601 timestamp, set on every update |

One primary income per member, enforced server-side: POST/PUT rejects a second `Primary` IncomeStream for the same `OwnerMemberId` with a 409 Conflict response. Additional streams are unlimited. The `IncomeType` discriminator lets the UI show primary income prominently per member with additional streams listed separately.

### Expense

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `HouseholdId` | Guid | FK to Households |
| `OwnerMemberId` | Guid? | FK to Members, nullable for household-level bills |
| `ExpenseCategoryId` | Guid | FK to ExpenseCategories |
| `Label` | string | e.g. "Mortgage", "Netflix" |
| `Amount` | double | Per-period amount, must be > 0 |
| `Frequency` | string | Validated: weekly/fortnightly/monthly/quarterly/yearly |
| `IsActive` | bool | |
| `Notes` | string? | |
| `CreatedAt` | string | ISO 8601 timestamp |
| `UpdatedAt` | string | ISO 8601 timestamp |

Owner is nullable because some expenses (mortgage, utilities) are household-level rather than tied to one person.

**View filtering for expenses:** When `view=p1` or `view=p2`, expenses with a matching `OwnerMemberId` show at full amount. Household-level expenses (null owner) are split 50/50 between members and included in both member views at half amount. This is simpler than the asset/liability joint-split model and appropriate for shared bills.

### ExpenseCategory

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `HouseholdId` | Guid | FK to Households |
| `Name` | string | e.g. "Housing", "Utilities" |
| `SortOrder` | int | Display ordering |
| `IsDefault` | bool | Seeded by app — cannot be deleted even if empty, to maintain baseline set |
| `CreatedAt` | string | ISO 8601 timestamp |

Custom categories (IsDefault = false) can be deleted only if they have no linked expenses (active or inactive). Default categories cannot be deleted at all.

**Default seed data** (per household, seeded on creation):

1. Housing
2. Utilities
3. Transport
4. Insurance
5. Subscriptions
6. Food & Groceries
7. Health
8. Personal
9. Education
10. Other

**Seeding trigger:** The `SetupMember` endpoint seeds default ExpenseCategories when creating a new household. A one-time data migration seeds categories for existing households.

### Relationship to Existing Models

- Asset `contributionAmount`/`contributionFrequency` remains as-is — cashflow page reads these to calculate total savings outflow
- Liability `repaymentAmount`/`repaymentFrequency` same — pulled into cashflow as debt service
- No foreign keys between Income/Expense and Asset/Liability — the link is purely at the aggregation/display layer
- Contributions are still edited on assets, repayments on liabilities — the cashflow page shows the full picture

### Cascade Behaviour

When a **member is deleted**: all IncomeStreams and Expenses owned by that member are deleted (same pattern as assets/liabilities in `MembersEndpoints.DeleteMember`).

When a **household is deleted**: all IncomeStreams, Expenses, and ExpenseCategories for the household are deleted (same pattern as `HouseholdEndpoints.DeleteHousehold`).

**Export/Import:** The existing export/import endpoints must be updated to include IncomeStreams, Expenses, and ExpenseCategories in the data payload.

### Validation Rules

- `Frequency` must be one of: `weekly`, `fortnightly`, `monthly`, `quarterly`, `yearly` — validated server-side, rejected with 400 Bad Request
- `Amount` must be > 0 (type: `double`, consistent with existing monetary fields)
- `Label` required, max 200 characters
- `Notes` optional, max 1000 characters
- `ExpenseCategory.Name` required, max 100 characters

## API Endpoints

All endpoints scoped to authenticated household via Cloudflare Access JWT.

### Income Streams — `/api/income-streams`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/income-streams` | List all for household |
| `POST` | `/api/income-streams` | Create |
| `PUT` | `/api/income-streams/{id}` | Update |
| `DELETE` | `/api/income-streams/{id}` | Soft delete (sets IsActive = false) |

**Create/Update request DTO:**

```json
{
  "ownerMemberId": "guid",
  "label": "string",
  "incomeType": "Primary|Additional",
  "amount": 0,
  "frequency": "monthly",
  "isActive": true,
  "notes": "string?"
}
```

### Expenses — `/api/expenses`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/expenses` | List all for household |
| `POST` | `/api/expenses` | Create |
| `PUT` | `/api/expenses/{id}` | Update |
| `DELETE` | `/api/expenses/{id}` | Soft delete (sets IsActive = false) |

**Create/Update request DTO:**

```json
{
  "ownerMemberId": "guid?",
  "expenseCategoryId": "guid",
  "label": "string",
  "amount": 0,
  "frequency": "monthly",
  "isActive": true,
  "notes": "string?"
}
```

### Expense Categories — `/api/expense-categories`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/expense-categories` | List all for household |
| `POST` | `/api/expense-categories` | Create custom |
| `PUT` | `/api/expense-categories/{id}` | Rename / reorder |
| `DELETE` | `/api/expense-categories/{id}` | Delete (fails if default or has expenses) |

**Create request DTO:**

```json
{
  "name": "string"
}
```

**Update request DTO:**

```json
{
  "name": "string",
  "sortOrder": 0
}
```

### Cashflow Summary — `/api/cashflow/summary`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/cashflow/summary?view={household\|p1\|p2}` | Aggregated metrics |

**Response shape:**

```json
{
  "totalAnnualIncome": 0,
  "totalAnnualExpenses": 0,
  "totalAnnualContributions": 0,
  "totalAnnualRepayments": 0,
  "disposableIncome": 0,
  "netCashflow": 0,
  "savingsRate": 0.0,
  "debtToIncomeRatio": 0.0,
  "incomeByMember": [
    { "memberTag": "p1", "displayName": "Greg", "annualIncome": 120000 }
  ],
  "expensesByCategory": [
    { "categoryName": "Housing", "annualAmount": 36000 }
  ]
}
```

**View filtering logic:**
- `household`: all income and expenses at full amounts
- `p1`/`p2`: income streams owned by that member at full amount; expenses owned by that member at full amount; household-level expenses (null owner) at 50% amount
- Contributions/repayments filtered using existing `ApplyViewFilter` logic (ownership type + joint split)

**Annualisation** reuses the existing frequency multipliers from `ProjectionEngine`: weekly × 52, fortnightly × 26, monthly × 12, quarterly × 4, yearly × 1.

## Frontend Components

### Cashflow Page — `/cashflow` route

`CashflowComponent` — standalone component following existing feature patterns. Added to `app.routes.ts` alongside existing routes. Navigation item added to the app sidebar/nav between Liabilities and Snapshots.

**Metrics Panel** (top of page):
- Card-style layout showing: Total Income, Total Expenses, Disposable Income, Net Cashflow, Savings Rate (% badge, colour-coded), Debt-to-Income Ratio (% badge, colour-coded)
- Contributions and repayments shown as read-only line items so the user sees the full picture

**Income Section:**
- PrimeNG `p-table` listing all income streams
- Columns: Label, Owner, Type (Primary/Additional badge), Amount, Frequency, Annualised
- Primary income shown first grouped by member, then additional streams
- Add/Edit via `p-dialog` form (form-grid pattern)

**Expenses Section:**
- PrimeNG `p-table` with row grouping by category
- Columns: Label, Category, Owner (or "Household"), Amount, Frequency, Annualised
- Category subtotals per group
- Add/Edit via `p-dialog` — category is a dropdown from ExpenseCategory list

**Breakdown Charts:**
- Income vs Expenses bar chart (side by side)
- Expense by category donut/pie chart
- Both using `ngx-echarts`, consistent with dashboard/projections charts

**View-state integration:** Reacts to `ViewStateService.view()` signal via `effect()`, re-fetches summary on view change.

### Dashboard Widget — `CashflowSummaryComponent`

Compact card embedded in the existing dashboard, placed after the net worth summary and before the composition breakdown:
- Savings rate (large number, colour-coded)
- Net cashflow (positive/negative with CurrencyDisplayComponent)
- Small income vs expenses horizontal stacked bar
- "View details" link to `/cashflow`

Reuses the `/api/cashflow/summary` endpoint.

### Settings — Reference Data Section

New section in the existing Settings page (not a new route):
- "Expense Categories" panel
- Reorderable list (drag or up/down arrows)
- Inline edit for renaming
- Add new / delete with guard (can't delete default categories; can't delete custom categories that have expenses)
- Designed to accommodate future reference data types as additional panels

## Database Migration

**New tables:** `IncomeStreams`, `Expenses`, `ExpenseCategories`

**Foreign keys:**
- `IncomeStreams.HouseholdId` → `Households.Id`
- `IncomeStreams.OwnerMemberId` → `Members.Id`
- `Expenses.HouseholdId` → `Households.Id`
- `Expenses.OwnerMemberId` → `Members.Id` (nullable)
- `Expenses.ExpenseCategoryId` → `ExpenseCategories.Id`
- `ExpenseCategories.HouseholdId` → `Households.Id`

**Indexes:** `HouseholdId` on all three tables, `ExpenseCategoryId` on `Expenses`.

**Seeding:** Default expense categories seeded per household on creation via `SetupMember`. One-time data migration seeds categories for existing households.

**Cascade deletes:** Member delete and household delete updated to include new tables (see Cascade Behaviour section).

## Projection Engine

No changes. The engine already works with per-asset contributions and per-liability repayments. Integration is at the display layer only — the cashflow page shows how contributions relate to the overall budget.

**Future extensions (out of scope):**
- What-if scenarios adjusting contribution allocations
- Income growth modelling in projections
- Budget enforcement / validation against disposable income
