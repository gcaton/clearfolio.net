using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

public record LiabilityDto(
    Guid Id,
    Guid LiabilityTypeId,
    string LiabilityTypeName,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    bool IsActive,
    string CreatedAt,
    string UpdatedAt,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);

public record CreateLiabilityRequest(
    [Required] Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    [Required, StringLength(20)] string OwnershipType,
    [Range(0, 1)] double JointSplit,
    [Required, StringLength(200)] string Label,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes,
    [Range(0, 1_000_000_000)] double? RepaymentAmount,
    [StringLength(20)] string? RepaymentFrequency,
    [StringLength(10)] string? RepaymentEndDate,
    [Range(0, 1)] double? InterestRate);

public record UpdateLiabilityRequest(
    [Required] Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    [Required, StringLength(20)] string OwnershipType,
    [Range(0, 1)] double JointSplit,
    [Required, StringLength(200)] string Label,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes,
    [Range(0, 1_000_000_000)] double? RepaymentAmount,
    [StringLength(20)] string? RepaymentFrequency,
    [StringLength(10)] string? RepaymentEndDate,
    [Range(0, 1)] double? InterestRate);
