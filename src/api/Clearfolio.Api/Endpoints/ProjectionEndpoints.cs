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
        app.MapGet("/api/historical-returns/{symbol}", GetHistoricalReturns);
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

    private static async Task<IResult> GetHistoricalReturns(
        string symbol, HttpContext context, HistoricalReturnsService service)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var result = await service.GetHistoricalReturn(symbol);
        if (result is null) return Results.NotFound();

        return Results.Ok(new HistoricalReturnDto(
            symbol,
            result.AnnualisedReturn,
            result.Volatility,
            result.DataPoints,
            result.PeriodYears));
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
