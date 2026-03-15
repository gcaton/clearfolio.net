namespace Clearfolio.Api.DTOs;

public record LiabilityTypeDto(
    Guid Id,
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs,
    int SortOrder,
    bool IsSystem);
