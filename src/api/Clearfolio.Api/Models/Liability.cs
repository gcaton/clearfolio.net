namespace Clearfolio.Api.Models;

public class Liability
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid LiabilityTypeId { get; set; }
    public Guid? OwnerMemberId { get; set; }
    public string OwnershipType { get; set; } = "sole";
    public double JointSplit { get; set; } = 0.5;
    public string Label { get; set; } = string.Empty;
    public string Currency { get; set; } = "AUD";
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    // Projection fields
    public double? RepaymentAmount { get; set; }
    public string? RepaymentFrequency { get; set; }
    public string? RepaymentEndDate { get; set; }
    public double? InterestRate { get; set; }

    public Household Household { get; set; } = null!;
    public LiabilityType LiabilityType { get; set; } = null!;
    public HouseholdMember? OwnerMember { get; set; }
}
