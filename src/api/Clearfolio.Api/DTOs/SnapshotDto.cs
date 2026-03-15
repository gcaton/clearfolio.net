namespace Clearfolio.Api.DTOs;

public record SnapshotDto(
    Guid Id,
    Guid EntityId,
    string EntityType,
    string Period,
    double Value,
    string Currency,
    string? Notes,
    Guid RecordedBy,
    string RecordedByName,
    string RecordedAt);

public record CreateSnapshotRequest(
    Guid EntityId,
    string EntityType,
    string Period,
    double Value,
    string Currency,
    string? Notes);

public record UpdateSnapshotRequest(
    double Value,
    string Currency,
    string? Notes);

public record LatestSnapshotDto(
    Guid EntityId,
    string EntityType,
    string Period,
    double Value,
    string Currency);
