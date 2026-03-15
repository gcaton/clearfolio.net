using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class DashboardEndpoints
{
    public static WebApplication MapDashboardEndpoints(this WebApplication app)
    {
        app.MapGet("/api/dashboard/summary", GetSummary);
        app.MapGet("/api/dashboard/trend", GetTrend);
        app.MapGet("/api/dashboard/composition", GetComposition);
        app.MapGet("/api/dashboard/members", GetMembers);
        app.MapGet("/api/dashboard/super-gap", GetSuperGap);
        return app;
    }

    private static async Task<IResult> GetSummary(HttpContext context, ClearfolioDbContext db, string? period = null, string view = "household")
    {
        var member = GetMember(context);
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var snapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, period);
        var assets = await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();
        var liabilities = await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync();
        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();

        var assetValues = CalculateAssetValues(snapshots, assets, members, view);
        var liabilityValues = CalculateLiabilityValues(snapshots, liabilities, members, view);

        var totalAssets = assetValues.Sum(v => v.Value);
        var totalLiabilities = liabilityValues.Sum(v => v.Value);

        var previousPeriod = PeriodHelper.PreviousPeriod(period);
        var prevSnapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, previousPeriod);
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

    private static async Task<IResult> GetTrend(HttpContext context, ClearfolioDbContext db, int periods = 8, string view = "household")
    {
        var member = GetMember(context);
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        var currentPeriod = PeriodHelper.CurrentPeriod(household.PreferredPeriodType);
        var periodList = PeriodHelper.PreviousPeriods(currentPeriod, periods);

        var assets = await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();
        var liabilities = await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync();
        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();

        var allSnapshots = await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId && periodList.Contains(s.Period))
            .ToListAsync();

        var trend = new List<TrendPointDto>();
        foreach (var p in periodList)
        {
            var periodSnapshots = allSnapshots.Where(s => s.Period == p).ToList();
            var assetTotal = CalculateAssetValues(periodSnapshots, assets, members, view).Sum(v => v.Value);
            var liabilityTotal = CalculateLiabilityValues(periodSnapshots, liabilities, members, view).Sum(v => v.Value);
            trend.Add(new TrendPointDto(p, assetTotal, liabilityTotal, assetTotal - liabilityTotal));
        }

        return Results.Ok(trend);
    }

    private static async Task<IResult> GetComposition(HttpContext context, ClearfolioDbContext db, string? period = null)
    {
        var member = GetMember(context);
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var snapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, period);
        var assets = await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();

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

    private static async Task<IResult> GetMembers(HttpContext context, ClearfolioDbContext db, string? period = null)
    {
        var member = GetMember(context);
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        period ??= PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();
        var snapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, period);
        var assets = await db.Assets.AsNoTracking().Include(a => a.AssetType).Where(a => a.HouseholdId == member.HouseholdId && a.IsActive).ToListAsync();
        var liabilities = await db.Liabilities.AsNoTracking().Include(l => l.LiabilityType).Where(l => l.HouseholdId == member.HouseholdId && l.IsActive).ToListAsync();

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
        var member = GetMember(context);
        var household = await db.Households.AsNoTracking().FirstAsync(h => h.Id == member.HouseholdId);
        var period = PeriodHelper.CurrentPeriod(household.PreferredPeriodType);

        var members = await db.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == member.HouseholdId).ToListAsync();
        var snapshots = await GetSnapshotsForPeriod(db, member.HouseholdId, period);
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

    private static async Task<List<Snapshot>> GetSnapshotsForPeriod(ClearfolioDbContext db, Guid householdId, string period)
    {
        return await db.Snapshots.AsNoTracking()
            .Where(s => s.HouseholdId == householdId && s.Period == period)
            .ToListAsync();
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

            var value = ApplyViewFilter(snapshot.Value, asset.OwnershipType, asset.OwnerMemberId, asset.JointSplit, members, view);
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

            var value = ApplyViewFilter(snapshot.Value, liability.OwnershipType, liability.OwnerMemberId, liability.JointSplit, members, view);
            if (value > 0)
                result.Add(new LiabilityValue(value, liability.LiabilityType.Category, liability.LiabilityType.DebtQuality));
        }
        return result;
    }

    private static double ApplyViewFilter(double value, string ownershipType, Guid? ownerMemberId, double jointSplit, List<HouseholdMember> members, string view)
    {
        if (view == "household")
            return value;

        var targetMember = members.FirstOrDefault(m => m.MemberTag == view);
        if (targetMember is null)
            return 0;

        if (ownershipType == "sole")
            return ownerMemberId == targetMember.Id ? value : 0;

        // Joint: p1 gets jointSplit, p2 gets remainder
        var p1 = members.FirstOrDefault(m => m.MemberTag == "p1");
        return targetMember.Id == p1?.Id ? value * jointSplit : value * (1 - jointSplit);
    }

    private static HouseholdMember GetMember(HttpContext context) =>
        (HouseholdMember)context.Items["HouseholdMember"]!;
}
