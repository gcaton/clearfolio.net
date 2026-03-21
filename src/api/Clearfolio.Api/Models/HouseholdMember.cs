namespace Clearfolio.Api.Models;

public class HouseholdMember
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string? Email { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string MemberTag { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public Household Household { get; set; } = null!;
}
