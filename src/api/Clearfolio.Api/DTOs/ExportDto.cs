namespace Clearfolio.Api.DTOs;

public record ExportDto(
    string Version,
    string ExportedAt,
    ExportHouseholdDto Household,
    List<ExportMemberDto> Members,
    List<ExportAssetDto> Assets,
    List<ExportLiabilityDto> Liabilities,
    List<ExportSnapshotDto> Snapshots,
    List<ExportExpenseCategoryDto>? ExpenseCategories,
    List<ExportIncomeStreamDto>? IncomeStreams,
    List<ExportExpenseDto>? Expenses);

public record ExportHouseholdDto(
    string Name,
    string BaseCurrency,
    string PreferredPeriodType);

public record ExportMemberDto(
    string? Email,
    string DisplayName,
    string MemberTag,
    bool IsPrimary);

public record ExportAssetDto(
    Guid AssetTypeId,
    string? OwnerMemberTag,
    string OwnershipType,
    double JointSplit,
    string Label,
    string? Symbol,
    string Currency,
    string? Notes,
    bool IsActive,
    double? ContributionAmount,
    string? ContributionFrequency,
    string? ContributionEndDate,
    bool IsPreTaxContribution,
    double? ExpectedReturnRate,
    double? ExpectedVolatility);

public record ExportLiabilityDto(
    Guid LiabilityTypeId,
    string? OwnerMemberTag,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    bool IsActive,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    string? RepaymentEndDate,
    double? InterestRate);

public record ExportSnapshotDto(
    string EntityLabel,
    string EntityType,
    string Period,
    double Value,
    string Currency,
    string? Notes,
    string RecordedByMemberTag,
    string RecordedAt);
