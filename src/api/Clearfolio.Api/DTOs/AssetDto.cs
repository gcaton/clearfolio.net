namespace Clearfolio.Api.DTOs;

public record AssetDto(
    Guid Id,
    Guid AssetTypeId,
    string AssetTypeName,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    bool IsActive,
    string CreatedAt,
    string UpdatedAt,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record CreateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record UpdateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);
