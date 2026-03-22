using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clearfolio.Api.Endpoints;

public static class HouseholdEndpoints
{
    public static WebApplication MapHouseholdEndpoints(this WebApplication app)
    {
        app.MapGet("/api/household", GetHousehold);
        app.MapPut("/api/household", UpdateHousehold).AddEndpointFilter<ValidationFilter<UpdateHouseholdRequest>>();
        app.MapDelete("/api/household", DeleteHousehold);
        app.MapGet("/api/export", ExportData);
        app.MapPost("/api/import", ImportData);
        return app;
    }

    private static IResult GetHousehold(HttpContext context)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var h = member.Household;
        return Results.Ok(new HouseholdDto(h.Id, h.Name, h.BaseCurrency, h.PreferredPeriodType, h.Locale, h.CreatedAt));
    }

    private static async Task<IResult> UpdateHousehold(HttpContext context, UpdateHouseholdRequest request, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.FindAsync(member.HouseholdId);
        if (household is null) return Results.NotFound();

        string[] allowedLocales = ["en-AU", "en-US", "en-GB", "en-NZ", "en-CA", "en-IE"];
        if (!allowedLocales.Contains(request.Locale))
            return ApiErrors.BadRequest("Invalid locale. Allowed values: en-AU, en-US, en-GB, en-NZ, en-CA, en-IE.");

        household.Name = request.Name;
        household.BaseCurrency = request.BaseCurrency;
        household.PreferredPeriodType = request.PreferredPeriodType;
        household.Locale = request.Locale;

        await db.SaveChangesAsync();

        return Results.Ok(new HouseholdDto(household.Id, household.Name, household.BaseCurrency, household.PreferredPeriodType, household.Locale, household.CreatedAt));
    }

    private static async Task<IResult> DeleteHousehold(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        if (!member.IsPrimary) return Results.Forbid();

        var householdId = member.HouseholdId;

        await using var transaction = await db.Database.BeginTransactionAsync();

        await db.Snapshots.Where(s => s.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Assets.Where(a => a.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Liabilities.Where(l => l.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Expenses.Where(e => e.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.IncomeStreams.Where(i => i.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.ExpenseCategories.Where(c => c.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.HouseholdMembers.Where(m => m.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Households.Where(h => h.Id == householdId).ExecuteDeleteAsync();

        await transaction.CommitAsync();

        return Results.NoContent();
    }

    private static async Task<IResult> ExportData(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var householdId = member.HouseholdId;
        var household = member.Household;

        var members = await db.HouseholdMembers
            .Where(m => m.HouseholdId == householdId)
            .OrderBy(m => m.MemberTag)
            .ToListAsync();

        var memberLookup = members.ToDictionary(m => m.Id, m => m.MemberTag);

        var assetTypes = await db.AssetTypes
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .ToListAsync();

        var liabilityTypes = await db.LiabilityTypes
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .ToListAsync();

        var assetTypeLookup = assetTypes.ToDictionary(t => t.Id, t => t.Name);
        var liabilityTypeLookup = liabilityTypes.ToDictionary(t => t.Id, t => t.Name);

        var assets = await db.Assets
            .Where(a => a.HouseholdId == householdId)
            .OrderBy(a => a.Label)
            .ToListAsync();

        var liabilities = await db.Liabilities
            .Where(l => l.HouseholdId == householdId)
            .OrderBy(l => l.Label)
            .ToListAsync();

        // Build entity label lookup for snapshots
        var entityLabelLookup = new Dictionary<Guid, (string Label, string Type)>();
        foreach (var a in assets)
            entityLabelLookup[a.Id] = (a.Label, "asset");
        foreach (var l in liabilities)
            entityLabelLookup[l.Id] = (l.Label, "liability");

        var snapshots = await db.Snapshots
            .Where(s => s.HouseholdId == householdId)
            .OrderBy(s => s.Period)
            .ThenBy(s => s.EntityId)
            .ToListAsync();

        var expenseCategories = await db.ExpenseCategories
            .Where(c => c.HouseholdId == householdId)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var incomeStreams = await db.IncomeStreams
            .Where(i => i.HouseholdId == householdId)
            .OrderBy(i => i.Label)
            .ToListAsync();

        var expenseItems = await db.Expenses
            .Include(e => e.ExpenseCategory)
            .Where(e => e.HouseholdId == householdId)
            .OrderBy(e => e.Label)
            .ToListAsync();

        var export = new ExportDto(
            Version: "1",
            ExportedAt: DateTime.UtcNow.ToString("o"),
            Household: new ExportHouseholdDto(household.Name, household.BaseCurrency, household.PreferredPeriodType, household.Locale),
            Members: members.Select(m => new ExportMemberDto(m.Email, m.DisplayName, m.MemberTag, m.IsPrimary)).ToList(),
            AssetTypes: assetTypes.Select(t => new ExportAssetTypeDto(
                t.Name, t.Category, t.Liquidity, t.GrowthClass, t.IsSuper, t.IsCgtExempt, t.SortOrder, t.DefaultReturnRate, t.DefaultVolatility
            )).ToList(),
            LiabilityTypes: liabilityTypes.Select(t => new ExportLiabilityTypeDto(
                t.Name, t.Category, t.DebtQuality, t.IsHecs, t.SortOrder
            )).ToList(),
            Assets: assets.Select(a => new ExportAssetDto(
                assetTypeLookup.TryGetValue(a.AssetTypeId, out var atn) ? atn : null,
                null,
                a.OwnerMemberId.HasValue && memberLookup.TryGetValue(a.OwnerMemberId.Value, out var atag) ? atag : null,
                a.OwnershipType, a.JointSplit, a.Label, a.Symbol, a.Currency, a.Notes, a.IsActive,
                a.ContributionAmount, a.ContributionFrequency, a.ContributionEndDate, a.IsPreTaxContribution, a.ExpectedReturnRate, a.ExpectedVolatility
            )).ToList(),
            Liabilities: liabilities.Select(l => new ExportLiabilityDto(
                liabilityTypeLookup.TryGetValue(l.LiabilityTypeId, out var ltn) ? ltn : null,
                null,
                l.OwnerMemberId.HasValue && memberLookup.TryGetValue(l.OwnerMemberId.Value, out var ltag) ? ltag : null,
                l.OwnershipType, l.JointSplit, l.Label, l.Currency, l.Notes, l.IsActive,
                l.RepaymentAmount, l.RepaymentFrequency, l.RepaymentEndDate, l.InterestRate
            )).ToList(),
            Snapshots: snapshots
                .Where(s => entityLabelLookup.ContainsKey(s.EntityId))
                .Select(s => new ExportSnapshotDto(
                    entityLabelLookup[s.EntityId].Label,
                    entityLabelLookup[s.EntityId].Type,
                    s.Period, s.Value, s.Currency, s.Notes,
                    memberLookup.TryGetValue(s.RecordedBy, out var stag) ? stag : "unknown",
                    s.RecordedAt
                )).ToList(),
            ExpenseCategories: expenseCategories.Select(c => new ExportExpenseCategoryDto(c.Name, c.SortOrder, c.IsDefault)).ToList(),
            IncomeStreams: incomeStreams.Select(i => new ExportIncomeStreamDto(
                i.OwnerMemberId != Guid.Empty && memberLookup.TryGetValue(i.OwnerMemberId, out var itag) ? itag : null,
                i.Label, i.IncomeType, i.Amount, i.Frequency, i.IsActive, i.Notes
            )).ToList(),
            Expenses: expenseItems.Select(e => new ExportExpenseDto(
                e.OwnerMemberId.HasValue && memberLookup.TryGetValue(e.OwnerMemberId.Value, out var etag) ? etag : null,
                e.ExpenseCategory.Name, e.Label, e.Amount, e.Frequency, e.IsActive, e.Notes
            )).ToList()
        );

        return Results.Ok(export);
    }

    private static async Task<IResult> ImportData(ExportDto data, HttpContext context, ClearfolioDbContext db, IConfiguration config)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        if (!member.IsPrimary) return Results.Forbid();

        if (data.Version != "1") return ApiErrors.BadRequest("Unsupported export version.");

        // #8: Create database backup before destructive import
        var dbPath = config["DB_PATH"] ?? "clearfolio.db";
        if (File.Exists(dbPath))
        {
            var backupPath = $"{dbPath}.{DateTime.UtcNow:yyyyMMddHHmmss}.pre-import-backup";
            File.Copy(dbPath, backupPath, overwrite: true);
        }

        var householdId = member.HouseholdId;

        await using var transaction = await db.Database.BeginTransactionAsync();

        // Delete all existing data
        await db.Snapshots.Where(s => s.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Assets.Where(a => a.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Liabilities.Where(l => l.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Expenses.Where(e => e.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.IncomeStreams.Where(i => i.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.ExpenseCategories.Where(c => c.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.HouseholdMembers.Where(m => m.HouseholdId == householdId).ExecuteDeleteAsync();

        // Update household settings
        var household = await db.Households.FindAsync(householdId);
        if (household is null) return Results.NotFound();
        household.Name = data.Household.Name;
        household.BaseCurrency = data.Household.BaseCurrency;
        household.PreferredPeriodType = data.Household.PreferredPeriodType;
        household.Locale = data.Household.Locale ?? "en-AU";

        // Import members — map tag to new ID
        var memberTagToId = new Dictionary<string, Guid>();
        foreach (var m in data.Members)
        {
            var id = Guid.NewGuid();
            memberTagToId[m.MemberTag] = id;
            db.HouseholdMembers.Add(new HouseholdMember
            {
                Id = id,
                HouseholdId = householdId,
                Email = m.Email,
                DisplayName = m.DisplayName,
                MemberTag = m.MemberTag,
                IsPrimary = m.IsPrimary,
                CreatedAt = DateTime.UtcNow.ToString("o")
            });
        }

        // Import asset types — match by name, create missing
        var existingAssetTypes = await db.AssetTypes.ToListAsync();
        var assetTypeNameToId = existingAssetTypes.ToDictionary(t => t.Name, t => t.Id);
        if (data.AssetTypes is { Count: > 0 })
        {
            var maxSort = existingAssetTypes.Count > 0 ? existingAssetTypes.Max(t => t.SortOrder) : 0;
            foreach (var t in data.AssetTypes)
            {
                if (assetTypeNameToId.ContainsKey(t.Name)) continue;
                var id = Guid.NewGuid();
                assetTypeNameToId[t.Name] = id;
                db.AssetTypes.Add(new AssetType
                {
                    Id = id,
                    Name = t.Name,
                    Category = t.Category,
                    Liquidity = t.Liquidity,
                    GrowthClass = t.GrowthClass,
                    IsSuper = t.IsSuper,
                    IsCgtExempt = t.IsCgtExempt,
                    SortOrder = ++maxSort,
                    IsSystem = false,
                    DefaultReturnRate = t.DefaultReturnRate,
                    DefaultVolatility = t.DefaultVolatility,
                });
            }
        }

        // Import liability types — match by name, create missing
        var existingLiabilityTypes = await db.LiabilityTypes.ToListAsync();
        var liabilityTypeNameToId = existingLiabilityTypes.ToDictionary(t => t.Name, t => t.Id);
        if (data.LiabilityTypes is { Count: > 0 })
        {
            var maxSort = existingLiabilityTypes.Count > 0 ? existingLiabilityTypes.Max(t => t.SortOrder) : 0;
            foreach (var t in data.LiabilityTypes)
            {
                if (liabilityTypeNameToId.ContainsKey(t.Name)) continue;
                var id = Guid.NewGuid();
                liabilityTypeNameToId[t.Name] = id;
                db.LiabilityTypes.Add(new LiabilityType
                {
                    Id = id,
                    Name = t.Name,
                    Category = t.Category,
                    DebtQuality = t.DebtQuality,
                    IsHecs = t.IsHecs,
                    SortOrder = ++maxSort,
                    IsSystem = false,
                });
            }
        }

        // Import assets — map label to new ID
        var assetLabelToId = new Dictionary<string, Guid>();
        var now = DateTime.UtcNow.ToString("o");
        foreach (var a in data.Assets)
        {
            // Resolve type: prefer name lookup, fall back to GUID for v1 compat
            Guid assetTypeId;
            if (a.AssetTypeName != null && assetTypeNameToId.TryGetValue(a.AssetTypeName, out var resolvedAtId))
                assetTypeId = resolvedAtId;
            else if (a.AssetTypeId.HasValue)
                assetTypeId = a.AssetTypeId.Value;
            else
                continue; // skip asset with unresolvable type

            var id = Guid.NewGuid();
            assetLabelToId[a.Label] = id;
            db.Assets.Add(new Asset
            {
                Id = id,
                HouseholdId = householdId,
                AssetTypeId = assetTypeId,
                OwnerMemberId = a.OwnerMemberTag != null && memberTagToId.TryGetValue(a.OwnerMemberTag, out var oid) ? oid : null,
                OwnershipType = a.OwnershipType,
                JointSplit = a.JointSplit,
                Label = a.Label,
                Symbol = a.Symbol,
                Currency = a.Currency,
                Notes = a.Notes,
                IsActive = a.IsActive,
                ContributionAmount = a.ContributionAmount,
                ContributionFrequency = a.ContributionFrequency,
                ContributionEndDate = a.ContributionEndDate,
                IsPreTaxContribution = a.IsPreTaxContribution,
                ExpectedReturnRate = a.ExpectedReturnRate,
                ExpectedVolatility = a.ExpectedVolatility,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        // Import liabilities — map label to new ID
        var liabilityLabelToId = new Dictionary<string, Guid>();
        foreach (var l in data.Liabilities)
        {
            // Resolve type: prefer name lookup, fall back to GUID for v1 compat
            Guid liabilityTypeId;
            if (l.LiabilityTypeName != null && liabilityTypeNameToId.TryGetValue(l.LiabilityTypeName, out var resolvedLtId))
                liabilityTypeId = resolvedLtId;
            else if (l.LiabilityTypeId.HasValue)
                liabilityTypeId = l.LiabilityTypeId.Value;
            else
                continue; // skip liability with unresolvable type

            var id = Guid.NewGuid();
            liabilityLabelToId[l.Label] = id;
            db.Liabilities.Add(new Liability
            {
                Id = id,
                HouseholdId = householdId,
                LiabilityTypeId = liabilityTypeId,
                OwnerMemberId = l.OwnerMemberTag != null && memberTagToId.TryGetValue(l.OwnerMemberTag, out var oid) ? oid : null,
                OwnershipType = l.OwnershipType,
                JointSplit = l.JointSplit,
                Label = l.Label,
                Currency = l.Currency,
                Notes = l.Notes,
                IsActive = l.IsActive,
                RepaymentAmount = l.RepaymentAmount,
                RepaymentFrequency = l.RepaymentFrequency,
                RepaymentEndDate = l.RepaymentEndDate,
                InterestRate = l.InterestRate,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        // Import snapshots
        foreach (var s in data.Snapshots)
        {
            Guid entityId;
            if (s.EntityType == "asset" && assetLabelToId.TryGetValue(s.EntityLabel, out var aid))
                entityId = aid;
            else if (s.EntityType == "liability" && liabilityLabelToId.TryGetValue(s.EntityLabel, out var lid))
                entityId = lid;
            else
                continue; // skip orphaned snapshots

            var recordedBy = s.RecordedByMemberTag != null && memberTagToId.TryGetValue(s.RecordedByMemberTag, out var rid)
                ? rid
                : memberTagToId.Values.FirstOrDefault();

            if (recordedBy == Guid.Empty) continue;

            db.Snapshots.Add(new Snapshot
            {
                Id = Guid.NewGuid(),
                HouseholdId = householdId,
                EntityId = entityId,
                EntityType = s.EntityType,
                Period = s.Period,
                Value = s.Value,
                Currency = s.Currency,
                Notes = s.Notes,
                RecordedBy = recordedBy,
                RecordedAt = s.RecordedAt
            });
        }

        // Import expense categories (or seed defaults)
        var categoryNameToId = new Dictionary<string, Guid>();
        if (data.ExpenseCategories is { Count: > 0 })
        {
            foreach (var c in data.ExpenseCategories)
            {
                var id = Guid.NewGuid();
                categoryNameToId[c.Name] = id;
                db.ExpenseCategories.Add(new ExpenseCategory
                {
                    Id = id,
                    HouseholdId = householdId,
                    Name = c.Name,
                    SortOrder = c.SortOrder,
                    IsDefault = c.IsDefault,
                    CreatedAt = now
                });
            }
        }
        else
        {
            ExpenseCategoriesEndpoints.SeedDefaultCategories(db, householdId);
            foreach (var entry in db.ChangeTracker.Entries<ExpenseCategory>()
                .Where(e => e.State == EntityState.Added && e.Entity.HouseholdId == householdId))
            {
                categoryNameToId[entry.Entity.Name] = entry.Entity.Id;
            }
        }

        // Import income streams
        if (data.IncomeStreams is { Count: > 0 })
        {
            foreach (var i in data.IncomeStreams)
            {
                db.IncomeStreams.Add(new IncomeStream
                {
                    Id = Guid.NewGuid(),
                    HouseholdId = householdId,
                    OwnerMemberId = i.OwnerMemberTag != null && memberTagToId.TryGetValue(i.OwnerMemberTag, out var oid) ? oid : memberTagToId.Values.First(),
                    Label = i.Label,
                    IncomeType = i.IncomeType,
                    Amount = i.Amount,
                    Frequency = i.Frequency,
                    IsActive = i.IsActive,
                    Notes = i.Notes,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }

        // Import expenses
        if (data.Expenses is { Count: > 0 })
        {
            foreach (var e in data.Expenses)
            {
                if (!categoryNameToId.TryGetValue(e.ExpenseCategoryName, out var catId)) continue;

                db.Expenses.Add(new Expense
                {
                    Id = Guid.NewGuid(),
                    HouseholdId = householdId,
                    OwnerMemberId = e.OwnerMemberTag != null && memberTagToId.TryGetValue(e.OwnerMemberTag, out var oid) ? oid : null,
                    ExpenseCategoryId = catId,
                    Label = e.Label,
                    Amount = e.Amount,
                    Frequency = e.Frequency,
                    IsActive = e.IsActive,
                    Notes = e.Notes,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Ok(new { imported = true });
    }

}
