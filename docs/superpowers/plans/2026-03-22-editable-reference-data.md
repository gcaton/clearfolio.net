# Editable Reference Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD for asset types and liability types so users can customise reference data.

**Architecture:** Extend `ReferenceEndpoints.cs` with POST/PUT/DELETE handlers following the existing expense-categories pattern. Expand the Settings "Reference Data" tab from a flat expense-category list to an accordion with three panels (asset types, liability types, expense categories).

**Tech Stack:** .NET 10 minimal API, EF Core, SQLite, Angular 19, PrimeNG, MSTest

**Spec:** `docs/superpowers/specs/2026-03-22-editable-reference-data-design.md`

---

## File Map

### Backend (all paths relative to `src/api/Clearfolio.Api/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `DTOs/AssetTypeDto.cs` | Modify | Add `CreateAssetTypeRequest`, `UpdateAssetTypeRequest` records |
| `DTOs/LiabilityTypeDto.cs` | Modify | Add `CreateLiabilityTypeRequest`, `UpdateLiabilityTypeRequest` records |
| `Endpoints/ReferenceEndpoints.cs` | Modify | Add POST/PUT/DELETE for both asset types and liability types |

### Backend Tests (relative to `src/api/Clearfolio.Tests/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `ReferenceEndpointTests.cs` | Create | Unit tests for validation logic extracted into static helpers |

### Frontend (all paths relative to `src/app/src/app/`)
| File | Action | Responsibility |
|------|--------|----------------|
| `core/api/models.ts` | Modify | Add request interfaces for asset type and liability type CRUD |
| `core/api/api.service.ts` | Modify | Add CRUD methods for asset types and liability types |
| `features/settings/settings.component.ts` | Modify | Add asset type and liability type management logic |
| `features/settings/settings.component.html` | Modify | Replace flat list with accordion; add asset type and liability type panels and dialogs |

---

### Task 1: Backend DTOs

**Files:**
- Modify: `src/api/Clearfolio.Api/DTOs/AssetTypeDto.cs`
- Modify: `src/api/Clearfolio.Api/DTOs/LiabilityTypeDto.cs`

- [ ] **Step 1: Add asset type request DTOs**

Add to `src/api/Clearfolio.Api/DTOs/AssetTypeDto.cs`:

```csharp
public record CreateAssetTypeRequest(
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
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
```

- [ ] **Step 2: Add liability type request DTOs**

Add to `src/api/Clearfolio.Api/DTOs/LiabilityTypeDto.cs`:

```csharp
public record CreateLiabilityTypeRequest(
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs);

public record UpdateLiabilityTypeRequest(
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs,
    int SortOrder);
```

- [ ] **Step 3: Verify build**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add src/api/Clearfolio.Api/DTOs/AssetTypeDto.cs src/api/Clearfolio.Api/DTOs/LiabilityTypeDto.cs
git commit -m "feat(api): add request DTOs for asset type and liability type CRUD"
```

---

### Task 2: Asset Type CRUD Endpoints

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/ReferenceEndpoints.cs`

- [ ] **Step 1: Add allowed-value sets and auth helper**

Add these at the top of the `ReferenceEndpoints` class:

```csharp
private static readonly HashSet<string> AssetCategories = ["cash", "investable", "property", "retirement", "other"];
private static readonly HashSet<string> AssetLiquidity = ["immediate", "short_term", "long_term", "restricted"];
private static readonly HashSet<string> GrowthClasses = ["defensive", "growth", "mixed"];
private static readonly HashSet<string> LiabilityCategories = ["mortgage", "personal", "credit", "student", "tax", "other"];
private static readonly HashSet<string> DebtQualities = ["productive", "neutral", "bad"];

private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
    context.Items["HouseholdMember"] as HouseholdMember;
```

- [ ] **Step 2: Register asset type CRUD routes**

Update `MapReferenceEndpoints` to register the new routes:

```csharp
public static WebApplication MapReferenceEndpoints(this WebApplication app)
{
    app.MapGet("/api/asset-types", GetAssetTypes);
    app.MapPost("/api/asset-types", CreateAssetType);
    app.MapPut("/api/asset-types/{id:guid}", UpdateAssetType);
    app.MapDelete("/api/asset-types/{id:guid}", DeleteAssetType);

    app.MapGet("/api/liability-types", GetLiabilityTypes);
    // liability type CRUD routes added in Task 3

    return app;
}
```

- [ ] **Step 3: Implement CreateAssetType**

```csharp
private static async Task<IResult> CreateAssetType(CreateAssetTypeRequest request, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var name = request.Name?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 100)
        return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");
    if (!AssetCategories.Contains(request.Category))
        return ApiErrors.BadRequest($"Category must be one of: {string.Join(", ", AssetCategories)}.");
    if (!AssetLiquidity.Contains(request.Liquidity))
        return ApiErrors.BadRequest($"Liquidity must be one of: {string.Join(", ", AssetLiquidity)}.");
    if (!GrowthClasses.Contains(request.GrowthClass))
        return ApiErrors.BadRequest($"GrowthClass must be one of: {string.Join(", ", GrowthClasses)}.");

    var duplicate = await db.AssetTypes.AnyAsync(t => t.Name == name);
    if (duplicate)
        return ApiErrors.BadRequest("An asset type with this name already exists.");

    var maxSort = await db.AssetTypes.MaxAsync(t => (int?)t.SortOrder) ?? 0;

    var assetType = new AssetType
    {
        Id = Guid.NewGuid(),
        Name = name,
        Category = request.Category,
        Liquidity = request.Liquidity,
        GrowthClass = request.GrowthClass,
        IsSuper = request.IsSuper,
        IsCgtExempt = request.IsCgtExempt,
        SortOrder = maxSort + 1,
        IsSystem = false,
        DefaultReturnRate = request.DefaultReturnRate,
        DefaultVolatility = request.DefaultVolatility,
    };

    db.AssetTypes.Add(assetType);
    await db.SaveChangesAsync();

    return Results.Created($"/api/asset-types/{assetType.Id}",
        new AssetTypeDto(assetType.Id, assetType.Name, assetType.Category, assetType.Liquidity,
            assetType.GrowthClass, assetType.IsSuper, assetType.IsCgtExempt, assetType.SortOrder,
            assetType.IsSystem, assetType.DefaultReturnRate, assetType.DefaultVolatility));
}
```

- [ ] **Step 4: Implement UpdateAssetType**

```csharp
private static async Task<IResult> UpdateAssetType(Guid id, UpdateAssetTypeRequest request, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var assetType = await db.AssetTypes.FirstOrDefaultAsync(t => t.Id == id);
    if (assetType is null) return Results.NotFound();

    var name = request.Name?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 100)
        return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");
    if (!AssetCategories.Contains(request.Category))
        return ApiErrors.BadRequest($"Category must be one of: {string.Join(", ", AssetCategories)}.");
    if (!AssetLiquidity.Contains(request.Liquidity))
        return ApiErrors.BadRequest($"Liquidity must be one of: {string.Join(", ", AssetLiquidity)}.");
    if (!GrowthClasses.Contains(request.GrowthClass))
        return ApiErrors.BadRequest($"GrowthClass must be one of: {string.Join(", ", GrowthClasses)}.");

    var duplicate = await db.AssetTypes.AnyAsync(t => t.Name == name && t.Id != id);
    if (duplicate)
        return ApiErrors.BadRequest("An asset type with this name already exists.");

    assetType.Name = name;
    assetType.Category = request.Category;
    assetType.Liquidity = request.Liquidity;
    assetType.GrowthClass = request.GrowthClass;
    assetType.IsSuper = request.IsSuper;
    assetType.IsCgtExempt = request.IsCgtExempt;
    assetType.SortOrder = request.SortOrder;
    assetType.DefaultReturnRate = request.DefaultReturnRate;
    assetType.DefaultVolatility = request.DefaultVolatility;
    await db.SaveChangesAsync();

    return Results.Ok(new AssetTypeDto(assetType.Id, assetType.Name, assetType.Category, assetType.Liquidity,
        assetType.GrowthClass, assetType.IsSuper, assetType.IsCgtExempt, assetType.SortOrder,
        assetType.IsSystem, assetType.DefaultReturnRate, assetType.DefaultVolatility));
}
```

- [ ] **Step 5: Implement DeleteAssetType**

```csharp
private static async Task<IResult> DeleteAssetType(Guid id, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var assetType = await db.AssetTypes.FirstOrDefaultAsync(t => t.Id == id);
    if (assetType is null) return Results.NotFound();

    var inUse = await db.Assets.AnyAsync(a => a.AssetTypeId == id);
    if (inUse)
        return ApiErrors.BadRequest("Cannot delete — this type is in use. Reassign or remove referencing assets first.");

    db.AssetTypes.Remove(assetType);
    await db.SaveChangesAsync();

    return Results.NoContent();
}
```

- [ ] **Step 6: Add required usings**

Ensure these usings are at the top of `ReferenceEndpoints.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;
```

**Note:** The existing codebase uses `ValidationFilter` on expense category endpoints. For reference type endpoints we use inline validation instead since the validation is more complex (enum set checks, uniqueness). This is intentional — `ValidationFilter` only checks data annotation attributes and these DTOs have richer validation needs.

- [ ] **Step 7: Verify build**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded.

- [ ] **Step 8: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/ReferenceEndpoints.cs
git commit -m "feat(api): add CRUD endpoints for asset types"
```

---

### Task 3: Liability Type CRUD Endpoints

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/ReferenceEndpoints.cs`

- [ ] **Step 1: Register liability type CRUD routes**

Update `MapReferenceEndpoints` to add the remaining routes:

```csharp
app.MapPost("/api/liability-types", CreateLiabilityType);
app.MapPut("/api/liability-types/{id:guid}", UpdateLiabilityType);
app.MapDelete("/api/liability-types/{id:guid}", DeleteLiabilityType);
```

- [ ] **Step 2: Implement CreateLiabilityType**

```csharp
private static async Task<IResult> CreateLiabilityType(CreateLiabilityTypeRequest request, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var name = request.Name?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 100)
        return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");
    if (!LiabilityCategories.Contains(request.Category))
        return ApiErrors.BadRequest($"Category must be one of: {string.Join(", ", LiabilityCategories)}.");
    if (!DebtQualities.Contains(request.DebtQuality))
        return ApiErrors.BadRequest($"DebtQuality must be one of: {string.Join(", ", DebtQualities)}.");

    var duplicate = await db.LiabilityTypes.AnyAsync(t => t.Name == name);
    if (duplicate)
        return ApiErrors.BadRequest("A liability type with this name already exists.");

    var maxSort = await db.LiabilityTypes.MaxAsync(t => (int?)t.SortOrder) ?? 0;

    var liabilityType = new LiabilityType
    {
        Id = Guid.NewGuid(),
        Name = name,
        Category = request.Category,
        DebtQuality = request.DebtQuality,
        IsHecs = request.IsHecs,
        SortOrder = maxSort + 1,
        IsSystem = false,
    };

    db.LiabilityTypes.Add(liabilityType);
    await db.SaveChangesAsync();

    return Results.Created($"/api/liability-types/{liabilityType.Id}",
        new LiabilityTypeDto(liabilityType.Id, liabilityType.Name, liabilityType.Category,
            liabilityType.DebtQuality, liabilityType.IsHecs, liabilityType.SortOrder, liabilityType.IsSystem));
}
```

- [ ] **Step 3: Implement UpdateLiabilityType**

```csharp
private static async Task<IResult> UpdateLiabilityType(Guid id, UpdateLiabilityTypeRequest request, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var liabilityType = await db.LiabilityTypes.FirstOrDefaultAsync(t => t.Id == id);
    if (liabilityType is null) return Results.NotFound();

    var name = request.Name?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 100)
        return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");
    if (!LiabilityCategories.Contains(request.Category))
        return ApiErrors.BadRequest($"Category must be one of: {string.Join(", ", LiabilityCategories)}.");
    if (!DebtQualities.Contains(request.DebtQuality))
        return ApiErrors.BadRequest($"DebtQuality must be one of: {string.Join(", ", DebtQualities)}.");

    var duplicate = await db.LiabilityTypes.AnyAsync(t => t.Name == name && t.Id != id);
    if (duplicate)
        return ApiErrors.BadRequest("A liability type with this name already exists.");

    liabilityType.Name = name;
    liabilityType.Category = request.Category;
    liabilityType.DebtQuality = request.DebtQuality;
    liabilityType.IsHecs = request.IsHecs;
    liabilityType.SortOrder = request.SortOrder;
    await db.SaveChangesAsync();

    return Results.Ok(new LiabilityTypeDto(liabilityType.Id, liabilityType.Name, liabilityType.Category,
        liabilityType.DebtQuality, liabilityType.IsHecs, liabilityType.SortOrder, liabilityType.IsSystem));
}
```

- [ ] **Step 4: Implement DeleteLiabilityType**

```csharp
private static async Task<IResult> DeleteLiabilityType(Guid id, HttpContext context, ClearfolioDbContext db)
{
    if (GetMemberOrNull(context) is null) return Results.Unauthorized();

    var liabilityType = await db.LiabilityTypes.FirstOrDefaultAsync(t => t.Id == id);
    if (liabilityType is null) return Results.NotFound();

    var inUse = await db.Liabilities.AnyAsync(l => l.LiabilityTypeId == id);
    if (inUse)
        return ApiErrors.BadRequest("Cannot delete — this type is in use. Reassign or remove referencing liabilities first.");

    db.LiabilityTypes.Remove(liabilityType);
    await db.SaveChangesAsync();

    return Results.NoContent();
}
```

- [ ] **Step 5: Verify build and run existing tests**

Run: `dotnet build src/api/Clearfolio.Api/ && dotnet test src/api/Clearfolio.Tests/`
Expected: Build succeeded. All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/ReferenceEndpoints.cs
git commit -m "feat(api): add CRUD endpoints for liability types"
```

---

### Task 4: Frontend Models & API Service

**Files:**
- Modify: `src/app/src/app/core/api/models.ts`
- Modify: `src/app/src/app/core/api/api.service.ts`

- [ ] **Step 1: Add request interfaces to models.ts**

Add after the existing `AssetType` interface (around line 36):

```typescript
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
```

Add after the existing `LiabilityType` interface (around line 46):

```typescript
export interface CreateLiabilityTypeRequest {
  name: string;
  category: string;
  debtQuality: string;
  isHecs: boolean;
}

export interface UpdateLiabilityTypeRequest extends CreateLiabilityTypeRequest {
  sortOrder: number;
}
```

- [ ] **Step 2: Add CRUD methods to api.service.ts**

Add imports for the new interfaces, then add these methods after the existing `getLiabilityTypes()`:

```typescript
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
```

- [ ] **Step 3: Verify build**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/core/api/models.ts src/app/src/app/core/api/api.service.ts
git commit -m "feat(app): add API service methods for asset type and liability type CRUD"
```

---

### Task 5: Settings Component — Asset Types Management

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.ts`
- Modify: `src/app/src/app/features/settings/settings.component.html`

- [ ] **Step 1: Add imports and state to settings.component.ts**

Add to the imports at the top of the file:

```typescript
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { Checkbox } from 'primeng/checkbox';
```

Add new imports from models:

```typescript
import {
  // ... existing imports ...
  AssetType,
  CreateAssetTypeRequest,
  UpdateAssetTypeRequest,
} from '../../core/api/models';
```

Add `Accordion, AccordionContent, AccordionHeader, AccordionPanel, Checkbox` to the component `imports` array.

Add these properties to the component class:

```typescript
// Asset type management
protected assetTypes = signal<AssetType[]>([]);
protected editingAssetType = signal<AssetType | null>(null);
protected assetTypeDialogVisible = signal(false);
protected atName = '';
protected atCategory = '';
protected atLiquidity = '';
protected atGrowthClass = '';
protected atIsSuper = false;
protected atIsCgtExempt = false;
protected atDefaultReturnRate: number | null = 0;
protected atDefaultVolatility: number | null = 0;

protected assetCategoryOptions = [
  { label: 'Cash', value: 'cash' },
  { label: 'Investable', value: 'investable' },
  { label: 'Property', value: 'property' },
  { label: 'Retirement', value: 'retirement' },
  { label: 'Other', value: 'other' },
];

protected liquidityOptions = [
  { label: 'Immediate', value: 'immediate' },
  { label: 'Short Term', value: 'short_term' },
  { label: 'Long Term', value: 'long_term' },
  { label: 'Restricted', value: 'restricted' },
];

protected growthClassOptions = [
  { label: 'Defensive', value: 'defensive' },
  { label: 'Growth', value: 'growth' },
  { label: 'Mixed', value: 'mixed' },
];
```

- [ ] **Step 2: Add asset type methods to settings.component.ts**

Add to `ngOnInit()`:

```typescript
this.loadAssetTypes();
```

Add methods:

```typescript
loadAssetTypes() {
  this.api.getAssetTypes().subscribe((types) => {
    this.assetTypes.set([...types].sort((a, b) => a.sortOrder - b.sortOrder));
  });
}

openAddAssetType() {
  this.editingAssetType.set(null);
  this.atName = '';
  this.atCategory = 'cash';
  this.atLiquidity = 'immediate';
  this.atGrowthClass = 'defensive';
  this.atIsSuper = false;
  this.atIsCgtExempt = false;
  this.atDefaultReturnRate = 0;
  this.atDefaultVolatility = 0;
  this.assetTypeDialogVisible.set(true);
}

openEditAssetType(at: AssetType) {
  this.editingAssetType.set(at);
  this.atName = at.name;
  this.atCategory = at.category;
  this.atLiquidity = at.liquidity;
  this.atGrowthClass = at.growthClass;
  this.atIsSuper = at.isSuper;
  this.atIsCgtExempt = at.isCgtExempt;
  this.atDefaultReturnRate = at.defaultReturnRate * 100;  // API stores decimal, UI shows %
  this.atDefaultVolatility = at.defaultVolatility * 100;
  this.assetTypeDialogVisible.set(true);
}

saveAssetType() {
  const editing = this.editingAssetType();
  if (editing) {
    const req: UpdateAssetTypeRequest = {
      name: this.atName,
      category: this.atCategory,
      liquidity: this.atLiquidity,
      growthClass: this.atGrowthClass,
      isSuper: this.atIsSuper,
      isCgtExempt: this.atIsCgtExempt,
      sortOrder: editing.sortOrder,
      defaultReturnRate: (this.atDefaultReturnRate ?? 0) / 100,  // UI shows %, API stores decimal
      defaultVolatility: (this.atDefaultVolatility ?? 0) / 100,
    };
    this.api.updateAssetType(editing.id, req).subscribe(() => {
      this.assetTypeDialogVisible.set(false);
      this.loadAssetTypes();
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Asset type updated' });
    });
  } else {
    const req: CreateAssetTypeRequest = {
      name: this.atName,
      category: this.atCategory,
      liquidity: this.atLiquidity,
      growthClass: this.atGrowthClass,
      isSuper: this.atIsSuper,
      isCgtExempt: this.atIsCgtExempt,
      defaultReturnRate: (this.atDefaultReturnRate ?? 0) / 100,  // UI shows %, API stores decimal
      defaultVolatility: (this.atDefaultVolatility ?? 0) / 100,
    };
    this.api.createAssetType(req).subscribe(() => {
      this.assetTypeDialogVisible.set(false);
      this.loadAssetTypes();
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Asset type added' });
    });
  }
}

deleteAssetType(at: AssetType) {
  this.confirmationService.confirm({
    message: `Delete asset type "${at.name}"? This cannot be undone.`,
    header: 'Delete Asset Type?',
    icon: 'pi pi-exclamation-triangle',
    acceptButtonStyleClass: 'p-button-danger',
    accept: () => {
      this.api.deleteAssetType(at.id).subscribe({
        next: () => {
          this.loadAssetTypes();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Asset type "${at.name}" deleted` });
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Cannot Delete', detail: 'This type is in use. Reassign or remove referencing assets first.' });
        },
      });
    },
  });
}

moveAssetTypeUp(at: AssetType) {
  const types = this.assetTypes();
  const idx = types.findIndex((t) => t.id === at.id);
  if (idx <= 0) return;
  const prev = types[idx - 1];
  const prevOrder = prev.sortOrder;
  const atOrder = at.sortOrder;
  this.api.updateAssetType(prev.id, { ...this.assetTypeToUpdateRequest(prev), sortOrder: atOrder }).subscribe(() => {
    this.api.updateAssetType(at.id, { ...this.assetTypeToUpdateRequest(at), sortOrder: prevOrder }).subscribe(() => {
      this.loadAssetTypes();
    });
  });
}

moveAssetTypeDown(at: AssetType) {
  const types = this.assetTypes();
  const idx = types.findIndex((t) => t.id === at.id);
  if (idx < 0 || idx >= types.length - 1) return;
  const next = types[idx + 1];
  const nextOrder = next.sortOrder;
  const atOrder = at.sortOrder;
  this.api.updateAssetType(next.id, { ...this.assetTypeToUpdateRequest(next), sortOrder: atOrder }).subscribe(() => {
    this.api.updateAssetType(at.id, { ...this.assetTypeToUpdateRequest(at), sortOrder: nextOrder }).subscribe(() => {
      this.loadAssetTypes();
    });
  });
}

private assetTypeToUpdateRequest(at: AssetType): UpdateAssetTypeRequest {
  return {
    name: at.name,
    category: at.category,
    liquidity: at.liquidity,
    growthClass: at.growthClass,
    isSuper: at.isSuper,
    isCgtExempt: at.isCgtExempt,
    sortOrder: at.sortOrder,
    defaultReturnRate: at.defaultReturnRate,
    defaultVolatility: at.defaultVolatility,
  };
}
```

- [ ] **Step 3: Update the Reference Data tab HTML**

Replace the entire `<p-tabpanel value="4">` content. Change it from the flat expense-categories list to an accordion with three panels.

Replace:
```html
<p-tabpanel value="4">
  <div class="members-header">
    <p-button label="Add Category" icon="pi pi-plus" (onClick)="openAddCategory()" />
  </div>
  <div class="members-list">
    @for (cat of categories(); track cat.id; let i = $index) {
      ...existing category list...
    }
  </div>
</p-tabpanel>
```

With:
```html
<p-tabpanel value="4">
  <p-accordion [multiple]="true" [value]="['0', '1', '2']">
    <p-accordionpanel value="0">
      <p-accordionheader>Asset Types</p-accordionheader>
      <p-accordioncontent>
        <div class="members-header">
          <p-button label="Add Asset Type" icon="pi pi-plus" (onClick)="openAddAssetType()" />
        </div>
        <div class="members-list">
          @for (at of assetTypes(); track at.id; let i = $index) {
            <div class="member-card">
              <div class="member-info">
                <span class="display-name">{{ at.name }}</span>
                <p-tag [value]="at.category" severity="info" />
                @if (at.isSuper) { <p-tag value="Super" severity="warn" /> }
                @if (at.isCgtExempt) { <p-tag value="CGT Exempt" severity="success" /> }
                @if (at.isSystem) { <p-tag value="Default" severity="secondary" /> }
              </div>
              <div class="member-info">
                <span class="member-email">Return: {{ at.defaultReturnRate * 100 | number:'1.1-1' }}%</span>
                <span class="member-email">Volatility: {{ at.defaultVolatility * 100 | number:'1.1-1' }}%</span>
              </div>
              <div class="member-name-row">
                <p-button icon="pi pi-arrow-up" [rounded]="true" [text]="true" severity="secondary"
                  [disabled]="i === 0" (onClick)="moveAssetTypeUp(at)" />
                <p-button icon="pi pi-arrow-down" [rounded]="true" [text]="true" severity="secondary"
                  [disabled]="i === assetTypes().length - 1" (onClick)="moveAssetTypeDown(at)" />
                <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="info" (onClick)="openEditAssetType(at)" />
                <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" (onClick)="deleteAssetType(at)" />
              </div>
            </div>
          }
        </div>
      </p-accordioncontent>
    </p-accordionpanel>

    <!-- Liability Types panel added in Task 6 -->

    <p-accordionpanel value="2">
      <p-accordionheader>Expense Categories</p-accordionheader>
      <p-accordioncontent>
        <div class="members-header">
          <p-button label="Add Category" icon="pi pi-plus" (onClick)="openAddCategory()" />
        </div>
        <div class="members-list">
          @for (cat of categories(); track cat.id; let i = $index) {
            <div class="member-card">
              <div class="member-info">
                <span class="display-name">{{ cat.name }}</span>
                <span class="member-email">Order: {{ cat.sortOrder }}</span>
                @if (cat.isDefault) {
                  <p-tag value="Default" severity="success" />
                }
              </div>
              <div class="member-name-row">
                <p-button icon="pi pi-arrow-up" [rounded]="true" [text]="true" severity="secondary"
                  [disabled]="i === 0" (onClick)="moveCategoryUp(cat)" />
                <p-button icon="pi pi-arrow-down" [rounded]="true" [text]="true" severity="secondary"
                  [disabled]="i === categories().length - 1" (onClick)="moveCategoryDown(cat)" />
                <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="info" (onClick)="openEditCategory(cat)" />
                <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger"
                  [disabled]="cat.isDefault" (onClick)="deleteCategory(cat)" />
              </div>
            </div>
          }
        </div>
      </p-accordioncontent>
    </p-accordionpanel>
  </p-accordion>
</p-tabpanel>
```

- [ ] **Step 4: Add the asset type dialog HTML**

Add before the existing category dialog (before `<p-dialog [header]="editingCategory() ? ...`):

```html
<p-dialog [header]="editingAssetType() ? 'Edit Asset Type' : 'Add Asset Type'" [(visible)]="assetTypeDialogVisible" [modal]="true" [style]="{ width: '500px' }">
  <div class="form-grid">
    <label for="atName">Name</label>
    <input pInputText id="atName" [(ngModel)]="atName" placeholder="e.g. Retirement Account" />

    <label for="atCategory">Category</label>
    <p-select id="atCategory" [(ngModel)]="atCategory" [options]="assetCategoryOptions" optionLabel="label" optionValue="value" />

    <label for="atLiquidity">Liquidity</label>
    <p-select id="atLiquidity" [(ngModel)]="atLiquidity" [options]="liquidityOptions" optionLabel="label" optionValue="value" />

    <label for="atGrowthClass">Growth Class</label>
    <p-select id="atGrowthClass" [(ngModel)]="atGrowthClass" [options]="growthClassOptions" optionLabel="label" optionValue="value" />

    <label for="atReturnRate">Default Return Rate (%)</label>
    <p-inputnumber id="atReturnRate" [(ngModel)]="atDefaultReturnRate" [minFractionDigits]="1" [maxFractionDigits]="2" suffix="%" />

    <label for="atVolatility">Default Volatility (%)</label>
    <p-inputnumber id="atVolatility" [(ngModel)]="atDefaultVolatility" [minFractionDigits]="1" [maxFractionDigits]="2" suffix="%" />

    <div class="flex gap-4">
      <div class="flex items-center gap-2">
        <p-checkbox id="atIsSuper" [(ngModel)]="atIsSuper" [binary]="true" />
        <label for="atIsSuper">Retirement / Super</label>
      </div>
      <div class="flex items-center gap-2">
        <p-checkbox id="atIsCgtExempt" [(ngModel)]="atIsCgtExempt" [binary]="true" />
        <label for="atIsCgtExempt">CGT Exempt</label>
      </div>
    </div>
  </div>
  <ng-template #footer>
    <p-button label="Cancel" [text]="true" (onClick)="assetTypeDialogVisible.set(false)" />
    <p-button label="Save" icon="pi pi-check" (onClick)="saveAssetType()" [disabled]="!atName" />
  </ng-template>
</p-dialog>
```

- [ ] **Step 5: Add DecimalPipe import**

Add `DecimalPipe` to the component imports in Step 1 (for the `| number` pipe used in the template):

```typescript
import { DecimalPipe } from '@angular/common';
```

Add `DecimalPipe` to the `imports` array alongside the other imports added in Step 1.

- [ ] **Step 6: Verify build**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/src/app/features/settings/settings.component.ts src/app/src/app/features/settings/settings.component.html
git commit -m "feat(app): add asset type management to settings reference data tab"
```

---

### Task 6: Settings Component — Liability Types Management

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.ts`
- Modify: `src/app/src/app/features/settings/settings.component.html`

- [ ] **Step 1: Add liability type state and options to settings.component.ts**

Add imports from models:

```typescript
import {
  // ... existing imports ...
  LiabilityType,
  CreateLiabilityTypeRequest as CreateLiabTypeReq,
  UpdateLiabilityTypeRequest as UpdateLiabTypeReq,
} from '../../core/api/models';
```

Add properties:

```typescript
// Liability type management
protected liabilityTypes = signal<LiabilityType[]>([]);
protected editingLiabilityType = signal<LiabilityType | null>(null);
protected liabilityTypeDialogVisible = signal(false);
protected ltName = '';
protected ltCategory = '';
protected ltDebtQuality = '';
protected ltIsHecs = false;

protected liabilityCategoryOptions = [
  { label: 'Mortgage', value: 'mortgage' },
  { label: 'Personal', value: 'personal' },
  { label: 'Credit', value: 'credit' },
  { label: 'Student', value: 'student' },
  { label: 'Tax', value: 'tax' },
  { label: 'Other', value: 'other' },
];

protected debtQualityOptions = [
  { label: 'Income-producing', value: 'productive' },
  { label: 'Non-deductible', value: 'neutral' },
  { label: 'Consumption', value: 'bad' },
];
```

- [ ] **Step 2: Add liability type methods**

Add to `ngOnInit()`:

```typescript
this.loadLiabilityTypes();
```

Add methods:

```typescript
loadLiabilityTypes() {
  this.api.getLiabilityTypes().subscribe((types) => {
    this.liabilityTypes.set([...types].sort((a, b) => a.sortOrder - b.sortOrder));
  });
}

openAddLiabilityType() {
  this.editingLiabilityType.set(null);
  this.ltName = '';
  this.ltCategory = 'personal';
  this.ltDebtQuality = 'neutral';
  this.ltIsHecs = false;
  this.liabilityTypeDialogVisible.set(true);
}

openEditLiabilityType(lt: LiabilityType) {
  this.editingLiabilityType.set(lt);
  this.ltName = lt.name;
  this.ltCategory = lt.category;
  this.ltDebtQuality = lt.debtQuality;
  this.ltIsHecs = lt.isHecs;
  this.liabilityTypeDialogVisible.set(true);
}

saveLiabilityType() {
  const editing = this.editingLiabilityType();
  if (editing) {
    const req: UpdateLiabTypeReq = {
      name: this.ltName,
      category: this.ltCategory,
      debtQuality: this.ltDebtQuality,
      isHecs: this.ltIsHecs,
      sortOrder: editing.sortOrder,
    };
    this.api.updateLiabilityType(editing.id, req).subscribe(() => {
      this.liabilityTypeDialogVisible.set(false);
      this.loadLiabilityTypes();
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Liability type updated' });
    });
  } else {
    const req: CreateLiabTypeReq = {
      name: this.ltName,
      category: this.ltCategory,
      debtQuality: this.ltDebtQuality,
      isHecs: this.ltIsHecs,
    };
    this.api.createLiabilityType(req).subscribe(() => {
      this.liabilityTypeDialogVisible.set(false);
      this.loadLiabilityTypes();
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Liability type added' });
    });
  }
}

deleteLiabilityType(lt: LiabilityType) {
  this.confirmationService.confirm({
    message: `Delete liability type "${lt.name}"? This cannot be undone.`,
    header: 'Delete Liability Type?',
    icon: 'pi pi-exclamation-triangle',
    acceptButtonStyleClass: 'p-button-danger',
    accept: () => {
      this.api.deleteLiabilityType(lt.id).subscribe({
        next: () => {
          this.loadLiabilityTypes();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Liability type "${lt.name}" deleted` });
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Cannot Delete', detail: 'This type is in use. Reassign or remove referencing liabilities first.' });
        },
      });
    },
  });
}

moveLiabilityTypeUp(lt: LiabilityType) {
  const types = this.liabilityTypes();
  const idx = types.findIndex((t) => t.id === lt.id);
  if (idx <= 0) return;
  const prev = types[idx - 1];
  const prevOrder = prev.sortOrder;
  const ltOrder = lt.sortOrder;
  this.api.updateLiabilityType(prev.id, { ...this.liabilityTypeToUpdateRequest(prev), sortOrder: ltOrder }).subscribe(() => {
    this.api.updateLiabilityType(lt.id, { ...this.liabilityTypeToUpdateRequest(lt), sortOrder: prevOrder }).subscribe(() => {
      this.loadLiabilityTypes();
    });
  });
}

moveLiabilityTypeDown(lt: LiabilityType) {
  const types = this.liabilityTypes();
  const idx = types.findIndex((t) => t.id === lt.id);
  if (idx < 0 || idx >= types.length - 1) return;
  const next = types[idx + 1];
  const nextOrder = next.sortOrder;
  const ltOrder = lt.sortOrder;
  this.api.updateLiabilityType(next.id, { ...this.liabilityTypeToUpdateRequest(next), sortOrder: ltOrder }).subscribe(() => {
    this.api.updateLiabilityType(lt.id, { ...this.liabilityTypeToUpdateRequest(lt), sortOrder: nextOrder }).subscribe(() => {
      this.loadLiabilityTypes();
    });
  });
}

private liabilityTypeToUpdateRequest(lt: LiabilityType): UpdateLiabTypeReq {
  return {
    name: lt.name,
    category: lt.category,
    debtQuality: lt.debtQuality,
    isHecs: lt.isHecs,
    sortOrder: lt.sortOrder,
  };
}
```

- [ ] **Step 3: Add liability types accordion panel to HTML**

Insert between the Asset Types panel (`</p-accordionpanel>` for value="0") and the Expense Categories panel (`<p-accordionpanel value="2">`):

```html
<p-accordionpanel value="1">
  <p-accordionheader>Liability Types</p-accordionheader>
  <p-accordioncontent>
    <div class="members-header">
      <p-button label="Add Liability Type" icon="pi pi-plus" (onClick)="openAddLiabilityType()" />
    </div>
    <div class="members-list">
      @for (lt of liabilityTypes(); track lt.id; let i = $index) {
        <div class="member-card">
          <div class="member-info">
            <span class="display-name">{{ lt.name }}</span>
            <p-tag [value]="lt.category" severity="info" />
            <p-tag [value]="lt.debtQuality" />
            @if (lt.isHecs) { <p-tag value="HECS" severity="warn" /> }
            @if (lt.isSystem) { <p-tag value="Default" severity="secondary" /> }
          </div>
          <div class="member-name-row">
            <p-button icon="pi pi-arrow-up" [rounded]="true" [text]="true" severity="secondary"
              [disabled]="i === 0" (onClick)="moveLiabilityTypeUp(lt)" />
            <p-button icon="pi pi-arrow-down" [rounded]="true" [text]="true" severity="secondary"
              [disabled]="i === liabilityTypes().length - 1" (onClick)="moveLiabilityTypeDown(lt)" />
            <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="info" (onClick)="openEditLiabilityType(lt)" />
            <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" (onClick)="deleteLiabilityType(lt)" />
          </div>
        </div>
      }
    </div>
  </p-accordioncontent>
</p-accordionpanel>
```

- [ ] **Step 4: Add the liability type dialog HTML**

Add after the asset type dialog:

```html
<p-dialog [header]="editingLiabilityType() ? 'Edit Liability Type' : 'Add Liability Type'" [(visible)]="liabilityTypeDialogVisible" [modal]="true" [style]="{ width: '500px' }">
  <div class="form-grid">
    <label for="ltName">Name</label>
    <input pInputText id="ltName" [(ngModel)]="ltName" placeholder="e.g. Student Loan" />

    <label for="ltCategory">Category</label>
    <p-select id="ltCategory" [(ngModel)]="ltCategory" [options]="liabilityCategoryOptions" optionLabel="label" optionValue="value" />

    <label for="ltDebtQuality">Debt Quality</label>
    <p-select id="ltDebtQuality" [(ngModel)]="ltDebtQuality" [options]="debtQualityOptions" optionLabel="label" optionValue="value" />

    <div class="flex items-center gap-2">
      <p-checkbox id="ltIsHecs" [(ngModel)]="ltIsHecs" [binary]="true" />
      <label for="ltIsHecs">Student loan (HECS-style)</label>
    </div>
  </div>
  <ng-template #footer>
    <p-button label="Cancel" [text]="true" (onClick)="liabilityTypeDialogVisible.set(false)" />
    <p-button label="Save" icon="pi pi-check" (onClick)="saveLiabilityType()" [disabled]="!ltName" />
  </ng-template>
</p-dialog>
```

- [ ] **Step 5: Verify build**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/features/settings/settings.component.ts src/app/src/app/features/settings/settings.component.html
git commit -m "feat(app): add liability type management to settings reference data tab"
```

---

### Task 7: Verify End-to-End

- [ ] **Step 1: Build and test backend**

Run: `dotnet build src/api/Clearfolio.Api/ && dotnet test src/api/Clearfolio.Tests/`
Expected: Build succeeded. All tests pass.

- [ ] **Step 2: Build frontend**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Start the app and verify:
1. Settings > Reference Data tab shows accordion with 3 panels
2. Asset Types panel lists all 15 seeded types
3. Can add a new asset type, edit an existing one, delete an unused one
4. Liability Types panel lists all 9 seeded types
5. Can add a new liability type, edit an existing one, delete an unused one
6. Expense Categories panel works as before
7. Reordering works for both asset and liability types
8. Deleting a type that is in use shows error toast

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```
