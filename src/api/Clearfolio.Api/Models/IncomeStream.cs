namespace Clearfolio.Api.Models;

public class IncomeStream
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid OwnerMemberId { get; set; }
    public string Label { get; set; } = string.Empty;
    public string IncomeType { get; set; } = "Additional"; // "Primary" or "Additional"
    public double Amount { get; set; }
    public string Frequency { get; set; } = "monthly";
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public Household Household { get; set; } = null!;
    public HouseholdMember OwnerMember { get; set; } = null!;
}
