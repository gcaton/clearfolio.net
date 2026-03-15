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
    string UpdatedAt);

public record CreateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes);

public record UpdateAssetRequest(
    Guid AssetTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes);
