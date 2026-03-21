# Projections Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Projections page with three forecasting methods (compound growth, scenario-based, Monte Carlo) and contribution/repayment tracking on assets and liabilities.

**Architecture:** Backend projection engines in C# (three POST endpoints), new entity fields for contributions/rates/volatility, frontend Angular component with ECharts visualisation. Follows existing patterns: minimal API endpoints, EF Core entities with SQLite, Angular signals + OnPush.

**Tech Stack:** .NET 10 / EF Core / SQLite (backend), Angular 19 / ECharts / PrimeNG (frontend)

**Spec:** `docs/superpowers/specs/2026-03-21-projections-design.md`

---

## File Structure

### Backend — New Files
- `src/api/Clearfolio.Api/DTOs/ProjectionDto.cs` — All projection request/response DTOs
- `src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs` — Projection API endpoints
- `src/api/Clearfolio.Api/Services/ProjectionEngine.cs` — Three projection engines (compound, scenario, Monte Carlo)
- `src/api/Clearfolio.Api/Services/HistoricalReturnsService.cs` — Yahoo Finance historical data fetcher

### Backend — Modified Files
- `src/api/Clearfolio.Api/Models/Asset.cs` — Add contribution + return rate fields
- `src/api/Clearfolio.Api/Models/Liability.cs` — Add repayment + interest rate fields
- `src/api/Clearfolio.Api/Models/AssetType.cs` — Add defaultReturnRate + defaultVolatility
- `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs` — Configure new columns, update seed data
- `src/api/Clearfolio.Api/DTOs/AssetDto.cs` — Extend DTOs with new fields
- `src/api/Clearfolio.Api/DTOs/LiabilityDto.cs` — Extend DTOs with new fields
- `src/api/Clearfolio.Api/DTOs/AssetTypeDto.cs` — Add return rate and volatility
- `src/api/Clearfolio.Api/Endpoints/AssetsEndpoints.cs` — Handle new fields in create/update
- `src/api/Clearfolio.Api/Endpoints/LiabilitiesEndpoints.cs` — Handle new fields in create/update
- `src/api/Clearfolio.Api/Program.cs` — Register new endpoints

### Frontend — New Files
- `src/app/src/app/features/projections/projections.component.ts` — Main projections page
- `src/app/src/app/features/projections/projections.component.html` — Template
- `src/app/src/app/features/projections/projections.component.scss` — Styles
- `src/app/src/app/features/projections/projection-chart-options.ts` — ECharts builders for all three modes

### Frontend — Modified Files
- `src/app/src/app/core/api/models.ts` — Add projection interfaces
- `src/app/src/app/core/api/api.service.ts` — Add projection API methods
- `src/app/src/app/app.routes.ts` — Add /projections route
- `src/app/src/app/app.ts` — Add Projections nav link
- `src/app/src/app/features/assets/assets.component.html` — Add contribution fields to edit dialog
- `src/app/src/app/features/assets/assets.component.ts` — Handle new form fields
- `src/app/src/app/features/liabilities/liabilities.component.html` — Add repayment fields to edit dialog
- `src/app/src/app/features/liabilities/liabilities.component.ts` — Handle new form fields

---

## Task 1: Add Projection Fields to Backend Entities

**Files:**
- Modify: `src/api/Clearfolio.Api/Models/Asset.cs`
- Modify: `src/api/Clearfolio.Api/Models/Liability.cs`
- Modify: `src/api/Clearfolio.Api/Models/AssetType.cs`

- [ ] **Step 1: Add contribution and return rate fields to Asset entity**

In `src/api/Clearfolio.Api/Models/Asset.cs`, add before the navigation properties:

```csharp
// Projection fields
public double? ContributionAmount { get; set; }
public string? ContributionFrequency { get; set; }
public string? ContributionEndDate { get; set; }
public double? ExpectedReturnRate { get; set; }
public double? ExpectedVolatility { get; set; }
```

- [ ] **Step 2: Add repayment and interest rate fields to Liability entity**

In `src/api/Clearfolio.Api/Models/Liability.cs`, add before the navigation properties:

```csharp
// Projection fields
public double? RepaymentAmount { get; set; }
public string? RepaymentFrequency { get; set; }
public string? RepaymentEndDate { get; set; }
public double? InterestRate { get; set; }
```

- [ ] **Step 3: Add default return rate and volatility to AssetType entity**

In `src/api/Clearfolio.Api/Models/AssetType.cs`, add before the navigation property:

```csharp
public double DefaultReturnRate { get; set; }
public double DefaultVolatility { get; set; }
```

- [ ] **Step 4: Verify the API project builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 5: Commit**

```bash
git add src/api/Clearfolio.Api/Models/Asset.cs src/api/Clearfolio.Api/Models/Liability.cs src/api/Clearfolio.Api/Models/AssetType.cs
git commit -m "feat: add projection fields to Asset, Liability, and AssetType entities"
```

---

## Task 2: Update DbContext Configuration and Seed Data

**Files:**
- Modify: `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs`

- [ ] **Step 1: Add column mappings for Asset projection fields**

In the `modelBuilder.Entity<Asset>` configuration block (after the existing column mappings), add:

```csharp
e.Property(a => a.ContributionAmount).HasColumnName("contribution_amount");
e.Property(a => a.ContributionFrequency).HasColumnName("contribution_frequency");
e.Property(a => a.ContributionEndDate).HasColumnName("contribution_end_date");
e.Property(a => a.ExpectedReturnRate).HasColumnName("expected_return_rate");
e.Property(a => a.ExpectedVolatility).HasColumnName("expected_volatility");
```

- [ ] **Step 2: Add column mappings for Liability projection fields**

In the `modelBuilder.Entity<Liability>` configuration block, add:

```csharp
e.Property(l => l.RepaymentAmount).HasColumnName("repayment_amount");
e.Property(l => l.RepaymentFrequency).HasColumnName("repayment_frequency");
e.Property(l => l.RepaymentEndDate).HasColumnName("repayment_end_date");
e.Property(l => l.InterestRate).HasColumnName("interest_rate");
```

- [ ] **Step 3: Add column mappings for AssetType projection fields**

In the `modelBuilder.Entity<AssetType>` configuration block, add:

```csharp
e.Property(t => t.DefaultReturnRate).HasColumnName("default_return_rate").HasDefaultValue(0.0);
e.Property(t => t.DefaultVolatility).HasColumnName("default_volatility").HasDefaultValue(0.0);
```

- [ ] **Step 4: Update seed data with return rates and volatility**

Update each `AssetType` in the `SeedData` method to include `DefaultReturnRate` and `DefaultVolatility`. Add these properties to each entry:

| Id suffix | DefaultReturnRate | DefaultVolatility |
|---|---|---|
| `...001` (Cash — savings) | 0.04 | 0.01 |
| `...002` (Term deposit ≤90d) | 0.04 | 0.01 |
| `...003` (Term deposit >90d) | 0.045 | 0.01 |
| `...004` (AU shares) | 0.07 | 0.15 |
| `...005` (Intl shares) | 0.08 | 0.17 |
| `...00f` (Managed fund) | 0.06 | 0.12 |
| `...006` (Bonds) | 0.04 | 0.05 |
| `...007` (Crypto) | 0.0 | 0.50 |
| `...00e` (Investment bond) | 0.05 | 0.08 |
| `...008` (Super accum.) | 0.07 | 0.12 |
| `...009` (Super pension) | 0.06 | 0.10 |
| `...00a` (PPOR) | 0.05 | 0.10 |
| `...00b` (Investment property) | 0.05 | 0.10 |
| `...00c` (Vehicle) | -0.10 | 0.05 |
| `...00d` (Other physical) | 0.0 | 0.10 |

Example for the first entry:
```csharp
new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"), Name = "Cash — savings / transaction", Category = "cash", Liquidity = "immediate", GrowthClass = "defensive", SortOrder = 1, IsSystem = true, DefaultReturnRate = 0.04, DefaultVolatility = 0.01 },
```

- [ ] **Step 5: Create EF migration**

Run: `dotnet ef migrations add AddProjectionFields --project src/api/Clearfolio.Api/`
Expected: Migration created successfully

- [ ] **Step 6: Add data migration for existing AssetType rows**

In the generated migration's `Up()` method, add SQL after the `AddColumn` calls to update existing rows with correct values. EF Core `HasData` only inserts missing rows — it does not update existing ones:

```csharp
migrationBuilder.Sql(@"
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000001';
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000002';
    UPDATE asset_types SET default_return_rate = 0.045, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000003';
    UPDATE asset_types SET default_return_rate = 0.07, default_volatility = 0.15 WHERE id = 'a0000000-0000-0000-0000-000000000004';
    UPDATE asset_types SET default_return_rate = 0.08, default_volatility = 0.17 WHERE id = 'a0000000-0000-0000-0000-000000000005';
    UPDATE asset_types SET default_return_rate = 0.06, default_volatility = 0.12 WHERE id = 'a0000000-0000-0000-0000-00000000000f';
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.05 WHERE id = 'a0000000-0000-0000-0000-000000000006';
    UPDATE asset_types SET default_return_rate = 0.0, default_volatility = 0.50 WHERE id = 'a0000000-0000-0000-0000-000000000007';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.08 WHERE id = 'a0000000-0000-0000-0000-00000000000e';
    UPDATE asset_types SET default_return_rate = 0.07, default_volatility = 0.12 WHERE id = 'a0000000-0000-0000-0000-000000000008';
    UPDATE asset_types SET default_return_rate = 0.06, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-000000000009';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000a';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000b';
    UPDATE asset_types SET default_return_rate = -0.10, default_volatility = 0.05 WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    UPDATE asset_types SET default_return_rate = 0.0, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000d';
");
```

- [ ] **Step 7: Apply migration and verify**

Run: `dotnet ef database update --project src/api/Clearfolio.Api/`
Expected: Database updated successfully

- [ ] **Step 8: Verify the API project builds and starts**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 9: Commit**

```bash
git add src/api/Clearfolio.Api/Data/ src/api/Clearfolio.Api/Migrations/
git commit -m "feat: configure projection columns and seed default return rates"
```

---

## Task 3: Update DTOs and Existing Endpoints

**Files:**
- Modify: `src/api/Clearfolio.Api/DTOs/AssetDto.cs`
- Modify: `src/api/Clearfolio.Api/DTOs/LiabilityDto.cs`
- Modify: `src/api/Clearfolio.Api/DTOs/AssetTypeDto.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/AssetsEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/LiabilitiesEndpoints.cs`

- [ ] **Step 1: Extend AssetDto with projection fields**

In `AssetDto.cs`, add to the `AssetDto` record (after `UpdatedAt`):

```csharp
double? ContributionAmount,
double? ContributionFrequency_REMOVE_THIS,  // ignore, see actual below
```

Actually — replace the full file with:

```csharp
namespace Clearfolio.Api.DTOs;

public record AssetDto(
    Guid Id,
    Guid AssetTypeId,
    string AssetTypeName,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    bool IsActive,
    string CreatedAt,
    string UpdatedAt,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record CreateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record UpdateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);
```

- [ ] **Step 2: Extend LiabilityDto with projection fields**

Replace `LiabilityDto.cs` with:

```csharp
namespace Clearfolio.Api.DTOs;

public record LiabilityDto(
    Guid Id,
    Guid LiabilityTypeId,
    string LiabilityTypeName,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    bool IsActive,
    string CreatedAt,
    string UpdatedAt,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);

public record CreateLiabilityRequest(
    Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);

public record UpdateLiabilityRequest(
    Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);
```

- [ ] **Step 3: Extend AssetTypeDto with return rate and volatility**

Replace `AssetTypeDto.cs` with:

```csharp
namespace Clearfolio.Api.DTOs;

public record AssetTypeDto(
    Guid Id,
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
    bool IsSuper,
    bool IsCgtExempt,
    int SortOrder,
    bool IsSystem,
    double DefaultReturnRate,
    double DefaultVolatility);
```

- [ ] **Step 4: Update AssetsEndpoints to handle new fields**

In `AssetsEndpoints.cs`, update the `ToDto` method to include the new fields:

```csharp
ContributionAmount: a.ContributionAmount,
ContributionFrequency: a.ContributionFrequency,
ContributionEndDate: a.ContributionEndDate,
ExpectedReturnRate: a.ExpectedReturnRate,
ExpectedVolatility: a.ExpectedVolatility
```

Update `CreateAsset` to map new fields from request to entity:

```csharp
ContributionAmount = request.ContributionAmount,
ContributionFrequency = request.ContributionFrequency,
ContributionEndDate = request.ContributionEndDate,
ExpectedReturnRate = request.ExpectedReturnRate,
ExpectedVolatility = request.ExpectedVolatility,
```

Update `UpdateAsset` to map new fields from request to entity (same fields as above).

- [ ] **Step 5: Update LiabilitiesEndpoints to handle new fields**

Same pattern — update `ToDto`, `CreateLiability`, and `UpdateLiability` to include:

```csharp
RepaymentAmount = request.RepaymentAmount,
RepaymentFrequency = request.RepaymentFrequency,
RepaymentEndDate = request.RepaymentEndDate,
InterestRate = request.InterestRate,
```

- [ ] **Step 6: Update ReferenceEndpoints for AssetTypeDto**

In the endpoint that returns asset types, update the DTO mapping to include:

```csharp
DefaultReturnRate: t.DefaultReturnRate,
DefaultVolatility: t.DefaultVolatility
```

- [ ] **Step 7: Verify the API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 8: Commit**

```bash
git add src/api/Clearfolio.Api/DTOs/ src/api/Clearfolio.Api/Endpoints/
git commit -m "feat: extend asset/liability DTOs and endpoints with projection fields"
```

---

## Task 4: Create Projection Engine

**Files:**
- Create: `src/api/Clearfolio.Api/Services/ProjectionEngine.cs`

- [ ] **Step 1: Create the ProjectionEngine with shared types**

Create `src/api/Clearfolio.Api/Services/ProjectionEngine.cs`:

```csharp
namespace Clearfolio.Api.Services;

public static class ProjectionEngine
{
    private static readonly Dictionary<string, int> FrequencyMultipliers = new()
    {
        ["weekly"] = 52,
        ["fortnightly"] = 26,
        ["monthly"] = 12,
        ["quarterly"] = 4,
        ["yearly"] = 1,
    };

    public record EntityInput(
        Guid Id,
        string Label,
        string Category,
        string EntityType,         // "asset" or "liability"
        double CurrentValue,
        double AnnualContribution,  // normalised (0 if none)
        double ReturnRate,          // effective rate (resolved priority)
        double Volatility,          // for Monte Carlo
        double InterestRate,        // liabilities only
        string? ContributionEndDate);

    public record YearlyValue(int Year, double Value);

    public record EntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<YearlyValue> Years);

    // --- Compound Growth ---

    public record CompoundYearData(int Year, double Assets, double Liabilities, double NetWorth);

    public record CompoundResult(
        int Horizon,
        List<CompoundYearData> Years,
        List<EntityProjection> Entities);

    public static CompoundResult RunCompound(List<EntityInput> entities, int horizon)
    {
        var startYear = DateTime.UtcNow.Year;
        var entityResults = new List<EntityProjection>();
        var yearlyTotals = new Dictionary<int, (double assets, double liabilities)>();

        for (var y = 0; y <= horizon; y++)
            yearlyTotals[startYear + y] = (0, 0);

        foreach (var entity in entities)
        {
            var years = new List<YearlyValue>();
            var value = entity.CurrentValue;

            for (var y = 0; y <= horizon; y++)
            {
                var year = startYear + y;
                years.Add(new YearlyValue(year, Math.Round(value, 2)));

                var totals = yearlyTotals[year];
                if (entity.EntityType == "asset")
                    yearlyTotals[year] = (totals.assets + value, totals.liabilities);
                else
                    yearlyTotals[year] = (totals.assets, totals.liabilities + value);

                if (y < horizon)
                {
                    var contribution = GetContribution(entity, year);
                    if (entity.EntityType == "asset")
                        value = value * (1 + entity.ReturnRate) + contribution;
                    else
                        value = Math.Max(0, value * (1 + entity.InterestRate) - contribution);
                }
            }

            entityResults.Add(new EntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, years));
        }

        var compoundYears = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var year = startYear + y;
            var (assets, liabilities) = yearlyTotals[year];
            return new CompoundYearData(year, Math.Round(assets, 2), Math.Round(liabilities, 2), Math.Round(assets - liabilities, 2));
        }).ToList();

        return new CompoundResult(horizon, compoundYears, entityResults);
    }

    // --- Scenario-Based ---

    public record ScenarioValues(double Assets, double Liabilities, double NetWorth);
    public record ScenarioYearData(int Year, ScenarioValues Pessimistic, ScenarioValues Base, ScenarioValues Optimistic);
    public record ScenarioEntityYear(int Year, double Pessimistic, double Base, double Optimistic);
    public record ScenarioEntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<ScenarioEntityYear> Years);

    public record ScenarioResult(
        int Horizon,
        List<ScenarioYearData> Years,
        List<ScenarioEntityProjection> Entities);

    public static ScenarioResult RunScenario(List<EntityInput> entities, int horizon)
    {
        var startYear = DateTime.UtcNow.Year;
        var entityResults = new List<ScenarioEntityProjection>();
        var yearlyTotals = new Dictionary<int, (ScenarioValues pess, ScenarioValues bas, ScenarioValues opt)>();

        for (var y = 0; y <= horizon; y++)
            yearlyTotals[startYear + y] = (new(0, 0, 0), new(0, 0, 0), new(0, 0, 0));

        foreach (var entity in entities)
        {
            var (pessRate, baseRate, optRate) = GetScenarioRates(entity);
            var years = new List<ScenarioEntityYear>();
            double pessValue = entity.CurrentValue, baseValue = entity.CurrentValue, optValue = entity.CurrentValue;

            for (var y = 0; y <= horizon; y++)
            {
                var year = startYear + y;
                years.Add(new ScenarioEntityYear(year, Math.Round(pessValue, 2), Math.Round(baseValue, 2), Math.Round(optValue, 2)));

                // Accumulate totals
                var t = yearlyTotals[year];
                if (entity.EntityType == "asset")
                {
                    yearlyTotals[year] = (
                        new(t.pess.Assets + pessValue, t.pess.Liabilities, 0),
                        new(t.bas.Assets + baseValue, t.bas.Liabilities, 0),
                        new(t.opt.Assets + optValue, t.opt.Liabilities, 0));
                }
                else
                {
                    yearlyTotals[year] = (
                        new(t.pess.Assets, t.pess.Liabilities + pessValue, 0),
                        new(t.bas.Assets, t.bas.Liabilities + baseValue, 0),
                        new(t.opt.Assets, t.opt.Liabilities + optValue, 0));
                }

                if (y < horizon)
                {
                    var contribution = GetContribution(entity, year);
                    if (entity.EntityType == "asset")
                    {
                        pessValue = pessValue * (1 + pessRate) + contribution;
                        baseValue = baseValue * (1 + baseRate) + contribution;
                        optValue = optValue * (1 + optRate) + contribution;
                    }
                    else
                    {
                        // Liabilities: interest rate stays constant across scenarios
                        var newVal = entity.InterestRate;
                        pessValue = Math.Max(0, pessValue * (1 + newVal) - contribution);
                        baseValue = Math.Max(0, baseValue * (1 + newVal) - contribution);
                        optValue = Math.Max(0, optValue * (1 + newVal) - contribution);
                    }
                }
            }

            entityResults.Add(new ScenarioEntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, years));
        }

        var scenarioYears = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var year = startYear + y;
            var t = yearlyTotals[year];
            return new ScenarioYearData(year,
                new ScenarioValues(Math.Round(t.pess.Assets, 2), Math.Round(t.pess.Liabilities, 2), Math.Round(t.pess.Assets - t.pess.Liabilities, 2)),
                new ScenarioValues(Math.Round(t.bas.Assets, 2), Math.Round(t.bas.Liabilities, 2), Math.Round(t.bas.Assets - t.bas.Liabilities, 2)),
                new ScenarioValues(Math.Round(t.opt.Assets, 2), Math.Round(t.opt.Liabilities, 2), Math.Round(t.opt.Assets - t.opt.Liabilities, 2)));
        }).ToList();

        return new ScenarioResult(horizon, scenarioYears, entityResults);
    }

    private static (double pessimistic, double baseRate, double optimistic) GetScenarioRates(EntityInput entity)
    {
        var baseRate = entity.ReturnRate;
        double pessimistic, optimistic;

        if (baseRate > 0)
        {
            pessimistic = Math.Max(baseRate * 0.5, baseRate - 0.03);
            optimistic = Math.Min(baseRate * 1.5, baseRate + 0.03);
        }
        else
        {
            // Zero or negative: additive offset only
            pessimistic = baseRate - 0.03;
            optimistic = baseRate + 0.03;
        }

        return (pessimistic, baseRate, optimistic);
    }

    // --- Monte Carlo ---

    public record MonteCarloYearData(int Year, double P10, double P25, double P50, double P75, double P90);
    public record MonteCarloEntityYear(int Year, double P10, double P25, double P50, double P75, double P90);
    public record MonteCarloEntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<MonteCarloEntityYear> Years);

    public record MonteCarloResult(
        int Horizon,
        int Simulations,
        List<MonteCarloYearData> Years,
        List<MonteCarloEntityProjection> Entities);

    public static MonteCarloResult RunMonteCarlo(List<EntityInput> entities, int horizon, int simulations = 1000)
    {
        simulations = Math.Clamp(simulations, 100, 10000);
        var startYear = DateTime.UtcNow.Year;
        var random = new Random();

        // netWorthByYearBySim[yearIndex][simIndex]
        var netWorthByYear = new double[horizon + 1][];
        for (var y = 0; y <= horizon; y++)
            netWorthByYear[y] = new double[simulations];

        // Per-entity: valueByYearBySim
        var entityValuesByYear = entities.Select(_ =>
        {
            var arr = new double[horizon + 1][];
            for (var y = 0; y <= horizon; y++)
                arr[y] = new double[simulations];
            return arr;
        }).ToArray();

        for (var sim = 0; sim < simulations; sim++)
        {
            for (var e = 0; e < entities.Count; e++)
            {
                var entity = entities[e];
                var value = entity.CurrentValue;

                for (var y = 0; y <= horizon; y++)
                {
                    entityValuesByYear[e][y][sim] = value;
                    var sign = entity.EntityType == "asset" ? 1.0 : -1.0;
                    netWorthByYear[y][sim] += value * sign;

                    if (y < horizon)
                    {
                        var year = startYear + y;
                        var contribution = GetContribution(entity, year);

                        if (entity.EntityType == "asset")
                        {
                            var sampledReturn = SampleNormal(random, entity.ReturnRate, entity.Volatility);
                            value = value * (1 + sampledReturn) + contribution;
                            value = Math.Max(0, value); // Floor at 0
                        }
                        else
                        {
                            value = Math.Max(0, value * (1 + entity.InterestRate) - contribution);
                        }
                    }
                }
            }
        }

        var years = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var sorted = netWorthByYear[y].OrderBy(v => v).ToArray();
            return new MonteCarloYearData(
                startYear + y,
                Math.Round(Percentile(sorted, 0.10), 2),
                Math.Round(Percentile(sorted, 0.25), 2),
                Math.Round(Percentile(sorted, 0.50), 2),
                Math.Round(Percentile(sorted, 0.75), 2),
                Math.Round(Percentile(sorted, 0.90), 2));
        }).ToList();

        var entityProjections = entities.Select((entity, e) =>
        {
            var eYears = Enumerable.Range(0, horizon + 1).Select(y =>
            {
                var sorted = entityValuesByYear[e][y].OrderBy(v => v).ToArray();
                return new MonteCarloEntityYear(
                    startYear + y,
                    Math.Round(Percentile(sorted, 0.10), 2),
                    Math.Round(Percentile(sorted, 0.25), 2),
                    Math.Round(Percentile(sorted, 0.50), 2),
                    Math.Round(Percentile(sorted, 0.75), 2),
                    Math.Round(Percentile(sorted, 0.90), 2));
            }).ToList();
            return new MonteCarloEntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, eYears);
        }).ToList();

        return new MonteCarloResult(horizon, simulations, years, entityProjections);
    }

    // --- Helpers ---

    private static double GetContribution(EntityInput entity, int year)
    {
        if (entity.ContributionEndDate is not null &&
            DateOnly.TryParse(entity.ContributionEndDate, out var endDate) &&
            year > endDate.Year)
            return 0;
        return entity.AnnualContribution;
    }

    public static double NormaliseContribution(double? amount, string? frequency)
    {
        if (amount is null || amount <= 0 || frequency is null)
            return 0;
        return FrequencyMultipliers.TryGetValue(frequency, out var mult)
            ? amount.Value * mult
            : 0;
    }

    private static double SampleNormal(Random random, double mean, double stdDev)
    {
        // Box-Muller transform
        var u1 = 1.0 - random.NextDouble();
        var u2 = 1.0 - random.NextDouble();
        var z = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        return mean + stdDev * z;
    }

    private static double Percentile(double[] sorted, double p)
    {
        var index = p * (sorted.Length - 1);
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);
        if (lower == upper) return sorted[lower];
        var frac = index - lower;
        return sorted[lower] * (1 - frac) + sorted[upper] * frac;
    }
}
```

- [ ] **Step 2: Verify the API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```bash
git add src/api/Clearfolio.Api/Services/ProjectionEngine.cs
git commit -m "feat: add projection engines (compound, scenario, Monte Carlo)"
```

---

## Task 5: Create Projection DTOs and API Endpoints

**Files:**
- Create: `src/api/Clearfolio.Api/DTOs/ProjectionDto.cs`
- Create: `src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Program.cs`

- [ ] **Step 1: Create projection DTOs**

Create `src/api/Clearfolio.Api/DTOs/ProjectionDto.cs`:

```csharp
namespace Clearfolio.Api.DTOs;

public record ProjectionRequest(
    int Horizon,
    string View,
    string Scope,
    List<Guid>? EntityIds,
    int? Simulations);

public record ProjectionDefaultDto(
    Guid EntityId,
    string EntityType,
    string Label,
    double? EffectiveReturnRate,
    double? EffectiveVolatility,
    double? EffectiveInterestRate,
    string RateSource,
    double? ContributionAmount,
    string? ContributionFrequency,
    double AnnualContribution,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    double AnnualRepayment,
    double? CurrentValue,
    bool HasCurrentValue);

public record HistoricalReturnDto(
    string Symbol,
    double AnnualisedReturn,
    double Volatility,
    int DataPoints,
    double PeriodYears);
```

- [ ] **Step 2: Create projection endpoints**

Create `src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;
using Clearfolio.Api.Services;
using static Clearfolio.Api.Services.ProjectionEngine;

namespace Clearfolio.Api.Endpoints;

public static class ProjectionEndpoints
{
    public static void MapProjectionEndpoints(this WebApplication app)
    {
        app.MapPost("/api/projections/compound", RunCompoundProjection);
        app.MapPost("/api/projections/scenario", RunScenarioProjection);
        app.MapPost("/api/projections/monte-carlo", RunMonteCarloProjection);
        app.MapGet("/api/projections/defaults", GetDefaults);
    }

    private static HouseholdMember? GetMemberOrNull(HttpContext context)
        => context.Items["HouseholdMember"] as HouseholdMember;

    private static async Task<IResult> RunCompoundProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return Results.BadRequest("Horizon must be 1-50 years");

        var inputs = await BuildEntityInputs(db, member, request);
        var result = ProjectionEngine.RunCompound(inputs, request.Horizon);

        return Results.Ok(new { mode = "compound", result.Horizon, result.Years, result.Entities });
    }

    private static async Task<IResult> RunScenarioProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return Results.BadRequest("Horizon must be 1-50 years");

        var inputs = await BuildEntityInputs(db, member, request);
        var result = ProjectionEngine.RunScenario(inputs, request.Horizon);

        return Results.Ok(new { mode = "scenario", result.Horizon, result.Years, result.Entities });
    }

    private static async Task<IResult> RunMonteCarloProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return Results.BadRequest("Horizon must be 1-50 years");

        var sims = Math.Clamp(request.Simulations ?? 1000, 100, 10000);
        var inputs = await BuildEntityInputs(db, member, request);
        var result = ProjectionEngine.RunMonteCarlo(inputs, request.Horizon, sims);

        return Results.Ok(new { mode = "monte-carlo", result.Horizon, result.Simulations, result.Years, result.Entities });
    }

    private static async Task<IResult> GetDefaults(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var assets = await db.Assets.AsNoTracking()
            .Include(a => a.AssetType)
            .Where(a => a.HouseholdId == member.HouseholdId && a.IsActive)
            .ToListAsync();

        var liabilities = await db.Liabilities.AsNoTracking()
            .Include(l => l.LiabilityType)
            .Where(l => l.HouseholdId == member.HouseholdId && l.IsActive)
            .ToListAsync();

        var latestSnapshots = await GetLatestSnapshots(db, member.HouseholdId);

        var results = new List<ProjectionDefaultDto>();

        foreach (var a in assets)
        {
            var hasSnapshot = latestSnapshots.TryGetValue(a.Id, out var snapshotValue);
            var effectiveRate = a.ExpectedReturnRate ?? a.AssetType.DefaultReturnRate;
            var effectiveVol = a.ExpectedVolatility ?? a.AssetType.DefaultVolatility;
            var rateSource = a.ExpectedReturnRate.HasValue ? "custom" : "type_default";

            results.Add(new ProjectionDefaultDto(
                a.Id, "asset", a.Label,
                effectiveRate, effectiveVol, null,
                rateSource,
                a.ContributionAmount, a.ContributionFrequency,
                NormaliseContribution(a.ContributionAmount, a.ContributionFrequency),
                null, null, 0,
                hasSnapshot ? snapshotValue : null,
                hasSnapshot));
        }

        foreach (var l in liabilities)
        {
            var hasSnapshot = latestSnapshots.TryGetValue(l.Id, out var snapshotValue);
            results.Add(new ProjectionDefaultDto(
                l.Id, "liability", l.Label,
                null, null, l.InterestRate,
                l.InterestRate.HasValue ? "custom" : "none",
                null, null, 0,
                l.RepaymentAmount, l.RepaymentFrequency,
                NormaliseContribution(l.RepaymentAmount, l.RepaymentFrequency),
                hasSnapshot ? snapshotValue : null,
                hasSnapshot));
        }

        return Results.Ok(results);
    }

    // --- Shared helpers ---

    private static readonly HashSet<string> FinancialAssetCategories = ["cash", "investable", "retirement"];
    private static readonly HashSet<string> LiquidAssetCategories = ["cash", "investable"];
    private static readonly HashSet<string> FinancialLiabilityCategories = ["personal", "credit", "student", "tax", "other"];

    private static async Task<List<EntityInput>> BuildEntityInputs(
        ClearfolioDbContext db, HouseholdMember member, ProjectionRequest request)
    {
        var assets = await db.Assets.AsNoTracking()
            .Include(a => a.AssetType)
            .Where(a => a.HouseholdId == member.HouseholdId && a.IsActive)
            .ToListAsync();

        var liabilities = await db.Liabilities.AsNoTracking()
            .Include(l => l.LiabilityType)
            .Where(l => l.HouseholdId == member.HouseholdId && l.IsActive)
            .ToListAsync();

        // Apply scope filter
        assets = request.Scope switch
        {
            "financial" => assets.Where(a => FinancialAssetCategories.Contains(a.AssetType.Category)).ToList(),
            "liquid" => assets.Where(a => LiquidAssetCategories.Contains(a.AssetType.Category)).ToList(),
            _ => assets,
        };

        liabilities = request.Scope switch
        {
            "financial" => liabilities.Where(l => FinancialLiabilityCategories.Contains(l.LiabilityType.Category)).ToList(),
            "liquid" => [],
            _ => liabilities,
        };

        // Apply entity filter
        if (request.EntityIds is { Count: > 0 })
        {
            var ids = request.EntityIds.ToHashSet();
            assets = assets.Where(a => ids.Contains(a.Id)).ToList();
            liabilities = liabilities.Where(l => ids.Contains(l.Id)).ToList();
        }

        var latestSnapshots = await GetLatestSnapshots(db, member.HouseholdId);
        var members = await db.HouseholdMembers.AsNoTracking()
            .Where(m => m.HouseholdId == member.HouseholdId)
            .ToListAsync();

        var inputs = new List<EntityInput>();

        foreach (var a in assets)
        {
            if (!latestSnapshots.TryGetValue(a.Id, out var value)) continue;

            value = ApplyViewFilter(value, a.OwnershipType, a.OwnerMemberId, a.JointSplit, members, request.View);
            if (value == 0) continue;

            var effectiveRate = a.ExpectedReturnRate ?? a.AssetType.DefaultReturnRate;
            var effectiveVol = a.ExpectedVolatility ?? a.AssetType.DefaultVolatility;

            inputs.Add(new EntityInput(
                a.Id, a.Label, a.AssetType.Category, "asset",
                value,
                NormaliseContribution(a.ContributionAmount, a.ContributionFrequency),
                effectiveRate, effectiveVol, 0,
                a.ContributionEndDate));
        }

        foreach (var l in liabilities)
        {
            if (!latestSnapshots.TryGetValue(l.Id, out var value)) continue;

            value = ApplyViewFilter(value, l.OwnershipType, l.OwnerMemberId, l.JointSplit, members, request.View);
            if (value == 0) continue;

            inputs.Add(new EntityInput(
                l.Id, l.Label, l.LiabilityType.Category, "liability",
                value,
                NormaliseContribution(l.RepaymentAmount, l.RepaymentFrequency),
                0, 0, l.InterestRate ?? 0,
                l.RepaymentEndDate));
        }

        return inputs;
    }

    private static double ApplyViewFilter(
        double value, string ownershipType, Guid? ownerMemberId, double jointSplit,
        List<HouseholdMember> members, string view)
    {
        if (view == "household") return value;

        var targetMember = members.FirstOrDefault(m => m.MemberTag == view);
        if (targetMember is null) return 0;

        if (ownershipType == "sole")
            return ownerMemberId == targetMember.Id ? value : 0;

        var p1 = members.FirstOrDefault(m => m.MemberTag == "p1");
        return targetMember.Id == p1?.Id ? value * jointSplit : value * (1 - jointSplit);
    }

    private static async Task<Dictionary<Guid, double>> GetLatestSnapshots(ClearfolioDbContext db, Guid householdId)
    {
        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == householdId)
            .ToListAsync();

        var latest = new Dictionary<Guid, double>();
        foreach (var s in allSnapshots.OrderBy(s => s.Period))
            latest[s.EntityId] = s.Value;

        return latest;
    }
}
```

- [ ] **Step 3: Register endpoints in Program.cs**

In `src/api/Clearfolio.Api/Program.cs`, add after `app.MapQuoteEndpoints();`:

```csharp
app.MapProjectionEndpoints();
```

- [ ] **Step 4: Verify the API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 5: Commit**

```bash
git add src/api/Clearfolio.Api/DTOs/ProjectionDto.cs src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs src/api/Clearfolio.Api/Program.cs
git commit -m "feat: add projection API endpoints (compound, scenario, Monte Carlo)"
```

---

## Task 6: Add Frontend TypeScript Models and API Methods

**Files:**
- Modify: `src/app/src/app/core/api/models.ts`
- Modify: `src/app/src/app/core/api/api.service.ts`

- [ ] **Step 1: Add projection interfaces to models.ts**

Append to `src/app/src/app/core/api/models.ts`:

```typescript
// --- Projections ---

export interface ProjectionRequest {
  horizon: number;
  view: string;
  scope: string;
  entityIds?: string[];
  simulations?: number;
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
```

- [ ] **Step 2: Update Asset and Liability interfaces**

Add projection fields to the existing `Asset` interface:

```typescript
contributionAmount: number | null;
contributionFrequency: string | null;
contributionEndDate: string | null;
expectedReturnRate: number | null;
expectedVolatility: number | null;
```

Add to `CreateAssetRequest`:

```typescript
contributionAmount: number | null;
contributionFrequency: string | null;
contributionEndDate: string | null;
expectedReturnRate: number | null;
expectedVolatility: number | null;
```

Add to existing `Liability` interface:

```typescript
repaymentAmount: number | null;
repaymentFrequency: string | null;
repaymentEndDate: string | null;
interestRate: number | null;
```

Add to `CreateLiabilityRequest`:

```typescript
repaymentAmount: number | null;
repaymentFrequency: string | null;
repaymentEndDate: string | null;
interestRate: number | null;
```

Add to `AssetType` interface:

```typescript
defaultReturnRate: number;
defaultVolatility: number;
```

- [ ] **Step 3: Add projection API methods to api.service.ts**

Add to `ApiService`:

```typescript
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
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds (warnings ok)

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/core/api/models.ts src/app/src/app/core/api/api.service.ts
git commit -m "feat: add projection TypeScript models and API service methods"
```

---

## Task 7: Update Asset and Liability Edit Dialogs

**Files:**
- Modify: `src/app/src/app/features/assets/assets.component.ts`
- Modify: `src/app/src/app/features/assets/assets.component.html`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.ts`
- Modify: `src/app/src/app/features/liabilities/liabilities.component.html`

- [ ] **Step 1: Update asset form model and emptyForm()**

In `assets.component.ts`, update the `emptyForm()` method to include new fields:

```typescript
contributionAmount: null,
contributionFrequency: null,
contributionEndDate: null,
expectedReturnRate: null,
expectedVolatility: null,
```

Update `openEdit()` to map these from the asset being edited.

Add a frequency options array:

```typescript
protected frequencyOptions = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];
```

- [ ] **Step 2: Add contribution fields to asset edit dialog HTML**

In `assets.component.html`, add a "Projections" section inside the edit dialog, after the existing fields:

```html
<p-divider />
<h4 class="section-label">Projections</h4>

<div class="form-row">
  <div class="form-field">
    <label>Contribution Amount</label>
    <p-inputNumber [(ngModel)]="form.contributionAmount" mode="currency" [currency]="household()?.baseCurrency ?? 'AUD'" [minFractionDigits]="0" placeholder="0" />
  </div>
  <div class="form-field">
    <label>Frequency</label>
    <p-select [(ngModel)]="form.contributionFrequency" [options]="frequencyOptions" optionLabel="label" optionValue="value" placeholder="Select..." [showClear]="true" />
  </div>
  <div class="form-field">
    <label>End Date</label>
    <p-datePicker [(ngModel)]="form.contributionEndDate" dateFormat="yy-mm-dd" [showIcon]="true" placeholder="No end date" />
  </div>
</div>

<div class="form-row">
  <div class="form-field">
    <label>Expected Annual Return (%)</label>
    <p-inputNumber [(ngModel)]="form.expectedReturnRate" [minFractionDigits]="1" [maxFractionDigits]="2" suffix="%" placeholder="Type default" />
  </div>
  <div class="form-field">
    <label>Volatility (%)</label>
    <p-inputNumber [(ngModel)]="form.expectedVolatility" [minFractionDigits]="1" [maxFractionDigits]="2" suffix="%" placeholder="Type default" />
  </div>
</div>
```

**Note:** The `expectedReturnRate` and `expectedVolatility` are stored as decimals (0.07 = 7%) in the backend but displayed as percentages. Add conversion logic: multiply by 100 for display, divide by 100 before sending to API. Apply this in `openEdit()` and `save()`.

- [ ] **Step 3: Update liability form model and emptyForm()**

In `liabilities.component.ts`, same pattern — add to `emptyForm()`:

```typescript
repaymentAmount: null,
repaymentFrequency: null,
repaymentEndDate: null,
interestRate: null,
```

Add `frequencyOptions` array. Update `openEdit()` to map new fields. Convert `interestRate` decimal ↔ percentage for display.

- [ ] **Step 4: Add repayment fields to liability edit dialog HTML**

In `liabilities.component.html`, add after existing fields:

```html
<p-divider />
<h4 class="section-label">Projections</h4>

<div class="form-row">
  <div class="form-field">
    <label>Repayment Amount</label>
    <p-inputNumber [(ngModel)]="form.repaymentAmount" mode="currency" [currency]="household()?.baseCurrency ?? 'AUD'" [minFractionDigits]="0" placeholder="0" />
  </div>
  <div class="form-field">
    <label>Frequency</label>
    <p-select [(ngModel)]="form.repaymentFrequency" [options]="frequencyOptions" optionLabel="label" optionValue="value" placeholder="Select..." [showClear]="true" />
  </div>
  <div class="form-field">
    <label>End Date</label>
    <p-datePicker [(ngModel)]="form.repaymentEndDate" dateFormat="yy-mm-dd" [showIcon]="true" placeholder="No end date" />
  </div>
</div>

<div class="form-row">
  <div class="form-field">
    <label>Annual Interest Rate (%)</label>
    <p-inputNumber [(ngModel)]="form.interestRate" [minFractionDigits]="1" [maxFractionDigits]="2" suffix="%" placeholder="0" />
  </div>
</div>
```

- [ ] **Step 5: Verify the frontend builds**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/features/assets/ src/app/src/app/features/liabilities/
git commit -m "feat: add contribution and projection fields to asset/liability edit dialogs"
```

---

## Task 8: Create Projection Chart Options

**Files:**
- Create: `src/app/src/app/features/projections/projection-chart-options.ts`

- [ ] **Step 1: Create chart option builders for all three modes**

Create `src/app/src/app/features/projections/projection-chart-options.ts`:

```typescript
import type { EChartsOption } from 'echarts';
import type { CompoundYearData, ScenarioYearData, MonteCarloYearData } from '../../core/api/models';

function currencyFormatter(value: number): string {
  if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(value) >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
  return '$' + Math.round(value).toLocaleString();
}

const COLORS = {
  netWorth: '#2563eb',
  assets: '#22c55e',
  liabilities: '#ef4444',
  pessimistic: '#ef4444',
  optimistic: '#22c55e',
  p90band: 'rgba(37, 99, 235, 0.08)',
  p75band: 'rgba(37, 99, 235, 0.15)',
};

function baseGrid(): Record<string, unknown> {
  return { left: 70, right: 20, top: 20, bottom: 60 };
}

function yearAxis(years: number[]): Record<string, unknown> {
  return { type: 'category', data: years.map(String), boundaryGap: false };
}

function valueAxis(): Record<string, unknown> {
  return { type: 'value', axisLabel: { formatter: (v: number) => currencyFormatter(v) } };
}

export function buildCompoundOptions(data: CompoundYearData[]): EChartsOption {
  const years = data.map((d) => d.year);
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => currencyFormatter(v as number) },
    legend: { data: ['Net Worth', 'Assets', 'Liabilities'], bottom: 0 },
    grid: baseGrid(),
    xAxis: yearAxis(years),
    yAxis: valueAxis(),
    series: [
      { name: 'Net Worth', type: 'line', data: data.map((d) => d.netWorth), smooth: true, lineStyle: { width: 3 }, itemStyle: { color: COLORS.netWorth } },
      { name: 'Assets', type: 'line', data: data.map((d) => d.assets), smooth: true, lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: COLORS.assets } },
      { name: 'Liabilities', type: 'line', data: data.map((d) => d.liabilities), smooth: true, lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: COLORS.liabilities } },
    ],
  };
}

export function buildScenarioOptions(data: ScenarioYearData[]): EChartsOption {
  const years = data.map((d) => d.year);
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => currencyFormatter(v as number) },
    legend: { data: ['Optimistic', 'Base', 'Pessimistic'], bottom: 0 },
    grid: baseGrid(),
    xAxis: yearAxis(years),
    yAxis: valueAxis(),
    series: [
      // Shaded band: optimistic line with areaStyle filling down to pessimistic
      { name: 'Optimistic', type: 'line', data: data.map((d) => d.optimistic.netWorth), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: COLORS.optimistic }, areaStyle: { color: 'rgba(37, 99, 235, 0.08)', origin: 'start' }, z: 1 },
      { name: 'Pessimistic', type: 'line', data: data.map((d) => d.pessimistic.netWorth), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: COLORS.pessimistic }, z: 2 },
      { name: 'Base', type: 'line', data: data.map((d) => d.base.netWorth), smooth: true, lineStyle: { width: 3 }, itemStyle: { color: COLORS.netWorth }, z: 3 },
    ],
  };
}

export function buildMonteCarloOptions(data: MonteCarloYearData[]): EChartsOption {
  const years = data.map((d) => d.year);
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => currencyFormatter(v as number) },
    legend: { data: ['Median (P50)', 'P25–P75', 'P10–P90'], bottom: 0 },
    grid: baseGrid(),
    xAxis: yearAxis(years),
    yAxis: valueAxis(),
    series: [
      // P10-P90 band (outer) — use areaStyle with origin to fill between paired series
      { name: 'P10–P90', type: 'line', data: data.map((d) => d.p90), lineStyle: { opacity: 0 }, areaStyle: { color: COLORS.p90band, origin: 'start' }, symbol: 'none', z: 1 },
      { name: 'p10-boundary', type: 'line', data: data.map((d) => d.p10), lineStyle: { opacity: 0 }, symbol: 'none', z: 1 },
      // P25-P75 band (inner)
      { name: 'P25–P75', type: 'line', data: data.map((d) => d.p75), lineStyle: { opacity: 0 }, areaStyle: { color: COLORS.p75band, origin: 'start' }, symbol: 'none', z: 2 },
      { name: 'p25-boundary', type: 'line', data: data.map((d) => d.p25), lineStyle: { opacity: 0 }, symbol: 'none', z: 2 },
      // Median line
      { name: 'Median (P50)', type: 'line', data: data.map((d) => d.p50), smooth: true, lineStyle: { width: 2.5 }, itemStyle: { color: COLORS.netWorth }, z: 3 },
    ],
  };
}
```

**Note:** ECharts band charts can be tricky to render precisely. During implementation, test the actual rendering and adjust if bands don't fill correctly. The key visual: P10-P90 lightest outer band, P25-P75 darker inner band, P50 solid median line. The implementer may need to use ECharts custom series for pixel-perfect band fills.

- [ ] **Step 2: Verify the file is valid TypeScript**

Run: `cd src/app && npx tsc --noEmit src/app/features/projections/projection-chart-options.ts 2>&1 | head -10`
Expected: No errors (or at least no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/src/app/features/projections/projection-chart-options.ts
git commit -m "feat: add projection chart option builders for all three modes"
```

---

## Task 9: Create Projections Component

**Files:**
- Create: `src/app/src/app/features/projections/projections.component.ts`
- Create: `src/app/src/app/features/projections/projections.component.html`
- Create: `src/app/src/app/features/projections/projections.component.scss`

- [ ] **Step 1: Create the projections component TypeScript**

Create `src/app/src/app/features/projections/projections.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ApiService } from '../../core/api/api.service';
import { ViewStateService } from '../../core/auth/view-state.service';
import type {
  ProjectionResult, CompoundResult, ScenarioResult, MonteCarloResult,
  ProjectionDefault, ProjectionRequest,
} from '../../core/api/models';
import { buildCompoundOptions, buildScenarioOptions, buildMonteCarloOptions } from './projection-chart-options';

// PrimeNG
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Skeleton } from 'primeng/skeleton';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

type ProjectionMode = 'compound' | 'scenario' | 'monte-carlo';

@Component({
  selector: 'app-projections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, NgxEchartsDirective,
    Select, Button, InputNumber, Skeleton,
  ],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './projections.component.html',
  styleUrl: './projections.component.scss',
})
export class ProjectionsComponent {
  private api = inject(ApiService);
  private viewState = inject(ViewStateService);

  protected selectedMode = signal<ProjectionMode>('compound');
  protected selectedHorizon = signal(5);
  protected selectedScope = signal('all');
  protected simulations = signal(1000);
  protected customHorizon = signal(false);
  protected loading = signal(false);
  protected selectedEntityId = signal<string | null>(null);

  protected result = signal<ProjectionResult | null>(null);
  protected defaults = signal<ProjectionDefault[]>([]);

  protected modeOptions = [
    { label: 'Compound Growth', value: 'compound' as ProjectionMode },
    { label: 'Scenarios', value: 'scenario' as ProjectionMode },
    { label: 'Monte Carlo', value: 'monte-carlo' as ProjectionMode },
  ];

  protected horizonPresets = [1, 3, 5, 10, 20];

  protected scopeOptions = [
    { label: 'All', value: 'all' },
    { label: 'Financial', value: 'financial' },
    { label: 'Liquid', value: 'liquid' },
  ];

  protected chartOptions = computed(() => {
    const r = this.result();
    if (!r) return null;
    switch (r.mode) {
      case 'compound': return buildCompoundOptions(r.years);
      case 'scenario': return buildScenarioOptions(r.years);
      case 'monte-carlo': return buildMonteCarloOptions(r.years);
    }
  });

  protected summaryLabel = computed(() => {
    return this.selectedScope() === 'liquid' ? 'Projected Asset Value' : 'Projected Net Worth';
  });

  protected entityCards = computed(() => {
    const r = this.result();
    const defs = this.defaults();
    if (!r) return [];

    if (r.mode === 'compound') {
      return (r as CompoundResult).entities.map((e) => {
        const def = defs.find((d) => d.entityId === e.id);
        const first = e.years[0]?.value ?? 0;
        const last = e.years[e.years.length - 1]?.value ?? 0;
        const growth = first > 0 ? ((last - first) / first) * 100 : 0;
        return { id: e.id, label: e.label, category: e.category, entityType: e.entityType, currentValue: first, projectedValue: last, growth, contribution: def };
      });
    }
    if (r.mode === 'scenario') {
      return (r as ScenarioResult).entities.map((e) => {
        const def = defs.find((d) => d.entityId === e.id);
        const first = e.years[0]?.base ?? 0;
        const last = e.years[e.years.length - 1]?.base ?? 0;
        const growth = first > 0 ? ((last - first) / first) * 100 : 0;
        return { id: e.id, label: e.label, category: e.category, entityType: e.entityType, currentValue: first, projectedValue: last, growth, contribution: def };
      });
    }
    if (r.mode === 'monte-carlo') {
      return (r as MonteCarloResult).entities.map((e) => {
        const def = defs.find((d) => d.entityId === e.id);
        const first = e.years[0]?.p50 ?? 0;
        const last = e.years[e.years.length - 1]?.p50 ?? 0;
        const growth = first > 0 ? ((last - first) / first) * 100 : 0;
        return { id: e.id, label: e.label, category: e.category, entityType: e.entityType, currentValue: first, projectedValue: last, growth, contribution: def };
      });
    }
    return [];
  });

  constructor() {
    // Load defaults on init
    this.api.getProjectionDefaults().subscribe((d) => this.defaults.set(d));

    // React to view changes from global nav — use untracked to avoid
    // transitive signal tracking from refresh() causing double API calls
    effect(() => {
      const _view = this.viewState.view(); // only this signal is tracked
      untracked(() => this.refresh());
    });
  }

  protected refresh() {
    this.runProjection(
      this.selectedMode(), this.selectedHorizon(), this.viewState.view(),
      this.selectedScope(), this.simulations(), this.selectedEntityId(),
    );
  }

  protected onModeChange(mode: ProjectionMode) {
    this.selectedMode.set(mode);
    this.refresh();
  }

  protected onScopeChange(scope: string) {
    this.selectedScope.set(scope);
    this.refresh();
  }

  protected onSimulationsChange(sims: number) {
    this.simulations.set(sims);
    this.refresh();
  }

  private runProjection(
    mode: ProjectionMode, horizon: number, view: string,
    scope: string, simulations: number, entityId: string | null,
  ) {
    this.loading.set(true);
    const request: ProjectionRequest = {
      horizon,
      view,
      scope,
      entityIds: entityId ? [entityId] : undefined,
      simulations: mode === 'monte-carlo' ? simulations : undefined,
    };

    const call = mode === 'compound'
      ? this.api.runCompoundProjection(request)
      : mode === 'scenario'
        ? this.api.runScenarioProjection(request)
        : this.api.runMonteCarloProjection(request);

    call.subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectHorizon(years: number) {
    this.customHorizon.set(false);
    this.selectedHorizon.set(years);
    this.refresh();
  }

  protected selectEntity(id: string | null) {
    this.selectedEntityId.set(this.selectedEntityId() === id ? null : id);
    this.refresh();
  }

  protected formatCurrency(value: number): string {
    if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
    return '$' + Math.round(value).toLocaleString();
  }
}
```

- [ ] **Step 2: Create the projections component template**

Create `src/app/src/app/features/projections/projections.component.html`:

```html
<div class="projections-page">
  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="control-group">
      <label>Method</label>
      <p-select [ngModel]="selectedMode()" (ngModelChange)="onModeChange($event)" [options]="modeOptions" optionLabel="label" optionValue="value" />
    </div>

    <div class="control-group">
      <label>Horizon</label>
      <div class="horizon-buttons">
        @for (h of horizonPresets; track h) {
          <button class="horizon-btn" [class.active]="selectedHorizon() === h && !customHorizon()" (click)="selectHorizon(h)">
            {{ h }}y
          </button>
        }
        <button class="horizon-btn" [class.active]="customHorizon()" (click)="customHorizon.set(true)">
          Custom
        </button>
        @if (customHorizon()) {
          <p-inputNumber [(ngModel)]="selectedHorizon" [min]="1" [max]="50" [showButtons]="true" [style]="{ width: '5rem' }" />
        }
      </div>
    </div>

    <div class="control-group">
      <label>Scope</label>
      <div class="scope-buttons">
        @for (s of scopeOptions; track s.value) {
          <button class="scope-btn" [class.active]="selectedScope() === s.value" (click)="onScopeChange(s.value)">
            {{ s.label }}
          </button>
        }
      </div>
    </div>

    @if (selectedMode() === 'monte-carlo') {
      <div class="control-group">
        <label>Simulations</label>
        <p-inputNumber [ngModel]="simulations()" (ngModelChange)="onSimulationsChange($event)" [min]="100" [max]="10000" [step]="100" [style]="{ width: '6rem' }" />
      </div>
    }
  </div>

  <!-- Chart -->
  <div class="chart-container">
    @if (loading() && !result()) {
      <p-skeleton width="100%" height="400px" />
    }
    @if (chartOptions(); as opts) {
      <div echarts [options]="opts" class="projection-chart"></div>
    }
  </div>

  <!-- Summary Stats -->
  @if (result(); as r) {
    <div class="summary-stats">
      @switch (r.mode) {
        @case ('compound') {
          <div class="stat-card">
            <span class="stat-label">{{ summaryLabel() }} ({{ selectedHorizon() }}y)</span>
            <span class="stat-value positive">{{ formatCurrency($any(r).years[$any(r).years.length - 1].netWorth) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Growth</span>
            @if ($any(r).years.length > 1) {
              <span class="stat-value">{{ (($any(r).years[$any(r).years.length - 1].netWorth - $any(r).years[0].netWorth) / $any(r).years[0].netWorth * 100) | number:'1.0-0' }}%</span>
            }
          </div>
        }
        @case ('scenario') {
          <div class="stat-card pessimistic">
            <span class="stat-label">Pessimistic</span>
            <span class="stat-value">{{ formatCurrency($any(r).years[$any(r).years.length - 1].pessimistic.netWorth) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Base</span>
            <span class="stat-value highlight">{{ formatCurrency($any(r).years[$any(r).years.length - 1].base.netWorth) }}</span>
          </div>
          <div class="stat-card optimistic">
            <span class="stat-label">Optimistic</span>
            <span class="stat-value">{{ formatCurrency($any(r).years[$any(r).years.length - 1].optimistic.netWorth) }}</span>
          </div>
        }
        @case ('monte-carlo') {
          <div class="stat-card pessimistic">
            <span class="stat-label">P10</span>
            <span class="stat-value">{{ formatCurrency($any(r).years[$any(r).years.length - 1].p10) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Likely Range (P25–P75)</span>
            <span class="stat-value">{{ formatCurrency($any(r).years[$any(r).years.length - 1].p25) }} – {{ formatCurrency($any(r).years[$any(r).years.length - 1].p75) }}</span>
          </div>
          <div class="stat-card highlight-card">
            <span class="stat-label">Median (P50)</span>
            <span class="stat-value highlight">{{ formatCurrency($any(r).years[$any(r).years.length - 1].p50) }}</span>
          </div>
          <div class="stat-card optimistic">
            <span class="stat-label">P90</span>
            <span class="stat-value">{{ formatCurrency($any(r).years[$any(r).years.length - 1].p90) }}</span>
          </div>
        }
      }
    </div>
  }

  <!-- Entity Drill-Down Cards -->
  @if (result()) {
    <h3 class="section-heading">Individual Projections</h3>
    <div class="entity-cards">
      @for (card of entityCards(); track card.id) {
        <div class="entity-card" [class.selected]="selectedEntityId() === card.id"
             [class.liability]="card.entityType === 'liability'"
             (click)="selectEntity(card.id)">
          <div class="card-header">
            <div class="card-info">
              <span class="card-label">{{ card.label }}</span>
              <span class="card-meta">{{ card.category }}
                @if (card.contribution?.contributionAmount || card.contribution?.repaymentAmount) {
                  · {{ formatCurrency(card.contribution?.contributionAmount ?? card.contribution?.repaymentAmount ?? 0) }}/{{ card.contribution?.contributionFrequency ?? card.contribution?.repaymentFrequency ?? '' }}
                }
              </span>
            </div>
            <div class="card-values">
              <span class="card-projected" [class.positive]="card.entityType === 'asset'" [class.negative]="card.entityType === 'liability'">
                {{ card.entityType === 'liability' ? '-' : '' }}{{ formatCurrency(card.projectedValue) }}
              </span>
              <span class="card-growth" [class.positive]="card.growth > 0">
                {{ card.growth > 0 ? '+' : '' }}{{ card.growth | number:'1.0-0' }}%
              </span>
            </div>
          </div>
          <!-- Sparkline could be added here with a small inline SVG or mini echarts -->
        </div>
      }
    </div>
  }
</div>
```

- [ ] **Step 3: Create the projections component styles**

Create `src/app/src/app/features/projections/projections.component.scss`:

```scss
.projections-page {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.controls-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: flex-end;
  margin-bottom: 1.5rem;

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;

    label {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}

.horizon-buttons, .scope-buttons {
  display: flex;
  gap: 0.25rem;
}

.horizon-btn, .scope-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 0.375rem;
  background: var(--surface-card);
  color: var(--text-color-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
}

.chart-container {
  background: var(--surface-ground);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.projection-chart {
  width: 100%;
  height: 400px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--surface-card);
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;

  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-bottom: 0.375rem;
  }

  .stat-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 600;

    &.positive { color: var(--green-400); }
    &.highlight { color: var(--text-color); }
  }

  &.pessimistic .stat-value { color: var(--red-400); }
  &.optimistic .stat-value { color: var(--green-400); }
  &.highlight-card { border: 1px solid var(--primary-color); }
}

.section-heading {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-color);
}

.entity-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.entity-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 0.5rem;
  padding: 0.875rem;
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover { border-color: var(--primary-color); }
  &.selected { border-color: var(--primary-color); }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .card-label {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .card-meta {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
  }

  .card-values {
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .card-projected {
    font-size: 0.875rem;
    font-weight: 600;

    &.positive { color: var(--green-400); }
    &.negative { color: var(--red-400); }
  }

  .card-growth {
    font-size: 0.75rem;
    &.positive { color: var(--green-400); }
  }
}

@media (max-width: 768px) {
  .controls-bar { flex-direction: column; align-items: stretch; }
  .projection-chart { height: 300px; }
  .summary-stats { grid-template-columns: repeat(2, 1fr); }
  .entity-cards { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/features/projections/
git commit -m "feat: create projections page component with chart and entity drill-down"
```

---

## Task 10: Wire Up Routing and Navigation

**Files:**
- Modify: `src/app/src/app/app.routes.ts`
- Modify: `src/app/src/app/app.ts`

- [ ] **Step 1: Add projections route**

In `src/app/src/app/app.routes.ts`, add the projections route between the snapshots and settings routes:

```typescript
{
  path: 'projections',
  loadComponent: () =>
    import('./features/projections/projections.component').then((m) => m.ProjectionsComponent),
  canActivate: [requireSetupComplete],
},
```

- [ ] **Step 2: Add Projections link to navigation**

In `src/app/src/app/app.ts`, add "Projections" to the nav items between "Snapshots" and "Settings". Follow the existing pattern for nav links (both desktop and mobile drawer).

Look for the nav items array or template section and add:

```html
<a routerLink="/projections" routerLinkActive="active">Projections</a>
```

- [ ] **Step 3: Verify the frontend builds and the route loads**

Run: `cd src/app && npx ng build --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/app.routes.ts src/app/src/app/app.ts
git commit -m "feat: add projections route and navigation link"
```

---

## Task 11: Historical Returns Service (Phase 2 — Optional)

**Files:**
- Create: `src/api/Clearfolio.Api/Services/HistoricalReturnsService.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs`

This task adds symbol-derived return rates via Yahoo Finance. It can be deferred if external API integration is not desired at launch.

- [ ] **Step 1: Create HistoricalReturnsService**

Create `src/api/Clearfolio.Api/Services/HistoricalReturnsService.cs`:

```csharp
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Clearfolio.Api.Services;

public class HistoricalReturnsService(IHttpClientFactory httpClientFactory, IMemoryCache cache)
{
    public record HistoricalReturn(double AnnualisedReturn, double Volatility, int DataPoints, double PeriodYears);

    public async Task<HistoricalReturn?> GetHistoricalReturn(string symbol)
    {
        var cacheKey = $"historical-return:{symbol}";
        if (cache.TryGetValue(cacheKey, out HistoricalReturn? cached))
            return cached;

        try
        {
            var client = httpClientFactory.CreateClient();
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var fiveYearsAgo = DateTimeOffset.UtcNow.AddYears(-5).ToUnixTimeSeconds();

            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{Uri.EscapeDataString(symbol)}?period1={fiveYearsAgo}&period2={now}&interval=1wk";
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var prices = doc.RootElement
                .GetProperty("chart").GetProperty("result")[0]
                .GetProperty("indicators").GetProperty("adjclose")[0]
                .GetProperty("adjclose");

            var values = new List<double>();
            foreach (var p in prices.EnumerateArray())
            {
                if (p.TryGetDouble(out var v) && v > 0)
                    values.Add(v);
            }

            if (values.Count < 52) return null; // Need at least 1 year of weekly data

            // Calculate weekly returns
            var weeklyReturns = new List<double>();
            for (var i = 1; i < values.Count; i++)
                weeklyReturns.Add(values[i] / values[i - 1] - 1);

            var meanWeekly = weeklyReturns.Average();
            var variance = weeklyReturns.Sum(r => (r - meanWeekly) * (r - meanWeekly)) / (weeklyReturns.Count - 1);
            var stdDevWeekly = Math.Sqrt(variance);

            // Geometric annualisation
            var annualisedReturn = Math.Pow(1 + meanWeekly, 52) - 1;
            var annualisedVolatility = stdDevWeekly * Math.Sqrt(52);

            var periodYears = values.Count / 52.0;
            var result = new HistoricalReturn(
                Math.Round(annualisedReturn, 4),
                Math.Round(annualisedVolatility, 4),
                values.Count,
                Math.Round(periodYears, 1));

            cache.Set(cacheKey, result, TimeSpan.FromHours(24));
            return result;
        }
        catch
        {
            return null;
        }
    }
}
```

- [ ] **Step 2: Register services in Program.cs**

In `Program.cs`, add before `var app = builder.Build();`:

```csharp
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<HistoricalReturnsService>();
```

- [ ] **Step 3: Add historical-returns endpoint**

In `ProjectionEndpoints.cs`, add the route mapping:

```csharp
app.MapGet("/api/historical-returns/{symbol}", GetHistoricalReturns);
```

And the handler:

```csharp
private static async Task<IResult> GetHistoricalReturns(
    string symbol, HttpContext context, HistoricalReturnsService service)
{
    var member = GetMemberOrNull(context);
    if (member is null) return Results.Unauthorized();

    var result = await service.GetHistoricalReturn(symbol);
    if (result is null) return Results.NotFound();

    return Results.Ok(new
    {
        symbol,
        annualisedReturn = result.AnnualisedReturn,
        volatility = result.Volatility,
        dataPoints = result.DataPoints,
        periodYears = result.PeriodYears,
    });
}
```

- [ ] **Step 4: Integrate symbol-derived rates into BuildEntityInputs**

In `BuildEntityInputs`, after loading assets, resolve symbol-derived rates for assets that have a `Symbol` and no `ExpectedReturnRate` override:

```csharp
// Resolve symbol-derived rates (injected service needed)
// For assets with Symbol and no override, call service.GetHistoricalReturn(symbol)
// Use the result to set effectiveRate and effectiveVol, falling back to type defaults
```

**Note:** This requires refactoring `BuildEntityInputs` to accept `HistoricalReturnsService` as a parameter, or moving the resolution logic into the endpoint handlers. Follow the pattern that keeps the code simplest.

- [ ] **Step 5: Verify the API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 6: Commit**

```bash
git add src/api/Clearfolio.Api/Services/HistoricalReturnsService.cs src/api/Clearfolio.Api/Endpoints/ProjectionEndpoints.cs src/api/Clearfolio.Api/Program.cs
git commit -m "feat: add historical returns service with Yahoo Finance integration"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Start the backend API**

Run: `cd src/api/Clearfolio.Api && dotnet run`
Verify: API starts without errors

- [ ] **Step 2: Start the Angular frontend**

Run: `cd src/app && npx ng serve`
Verify: Frontend compiles and serves

- [ ] **Step 3: Manual verification checklist**

1. Navigate to `/projections` — page loads with controls
2. Switch between Compound Growth / Scenarios / Monte Carlo — chart updates
3. Change horizon (1y, 5y, 10y, custom) — chart updates
4. Change scope (All / Financial / Liquid) — chart updates
5. Edit an asset — new "Projections" section visible with contribution fields
6. Edit a liability — new "Projections" section visible with repayment fields
7. Save contribution on an asset, re-run projection — values reflect contributions
8. Click entity cards — main chart filters to that entity
9. Simulations input appears only in Monte Carlo mode

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
