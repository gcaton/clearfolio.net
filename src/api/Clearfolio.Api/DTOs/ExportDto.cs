namespace Clearfolio.Api.DTOs;

public record ExportDto(
    string Version,
    string ExportedAt,
    ExportHouseholdDto Household,
    List<ExportMemberDto> Members,
    List<ExportAssetDto> Assets,
    List<ExportLiabilityDto> Liabilities,
    List<ExportSnapshotDto> Snapshots);

public record ExportHouseholdDto(
    string Name,
    string BaseCurrency,
    string PreferredPeriodType);

public record ExportMemberDto(
    string Email,
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
    bool IsActive);

public record ExportLiabilityDto(
    Guid LiabilityTypeId,
    string? OwnerMemberTag,
    string OwnershipType,
    double JointSplit,
    string Label,
    string Currency,
    string? Notes,
    bool IsActive);

public record ExportSnapshotDto(
    string EntityLabel,
    string EntityType,
    string Period,
    double Value,
    string Currency,
    string? Notes,
    string RecordedByMemberTag,
    string RecordedAt);
