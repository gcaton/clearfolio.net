using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class ReferenceEndpoints
{
    private static readonly HashSet<string> AssetCategories = ["cash", "investable", "property", "retirement", "other"];
    private static readonly HashSet<string> AssetLiquidity = ["immediate", "short_term", "long_term", "restricted"];
    private static readonly HashSet<string> GrowthClasses = ["defensive", "growth", "mixed"];
    private static readonly HashSet<string> LiabilityCategories = ["mortgage", "personal", "credit", "student", "tax", "other"];
    private static readonly HashSet<string> DebtQualities = ["productive", "neutral", "bad"];

    public static WebApplication MapReferenceEndpoints(this WebApplication app)
    {
        app.MapGet("/api/asset-types", GetAssetTypes);
        app.MapPost("/api/asset-types", CreateAssetType);
        app.MapPut("/api/asset-types/{id:guid}", UpdateAssetType);
        app.MapDelete("/api/asset-types/{id:guid}", DeleteAssetType);

        app.MapGet("/api/liability-types", GetLiabilityTypes);
        app.MapPost("/api/liability-types", CreateLiabilityType);
        app.MapPut("/api/liability-types/{id:guid}", UpdateLiabilityType);
        app.MapDelete("/api/liability-types/{id:guid}", DeleteLiabilityType);

        return app;
    }

    private static async Task<IResult> GetAssetTypes(ClearfolioDbContext db)
    {
        var types = await db.AssetTypes
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .Select(t => new AssetTypeDto(
                t.Id, t.Name, t.Category, t.Liquidity, t.GrowthClass,
                t.IsSuper, t.IsCgtExempt, t.SortOrder, t.IsSystem,
                DefaultReturnRate: t.DefaultReturnRate,
                DefaultVolatility: t.DefaultVolatility))
            .ToListAsync();

        return Results.Ok(types);
    }

    private static async Task<IResult> GetLiabilityTypes(ClearfolioDbContext db)
    {
        var types = await db.LiabilityTypes
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .Select(t => new LiabilityTypeDto(
                t.Id, t.Name, t.Category, t.DebtQuality,
                t.IsHecs, t.SortOrder, t.IsSystem))
            .ToListAsync();

        return Results.Ok(types);
    }

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

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
