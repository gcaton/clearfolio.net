namespace Clearfolio.Api.Models;

public class ExpenseCategory
{
    public Guid Id { get; set; }
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public Household Household { get; set; } = null!;
}
