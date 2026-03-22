using Clearfolio.Api.Models;

namespace Clearfolio.Api.Helpers;

public static class OwnershipHelper
{
    private static readonly HashSet<string> FinancialAssetCategories = ["cash", "investable", "retirement"];
    private static readonly HashSet<string> LiquidAssetCategories = ["cash", "investable"];
    private static readonly HashSet<string> FinancialLiabilityCategories = ["personal", "credit", "student", "tax", "other"];

    public static List<Asset> ApplyAssetScopeFilter(List<Asset> assets, string scope) => scope switch
    {
        "financial" => assets.Where(a => FinancialAssetCategories.Contains(a.AssetType.Category)).ToList(),
        "liquid" => assets.Where(a => LiquidAssetCategories.Contains(a.AssetType.Category)).ToList(),
        _ => assets,
    };

    public static List<Liability> ApplyLiabilityScopeFilter(List<Liability> liabilities, string scope) => scope switch
    {
        "financial" or "liquid" => liabilities.Where(l => FinancialLiabilityCategories.Contains(l.LiabilityType.Category)).ToList(),
        _ => liabilities,
    };

    public static double ApplyViewFilter(
        double value, string ownershipType, Guid? ownerMemberId, double jointSplit,
        List<HouseholdMember> members, string view)
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
}
