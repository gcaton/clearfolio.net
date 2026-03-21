# Editable Asset Types & Liability Types

**Date:** 2026-03-22
**Status:** Draft

## Problem

Asset types and liability types are seeded as read-only system data. Users cannot rename, add, remove, or adjust defaults to suit their country or preferences (e.g. renaming "Superannuation" to "401(k)", adjusting default return rates for local markets, adding a type that doesn't exist in the seed data).

## Scope

- Add full CRUD for asset types and liability types (global, not per-household)
- Expand the Settings "Reference Data" tab to manage all three reference data sets (asset types, liability types, expense categories)
- Classification enums (category, liquidity, growthClass, debtQuality) remain hardcoded constants — not user-editable
- Seed data still populates on first DB creation; `isSystem` flag is informational only

## Assumptions

- This is a single-household self-hosted app. Global reference data is appropriate; per-household types are unnecessary complexity.
- Any authenticated user can create/update/delete types. No admin role is needed.

## API Changes

### Authentication

All mutating endpoints (POST/PUT/DELETE) require authentication via the existing `HouseholdMember` context pattern (`context.Items["HouseholdMember"]`). GET endpoints remain unauthenticated (unchanged). Return 401 if not authenticated.

### New Endpoints

All added to `ReferenceEndpoints.cs` alongside existing GET endpoints.

**Asset Types:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/asset-types` | Create a custom asset type |
| PUT | `/api/asset-types/{id}` | Update any asset type (including system) |
| DELETE | `/api/asset-types/{id}` | Delete if no assets reference it |

**Liability Types:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/liability-types` | Create a custom liability type |
| PUT | `/api/liability-types/{id}` | Update any liability type (including system) |
| DELETE | `/api/liability-types/{id}` | Delete if no liabilities reference it |

### Request DTOs

```csharp
// New file or added to existing DTOs
public record CreateAssetTypeRequest(
    string Name,
    string Category,        // cash | investable | property | retirement | other
    string Liquidity,       // immediate | short_term | long_term | restricted
    string GrowthClass,     // defensive | growth | mixed
    bool IsSuper,
    bool IsCgtExempt,
    double DefaultReturnRate,
    double DefaultVolatility);

public record UpdateAssetTypeRequest(
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
    bool IsSuper,
    bool IsCgtExempt,
    int SortOrder,
    double DefaultReturnRate,
    double DefaultVolatility);

public record CreateLiabilityTypeRequest(
    string Name,
    string Category,        // mortgage | personal | credit | student | tax | other
    string DebtQuality,     // productive | neutral | bad
    bool IsHecs);

public record UpdateLiabilityTypeRequest(
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs,
    int SortOrder);
```

### Validation

- `Name`: required, max 100 characters, trimmed, must be unique within asset types (or within liability types respectively) — return 400 on duplicate
- `Category`, `Liquidity`, `GrowthClass`, `DebtQuality`: validated against known value sets
- `DefaultReturnRate`, `DefaultVolatility`: no specific range constraints (negative rates are valid, e.g. vehicles at -10%)
- Delete: rejected with 400 if any assets/liabilities reference the type. Error message includes a generic message ("Cannot delete — this type is in use. Reassign or remove referencing items first.") — no count needed.
- On create, `SortOrder` is automatically set to `max(existing SortOrder) + 1`
- User-created types always have `IsSystem = false`

### Allowed Values

Asset type categories: `cash`, `investable`, `property`, `retirement`, `other`
Asset type liquidity: `immediate`, `short_term`, `long_term`, `restricted`
Asset type growth class: `defensive`, `growth`, `mixed`
Liability type categories: `mortgage`, `personal`, `credit`, `student`, `tax`, `other`
Liability type debt quality: `productive`, `neutral`, `bad`

## Frontend Changes

### API Service (`api.service.ts`)

Add methods:
- `createAssetType(request)`, `updateAssetType(id, request)`, `deleteAssetType(id)`
- `createLiabilityType(request)`, `updateLiabilityType(id, request)`, `deleteLiabilityType(id)`

Add request interfaces to `models.ts`.

### Settings "Reference Data" Tab

Replace the current flat expense-category list with three collapsible sections (PrimeNG Accordion):

1. **Asset Types** — table/list showing: name, category (as tag), key flags (Super, CGT Exempt), default return rate, default volatility. Actions: edit, delete, reorder (up/down), add.
2. **Liability Types** — table/list showing: name, category (as tag), key flags (HECS), debt quality. Actions: edit, delete, reorder, add.
3. **Expense Categories** — existing UI, moved into accordion panel, unchanged.

### Add/Edit Dialogs

**Asset Type Dialog:**
- Name (text input)
- Category (dropdown: cash, investable, property, retirement, other)
- Liquidity (dropdown: immediate, short_term, long_term, restricted)
- Growth Class (dropdown: defensive, growth, mixed)
- Is Super (checkbox)
- Is CGT Exempt (checkbox)
- Default Return Rate (number input, displayed as %)
- Default Volatility (number input, displayed as %)

**Liability Type Dialog:**
- Name (text input)
- Category (dropdown: mortgage, personal, credit, student, tax, other)
- Debt Quality (dropdown: productive, neutral, bad)
- Is HECS (checkbox)

### Delete Behaviour

- Confirmation dialog before delete
- If the type has assets/liabilities referencing it, the API returns 400 and the UI shows an error toast ("Cannot delete — this type is in use.")
- System types show a "Default" tag but can be edited and deleted like any other

## What Does Not Change

- Classification enum values remain hardcoded (not user-editable)
- Seed data still runs on first DB creation
- `isSystem` flag is preserved but does not restrict any operations
- Dashboard chart logic, projection engine, and all other consumers of asset/liability types continue to work — they read from the DB and don't hardcode type IDs
- Expense category CRUD is unchanged, just relocated into the accordion

## Files Modified

### Backend
- `Endpoints/ReferenceEndpoints.cs` — add POST/PUT/DELETE handlers
- `DTOs/AssetTypeDto.cs` — add request DTOs
- `DTOs/LiabilityTypeDto.cs` — add request DTOs
- `Filters/ValidationFilter.cs` — may need new validation if not using inline

### Frontend
- `core/api/models.ts` — add request interfaces
- `core/api/api.service.ts` — add CRUD methods
- `features/settings/settings.component.ts` — add asset type and liability type management logic
- `features/settings/settings.component.html` — replace flat list with accordion, add new sections and dialogs
