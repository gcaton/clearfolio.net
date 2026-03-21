using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class AssetsEndpoints
{
    public static WebApplication MapAssetsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/assets", GetAssets);
        app.MapPost("/api/assets", CreateAsset);
        app.MapPut("/api/assets/{id:guid}", UpdateAsset);
        app.MapDelete("/api/assets/{id:guid}", DeleteAsset);
        return app;
    }

    private static async Task<IResult> GetAssets(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var assets = await db.Assets
            .AsNoTracking()
            .Include(a => a.AssetType)
            .Include(a => a.OwnerMember)
            .Where(a => a.HouseholdId == member.HouseholdId && a.IsActive)
            .OrderBy(a => a.AssetType.SortOrder)
            .ThenBy(a => a.Label)
            .Select(a => ToDto(a))
            .ToListAsync();

        return Results.Ok(assets);
    }

    private static async Task<IResult> CreateAsset(CreateAssetRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        var now = DateTime.UtcNow.ToString("o");

        var asset = new Asset
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            AssetTypeId = request.AssetTypeId,
            OwnerMemberId = request.OwnerMemberId,
            OwnershipType = request.OwnershipType,
            JointSplit = request.JointSplit,
            Label = request.Label,
            Symbol = request.Symbol?.Trim().ToUpperInvariant(),
            Currency = request.Currency,
            Notes = request.Notes,
            ContributionAmount = request.ContributionAmount,
            ContributionFrequency = request.ContributionFrequency,
            ContributionEndDate = request.ContributionEndDate,
            ExpectedReturnRate = request.ExpectedReturnRate,
            ExpectedVolatility = request.ExpectedVolatility,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Assets.Add(asset);
        await db.SaveChangesAsync();

        await db.Entry(asset).Reference(a => a.AssetType).LoadAsync();
        if (asset.OwnerMemberId is not null)
            await db.Entry(asset).Reference(a => a.OwnerMember).LoadAsync();

        return Results.Created($"/api/assets/{asset.Id}", ToDto(asset));
    }

    private static async Task<IResult> UpdateAsset(Guid id, UpdateAssetRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var asset = await db.Assets
            .Include(a => a.AssetType)
            .Include(a => a.OwnerMember)
            .FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == member.HouseholdId);

        if (asset is null) return Results.NotFound();

        asset.AssetTypeId = request.AssetTypeId;
        asset.OwnerMemberId = request.OwnerMemberId;
        asset.OwnershipType = request.OwnershipType;
        asset.JointSplit = request.JointSplit;
        asset.Label = request.Label;
        asset.Symbol = request.Symbol?.Trim().ToUpperInvariant();
        asset.Currency = request.Currency;
        asset.Notes = request.Notes;
        asset.ContributionAmount = request.ContributionAmount;
        asset.ContributionFrequency = request.ContributionFrequency;
        asset.ContributionEndDate = request.ContributionEndDate;
        asset.ExpectedReturnRate = request.ExpectedReturnRate;
        asset.ExpectedVolatility = request.ExpectedVolatility;
        asset.UpdatedAt = DateTime.UtcNow.ToString("o");

        await db.SaveChangesAsync();

        await db.Entry(asset).Reference(a => a.AssetType).LoadAsync();
        if (asset.OwnerMemberId is not null)
            await db.Entry(asset).Reference(a => a.OwnerMember).LoadAsync();

        return Results.Ok(ToDto(asset));
    }

    private static async Task<IResult> DeleteAsset(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var asset = await db.Assets.FirstOrDefaultAsync(a => a.Id == id && a.HouseholdId == member.HouseholdId);
        if (asset is null) return Results.NotFound();

        asset.IsActive = false;
        asset.UpdatedAt = DateTime.UtcNow.ToString("o");
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static AssetDto ToDto(Asset a) => new(
        a.Id, a.AssetTypeId, a.AssetType.Name,
        a.OwnerMemberId, a.OwnerMember?.DisplayName,
        a.OwnershipType, a.JointSplit,
        a.Label, a.Symbol, a.Currency, a.Notes, a.IsActive,
        a.CreatedAt, a.UpdatedAt,
        ContributionAmount: a.ContributionAmount,
        ContributionFrequency: a.ContributionFrequency,
        ContributionEndDate: a.ContributionEndDate,
        ExpectedReturnRate: a.ExpectedReturnRate,
        ExpectedVolatility: a.ExpectedVolatility);

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
