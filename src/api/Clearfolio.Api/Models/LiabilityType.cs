namespace Clearfolio.Api.Models;

public class LiabilityType
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string DebtQuality { get; set; } = string.Empty;
    public bool IsHecs { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; }

    public List<Liability> Liabilities { get; set; } = [];
}
