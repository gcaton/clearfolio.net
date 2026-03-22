namespace Clearfolio.Api.Models;

public class Household
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BaseCurrency { get; set; } = "AUD";
    public string PreferredPeriodType { get; set; } = "FY";
    public string Locale { get; set; } = "en-AU";
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public List<HouseholdMember> Members { get; set; } = [];
    public List<Asset> Assets { get; set; } = [];
    public List<Liability> Liabilities { get; set; } = [];
    public List<Snapshot> Snapshots { get; set; } = [];
    public List<ExpenseCategory> ExpenseCategories { get; set; } = [];
    public List<IncomeStream> IncomeStreams { get; set; } = [];
    public List<Expense> Expenses { get; set; } = [];
}
