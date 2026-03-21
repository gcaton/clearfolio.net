using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;

namespace Clearfolio.Api.Endpoints;

public static class ReferenceEndpoints
{
    public static WebApplication MapReferenceEndpoints(this WebApplication app)
    {
        app.MapGet("/api/asset-types", GetAssetTypes);
        app.MapGet("/api/liability-types", GetLiabilityTypes);
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
}
