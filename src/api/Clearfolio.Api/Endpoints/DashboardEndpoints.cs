using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static partial class DashboardEndpoints
{
    // #13: Use GeneratedRegex instead of Regex.Match in loops
    [GeneratedRegex(@"^(CY|FY)(\d{4})")]
    private static partial Regex YearPattern();

    public static WebApplication MapDashboardEndpoints(this WebApplication app)
    {
        app.MapGet("/api/dashboard/summary", GetSummary);
        app.MapGet("/api/dashboard/trend", GetTrend);
        app.MapGet("/api/dashboard/goal-projection", GetGoalProjection);
        app.MapGet("/api/dashboard/composition", GetComposition);
        app.MapGet("/api/dashboard/members", GetMembers);
        app.MapGet("/api/dashboard/super-gap", GetSuperGap);
        app.MapGet("/api/dashboard/asset-performance", GetAssetPerformance);
        return app;
    }

    private static async Task<IResult> GetSummary(HttpContext context, ClearfolioDbContext db, string? period = null, string view = "household", string scope = "all")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var snapshots = await GetEffectiveSnapshots(db, member.HouseholdId, period);
        var assets = OwnershipHelper.ApplyAssetScopeFilter(await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync(), scope);
        var liabilities = OwnershipHelper.ApplyLiabilityScopeFilter(await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync(), scope);
        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();

        var assetValues = CalculateAssetValues(snapshots, assets, members, view);
        var liabilityValues = CalculateLiabilityValues(snapshots, liabilities, members, view);

        var totalAssets = assetValues.Sum(v => v.Value);
        var totalLiabilities = liabilityValues.Sum(v => v.Value);

        var previousPeriod = PeriodHelper.PreviousPeriod(period);
        var prevSnapshots = await GetEffectiveSnapshots(db, member.HouseholdId, previousPeriod);
        var prevAssetTotal = CalculateAssetValues(prevSnapshots, assets, members, view).Sum(v => v.Value);
        var prevLiabilityTotal = CalculateLiabilityValues(prevSnapshots, liabilities, members, view).Sum(v => v.Value);
        var prevNetWorth = prevAssetTotal - prevLiabilityTotal;

        double? previousNetWorth = prevSnapshots.Count > 0 ? prevNetWorth : null;
        double? netWorthChange = previousNetWorth.HasValue ? (totalAssets - totalLiabilities) - previousNetWorth.Value : null;
        double? netWorthChangePercent = previousNetWorth is > 0 ? (netWorthChange!.Value / previousNetWorth.Value) * 100 : null;

        return Results.Ok(new DashboardSummaryDto(
            period, view, totalAssets, totalLiabilities, totalAssets - totalLiabilities,
            previousNetWorth, netWorthChange, netWorthChangePercent,
            assetValues.GroupBy(v => v.Category).Select(g => new CategoryBreakdownDto(g.Key, g.Sum(x => x.Value))).ToList(),
            liabilityValues.GroupBy(v => v.Category).Select(g => new CategoryBreakdownDto(g.Key, g.Sum(x => x.Value))).ToList(),
            assetValues.GroupBy(v => v.Liquidity).Select(g => new LiquidityBreakdownDto(g.Key, g.Sum(x => x.Value))).ToList(),
            assetValues.GroupBy(v => v.GrowthClass).Select(g => new GrowthBreakdownDto(g.Key, g.Sum(x => x.Value))).ToList(),
            liabilityValues.GroupBy(v => v.DebtQuality).Select(g => new DebtQualityBreakdownDto(g.Key, g.Sum(x => x.Value))).ToList()
        ));
    }

    private static async Task<IResult> GetTrend(HttpContext context, ClearfolioDbContext db, string view = "household", string scope = "all")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        var currentPeriod = PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var allAssetsRaw = await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();
        var assets = OwnershipHelper.ApplyAssetScopeFilter(allAssetsRaw, scope);
        var financialAssets = OwnershipHelper.ApplyAssetScopeFilter(allAssetsRaw, "financial");
        var liabilities = OwnershipHelper.ApplyLiabilityScopeFilter(await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync(), scope);
        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();

        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId)
            .ToListAsync();

        // Build list of all periods from earliest snapshot through current period
        var distinctPeriods = allSnapshots.Select(s => s.Period).Distinct().ToList();
        if (distinctPeriods.Count == 0) return Results.Ok(new List<TrendPointDto>());

        var earliestPeriod = distinctPeriods.Order().First();
        var periodList = new List<string>();
        var p = earliestPeriod;
        while (string.Compare(p, currentPeriod, StringComparison.Ordinal) <= 0)
        {
            periodList.Add(p);
            p = PeriodHelper.NextPeriod(p);
        }

        var latestByEntity = new Dictionary<Guid, Snapshot>();
        var trend = new List<TrendPointDto>();
        foreach (var period in periodList)
        {
            var periodSnapshots = allSnapshots.Where(s => s.Period == period).ToList();
            foreach (var s in periodSnapshots)
                latestByEntity[s.EntityId] = s;

            var effective = latestByEntity.Values.ToList();
            var assetTotal = CalculateAssetValues(effective, assets, members, view).Sum(v => v.Value);
            var financialAssetTotal = CalculateAssetValues(effective, financialAssets, members, view).Sum(v => v.Value);
            var liabilityTotal = CalculateLiabilityValues(effective, liabilities, members, view).Sum(v => v.Value);
            trend.Add(new TrendPointDto(period, assetTotal, financialAssetTotal, liabilityTotal, assetTotal - liabilityTotal));
        }

        return Results.Ok(trend);
    }

    private static async Task<IResult> GetGoalProjection(HttpContext context, ClearfolioDbContext db, double target, string view = "household", string scope = "all")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);

        var assets = OwnershipHelper.ApplyAssetScopeFilter(await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync(), scope);
        var liabilities = OwnershipHelper.ApplyLiabilityScopeFilter(await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync(), scope);
        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();

        // Get all distinct periods that have snapshot data
        var allPeriods = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId)
            .Select(s => s.Period)
            .Distinct()
            .ToListAsync();

        if (allPeriods.Count < 2)
            return Results.Ok(new GoalProjectionDto(target, 0, 0, null, 0, allPeriods.Count, 0));

        // Calculate net worth for each period
        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId)
            .ToListAsync();

        var dataPoints = new List<(int Index, double NetWorth)>();
        var sortedPeriods = allPeriods.OrderBy(p => p).ToList();

        for (var i = 0; i < sortedPeriods.Count; i++)
        {
            var periodSnapshots = allSnapshots.Where(s => s.Period == sortedPeriods[i]).ToList();
            var assetTotal = CalculateAssetValues(periodSnapshots, assets, members, view).Sum(v => v.Value);
            var liabilityTotal = CalculateLiabilityValues(periodSnapshots, liabilities, members, view).Sum(v => v.Value);
            var netWorth = assetTotal - liabilityTotal;
            if (assetTotal > 0 || liabilityTotal > 0) // Skip empty periods
                dataPoints.Add((i, netWorth));
        }

        if (dataPoints.Count < 2)
            return Results.Ok(new GoalProjectionDto(target, 0, 0, null, 0, dataPoints.Count, 0));

        var currentNetWorth = dataPoints[^1].NetWorth;
        var progress = target > 0 ? Math.Min((currentNetWorth / target) * 100, 100) : 0;

        // Linear regression: y = slope * x + intercept
        var n = dataPoints.Count;
        var sumX = dataPoints.Sum(d => (double)d.Index);
        var sumY = dataPoints.Sum(d => d.NetWorth);
        var sumXY = dataPoints.Sum(d => d.Index * d.NetWorth);
        var sumX2 = dataPoints.Sum(d => (double)d.Index * d.Index);

        var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        var intercept = (sumY - slope * sumX) / n;

        // R-squared
        var meanY = sumY / n;
        var ssRes = dataPoints.Sum(d => Math.Pow(d.NetWorth - (slope * d.Index + intercept), 2));
        var ssTot = dataPoints.Sum(d => Math.Pow(d.NetWorth - meanY, 2));
        var rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

        // Project when target is reached
        string? projectedPeriod = null;
        if (slope > 0 && currentNetWorth < target)
        {
            var lastIndex = dataPoints[^1].Index;
            var targetX = (target - intercept) / slope;
            var periodsAhead = targetX - lastIndex;

            if (periodsAhead is > 0 and < 200) // Cap at 50 years of quarters
            {
                // Determine period interval from data
                var currentPeriod = sortedPeriods[^1];

                // Walk forward period by period
                var projected = currentPeriod;
                for (var i = 0; i < (int)Math.Ceiling(periodsAhead); i++)
                {
                    projected = PeriodHelper.NextPeriod(projected);
                }
                projectedPeriod = projected;
            }
        }

        return Results.Ok(new GoalProjectionDto(
            target, currentNetWorth, Math.Round(progress, 1),
            projectedPeriod, Math.Round(slope, 2),
            dataPoints.Count, Math.Round(rSquared, 3)));
    }

    private static async Task<IResult> GetComposition(HttpContext context, ClearfolioDbContext db, string? period = null, string scope = "all")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var snapshots = await GetEffectiveSnapshots(db, member.HouseholdId, period);
        var assets = OwnershipHelper.ApplyAssetScopeFilter(await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync(), scope);

        var composition = new List<CompositionPointDto>();
        foreach (var snapshot in snapshots.Where(s => s.EntityType == "asset"))
        {
            var asset = assets.FirstOrDefault(a => a.Id == snapshot.EntityId);
            if (asset is null) continue;
            composition.Add(new CompositionPointDto(period, asset.AssetType.Category, snapshot.Value));
        }

        var grouped = composition
            .GroupBy(c => new { c.Period, c.Category })
            .Select(g => new CompositionPointDto(g.Key.Period, g.Key.Category, g.Sum(x => x.Value)))
            .ToList();

        return Results.Ok(grouped);
    }

    private static async Task<IResult> GetMembers(HttpContext context, ClearfolioDbContext db, string? period = null, string scope = "all")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();
        var snapshots = await GetEffectiveSnapshots(db, member.HouseholdId, period);
        var assets = OwnershipHelper.ApplyAssetScopeFilter(await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync(), scope);
        var liabilities = OwnershipHelper.ApplyLiabilityScopeFilter(await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync(), scope);

        var result = new List<MemberComparisonDto>();
        foreach (var m in members)
        {
            var assetTotal = CalculateAssetValues(snapshots, assets, members, m.MemberTag).Sum(v => v.Value);
            var liabilityTotal = CalculateLiabilityValues(snapshots, liabilities, members, m.MemberTag).Sum(v => v.Value);
            result.Add(new MemberComparisonDto(m.MemberTag, m.DisplayName, assetTotal, liabilityTotal, assetTotal - liabilityTotal));
        }

        return Results.Ok(result);
    }

    private static async Task<IResult> GetSuperGap(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        var period = PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();
        var snapshots = await GetEffectiveSnapshots(db, member.HouseholdId, period);
        var superAssets = await db.Assets.AsNoTracking().Include(a => a.AssetType)
            .Where(a => a.HouseholdId == member.HouseholdId && a.IsActive && a.AssetType.IsSuper)
            .ToListAsync();

        var result = new List<SuperGapDto>();
        foreach (var m in members)
        {
            var superTotal = CalculateAssetValues(snapshots, superAssets, members, m.MemberTag).Sum(v => v.Value);
            result.Add(new SuperGapDto(m.MemberTag, m.DisplayName, superTotal));
        }

        return Results.Ok(result);
    }

    private static async Task<IResult> GetAssetPerformance(HttpContext context, ClearfolioDbContext db, string view = "household")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        var currentPeriod = PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var assets = await db.Assets.AsNoTracking().Include(a => a.AssetType)
            .Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();
        var members = await db.HouseholdMembers.AsNoTracking()
            .Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();
        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId && s.EntityType == "asset")
            .ToListAsync();

        if (allSnapshots.Count == 0) return Results.Ok(new List<AssetPerformanceDto>());

        // Build period list from earliest to current
        var distinctPeriods = allSnapshots.Select(s => s.Period).Distinct().Order().ToList();
        var earliestPeriod = distinctPeriods[0];
        var periodList = new List<string>();
        var p = earliestPeriod;
        while (string.Compare(p, currentPeriod, StringComparison.Ordinal) <= 0)
        {
            periodList.Add(p);
            p = PeriodHelper.NextPeriod(p);
        }

        // #13: Use compiled regex for period year extraction
        var yearRegex = YearPattern();

        // Group periods by year — take last quarter per year
        var yearEndPeriods = new Dictionary<string, string>(); // "CY 2024" → "CY2024-Q4"
        foreach (var period in periodList)
        {
            var match = yearRegex.Match(period);
            if (!match.Success) continue;
            var yearKey = $"{match.Groups[1].Value} {match.Groups[2].Value}";
            yearEndPeriods[yearKey] = period; // last one wins
        }
        var years = yearEndPeriods.Keys.ToList();

        // For each asset, carry-forward through periods and capture year-end values
        var result = new List<AssetPerformanceDto>();
        foreach (var asset in assets.OrderBy(a => a.AssetType.SortOrder).ThenBy(a => a.Label))
        {
            var assetSnapshots = allSnapshots.Where(s => s.EntityId == asset.Id).ToDictionary(s => s.Period);
            if (assetSnapshots.Count == 0) continue;

            double? latestValue = null;
            var yearValues = new List<YearValueDto>();

            foreach (var period in periodList)
            {
                if (assetSnapshots.TryGetValue(period, out var snap))
                {
                    latestValue = OwnershipHelper.ApplyViewFilter(snap.Value, asset.OwnershipType, asset.OwnerMemberId, asset.JointSplit, members, view);
                }

                // If this period is a year-end period, record the value
                var yearMatch = yearRegex.Match(period);
                if (yearMatch.Success)
                {
                    var yearKey = $"{yearMatch.Groups[1].Value} {yearMatch.Groups[2].Value}";
                    if (yearEndPeriods.TryGetValue(yearKey, out var yearEnd) && yearEnd == period && latestValue.HasValue)
                    {
                        yearValues.Add(new YearValueDto(yearKey, latestValue.Value));
                    }
                }
            }

            if (yearValues.Count > 0)
            {
                var ownerName = asset.OwnerMemberId.HasValue
                    ? members.FirstOrDefault(m => m.Id == asset.OwnerMemberId)?.DisplayName
                    : "Joint";
                result.Add(new AssetPerformanceDto(asset.Id, asset.Label, asset.AssetType.Category, ownerName, yearValues));
            }
        }

        return Results.Ok(result);
    }

    /// <summary>
    /// Returns the effective snapshots for a period, carrying forward the latest value
    /// per entity from prior periods when no snapshot exists for the requested period.
    /// </summary>
    private static async Task<List<Snapshot>> GetEffectiveSnapshots(ClearfolioDbContext db, Guid householdId, string period)
    {
        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == householdId &&
                        string.Compare(s.Period, period) <= 0)
            .ToListAsync();

        var latestByEntity = new Dictionary<Guid, Snapshot>();
        foreach (var s in allSnapshots.OrderBy(s => s.Period))
            latestByEntity[s.EntityId] = s;

        return latestByEntity.Values.ToList();
    }

    private record AssetValue(double Value, string Category, string Liquidity, string GrowthClass);
    private record LiabilityValue(double Value, string Category, string DebtQuality);

    private static List<AssetValue> CalculateAssetValues(List<Snapshot> snapshots, List<Asset> assets, List<HouseholdMember> members, string view)
    {
        var result = new List<AssetValue>();
        foreach (var snapshot in snapshots.Where(s => s.EntityType == "asset"))
        {
            var asset = assets.FirstOrDefault(a => a.Id == snapshot.EntityId);
            if (asset is null) continue;

            var value = OwnershipHelper.ApplyViewFilter(snapshot.Value, asset.OwnershipType, asset.OwnerMemberId, asset.JointSplit, members, view);
            if (value > 0)
                result.Add(new AssetValue(value, asset.AssetType.Category, asset.AssetType.Liquidity, asset.AssetType.GrowthClass));
        }
        return result;
    }

    private static List<LiabilityValue> CalculateLiabilityValues(List<Snapshot> snapshots, List<Liability> liabilities, List<HouseholdMember> members, string view)
    {
        var result = new List<LiabilityValue>();
        foreach (var snapshot in snapshots.Where(s => s.EntityType == "liability"))
        {
            var liability = liabilities.FirstOrDefault(l => l.Id == snapshot.EntityId);
            if (liability is null) continue;

            var value = OwnershipHelper.ApplyViewFilter(snapshot.Value, liability.OwnershipType, liability.OwnerMemberId, liability.JointSplit, members, view);
            if (value > 0)
                result.Add(new LiabilityValue(value, liability.LiabilityType.Category, liability.LiabilityType.DebtQuality));
        }
        return result;
    }
}
