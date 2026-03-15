namespace Clearfolio.Api.DTOs;

public record AssetTypeDto(
    Guid Id,
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
    bool IsSuper,
    bool IsCgtExempt,
    int SortOrder,
    bool IsSystem);
