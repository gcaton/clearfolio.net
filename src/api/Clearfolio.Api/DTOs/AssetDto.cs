using System.ComponentModel.DataAnnotations;

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
    bool IsPreTaxContribution,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record CreateAssetRequest(
    [Required] Guid AssetTypeId,
    Guid? OwnerMemberId,
    [Required, StringLength(20)] string OwnershipType,
    [Range(0, 1)] double JointSplit,
    [Required, StringLength(200)] string Label,
    [StringLength(20)] string? Symbol,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes,
    [Range(0, 1_000_000_000)] double? ContributionAmount,
    [StringLength(20)] string? ContributionFrequency,
    [StringLength(10)] string? ContributionEndDate,
    bool IsPreTaxContribution,
    [Range(-1, 1)] double? ExpectedReturnRate,
    [Range(0, 2)] double? ExpectedVolatility);

public record UpdateAssetRequest(
    [Required] Guid AssetTypeId,
    Guid? OwnerMemberId,
    [Required, StringLength(20)] string OwnershipType,
    [Range(0, 1)] double JointSplit,
    [Required, StringLength(200)] string Label,
    [StringLength(20)] string? Symbol,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes,
    [Range(0, 1_000_000_000)] double? ContributionAmount,
    [StringLength(20)] string? ContributionFrequency,
    [StringLength(10)] string? ContributionEndDate,
    bool IsPreTaxContribution,
    [Range(-1, 1)] double? ExpectedReturnRate,
    [Range(0, 2)] double? ExpectedVolatility);
