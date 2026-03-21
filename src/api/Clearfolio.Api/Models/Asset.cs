namespace Clearfolio.Api.Models;

public class Asset
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid AssetTypeId { get; set; }
    public Guid? OwnerMemberId { get; set; }
    public string OwnershipType { get; set; } = "sole";
    public double JointSplit { get; set; } = 0.5;
    public string Label { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public string Currency { get; set; } = "AUD";
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    // Projection fields
    public double? ContributionAmount { get; set; }
    public string? ContributionFrequency { get; set; }
    public string? ContributionEndDate { get; set; }
    public double? ExpectedReturnRate { get; set; }
    public double? ExpectedVolatility { get; set; }

    public Household Household { get; set; } = null!;
    public AssetType AssetType { get; set; } = null!;
    public HouseholdMember? OwnerMember { get; set; }
}
