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
    bool IsSystem,
    double DefaultReturnRate,
    double DefaultVolatility);

public record CreateAssetTypeRequest(
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
    bool IsSuper,
    bool IsCgtExempt,
    double DefaultReturnRate,
    double DefaultVolatility);

public record UpdateAssetTypeRequest(
    string Name,
    string Category,
    string Liquidity,
    string GrowthClass,
    bool IsSuper,
    bool IsCgtExempt,
    int SortOrder,
    double DefaultReturnRate,
    double DefaultVolatility);
