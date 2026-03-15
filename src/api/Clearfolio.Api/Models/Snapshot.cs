namespace Clearfolio.Api.Models;

public class Snapshot
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public Guid EntityId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string Period { get; set; } = string.Empty;
    public double Value { get; set; }
    public string Currency { get; set; } = "AUD";
    public string? Notes { get; set; }
    public Guid RecordedBy { get; set; }
    public string RecordedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public Household Household { get; set; } = null!;
    public HouseholdMember RecordedByMember { get; set; } = null!;
}
