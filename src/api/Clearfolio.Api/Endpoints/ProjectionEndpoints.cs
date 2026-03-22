using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;
using Clearfolio.Api.Services;

namespace Clearfolio.Api.Endpoints;

public static class ProjectionEndpoints
{
    public static void MapProjectionEndpoints(this WebApplication app)
    {
        app.MapPost("/api/projections/compound", RunCompoundProjection).AddEndpointFilter<ValidationFilter<ProjectionRequest>>();
        app.MapPost("/api/projections/scenario", RunScenarioProjection).AddEndpointFilter<ValidationFilter<ProjectionRequest>>();
        app.MapPost("/api/projections/monte-carlo", RunMonteCarloProjection).AddEndpointFilter<ValidationFilter<ProjectionRequest>>();
        app.MapGet("/api/projections/defaults", GetDefaults);
        app.MapGet("/api/historical-returns/{symbol}", GetHistoricalReturns).RequireRateLimiting("external-api");
    }

    private static async Task<IResult> RunCompoundProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return ApiErrors.BadRequest("Horizon must be 1-50 years");

        var inputs = await BuildEntityInputs(db, member, request);
        var inflation = request.InflationRate ?? 0;
        var result = ProjectionEngine.RunCompound(inputs, request.Horizon, inflation);

        return Results.Ok(new { mode = "compound", result.Horizon, inflationAdjusted = inflation > 0, result.Years, result.Entities });
    }

    private static async Task<IResult> RunScenarioProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return ApiErrors.BadRequest("Horizon must be 1-50 years");

        var inputs = await BuildEntityInputs(db, member, request);
        var inflation = request.InflationRate ?? 0;
        var result = ProjectionEngine.RunScenario(inputs, request.Horizon, inflation);

        return Results.Ok(new { mode = "scenario", result.Horizon, inflationAdjusted = inflation > 0, result.Years, result.Entities });
    }

    private static async Task<IResult> RunMonteCarloProjection(ProjectionRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        if (request.Horizon < 1 || request.Horizon > 50) return ApiErrors.BadRequest("Horizon must be 1-50 years");

        var sims = Math.Clamp(request.Simulations ?? 1000, 100, 10000);
        var inflation = request.InflationRate ?? 0;
        var inputs = await BuildEntityInputs(db, member, request);

        // #11: Limit entity count to prevent excessive memory allocation
        if (inputs.Count > 100)
            return ApiErrors.BadRequest("Monte Carlo simulation is limited to 100 entities.");

        var result = ProjectionEngine.RunMonteCarlo(inputs, request.Horizon, sims, inflation);

        return Results.Ok(new { mode = "monte-carlo", result.Horizon, result.Simulations, inflationAdjusted = inflation > 0, result.Years, result.Entities });
    }

    private static async Task<IResult> GetDefaults(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
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
                FrequencyHelper.NormaliseContribution(a.ContributionAmount, a.ContributionFrequency),
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
                FrequencyHelper.NormaliseContribution(l.RepaymentAmount, l.RepaymentFrequency),
                hasSnapshot ? snapshotValue : null,
                hasSnapshot));
        }

        return Results.Ok(results);
    }

    // --- Shared helpers ---

    private static async Task<List<ProjectionEngine.EntityInput>> BuildEntityInputs(
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

        // Apply scope filter — projections exclude all liabilities for "liquid" scope
        assets = OwnershipHelper.ApplyAssetScopeFilter(assets, request.Scope ?? "all");
        liabilities = request.Scope == "liquid"
            ? []
            : OwnershipHelper.ApplyLiabilityScopeFilter(liabilities, request.Scope ?? "all");

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

        var inputs = new List<ProjectionEngine.EntityInput>();

        foreach (var a in assets)
        {
            if (!latestSnapshots.TryGetValue(a.Id, out var value)) continue;

            value = OwnershipHelper.ApplyViewFilter(value, a.OwnershipType, a.OwnerMemberId, a.JointSplit, members, request.View);
            if (value == 0) continue;

            var effectiveRate = a.ExpectedReturnRate ?? a.AssetType.DefaultReturnRate;
            var effectiveVol = a.ExpectedVolatility ?? a.AssetType.DefaultVolatility;

            inputs.Add(new ProjectionEngine.EntityInput(
                a.Id, a.Label, a.AssetType.Category, "asset",
                value,
                FrequencyHelper.NormaliseContribution(a.ContributionAmount, a.ContributionFrequency),
                effectiveRate, effectiveVol, 0,
                a.ContributionEndDate));
        }

        foreach (var l in liabilities)
        {
            if (!latestSnapshots.TryGetValue(l.Id, out var value)) continue;

            value = OwnershipHelper.ApplyViewFilter(value, l.OwnershipType, l.OwnerMemberId, l.JointSplit, members, request.View);
            if (value == 0) continue;

            inputs.Add(new ProjectionEngine.EntityInput(
                l.Id, l.Label, l.LiabilityType.Category, "liability",
                value,
                FrequencyHelper.NormaliseContribution(l.RepaymentAmount, l.RepaymentFrequency),
                0, 0, l.InterestRate ?? 0,
                l.RepaymentEndDate));
        }

        return inputs;
    }

    private static async Task<IResult> GetHistoricalReturns(
        string symbol, HttpContext context, HistoricalReturnsService service)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var result = await service.GetHistoricalReturn(symbol);
        if (result is null) return Results.NotFound();

        return Results.Ok(new HistoricalReturnDto(
            symbol,
            result.AnnualisedReturn,
            result.ArithmeticReturn,
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
