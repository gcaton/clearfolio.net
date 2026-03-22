namespace Clearfolio.Api.DTOs;

public record LiabilityTypeDto(
    Guid Id,
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs,
    int SortOrder,
    bool IsSystem);

public record CreateLiabilityTypeRequest(
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs);

public record UpdateLiabilityTypeRequest(
    string Name,
    string Category,
    string DebtQuality,
    bool IsHecs,
    int SortOrder);
