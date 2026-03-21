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
    Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);

public record UpdateLiabilityRequest(
    Guid LiabilityTypeId,
    Guid? OwnerMemberId,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);
