namespace Clearfolio.Api.Models;

public class AssetType
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Liquidity { get; set; } = string.Empty;
    public string GrowthClass { get; set; } = string.Empty;
    public bool IsSuper { get; set; }
    public bool IsCgtExempt { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; }

    public List<Asset> Assets { get; set; } = [];
}
