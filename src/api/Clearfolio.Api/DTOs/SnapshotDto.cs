using System.ComponentModel.DataAnnotations;

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
    [Required] Guid EntityId,
    [Required, StringLength(20)] string EntityType,
    [Required, StringLength(20)] string Period,
    [Range(-1_000_000_000, 1_000_000_000)] double Value,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes);

public record UpdateSnapshotRequest(
    [Range(-1_000_000_000, 1_000_000_000)] double Value,
    [Required, StringLength(10)] string Currency,
    [StringLength(500)] string? Notes);

public record LatestSnapshotDto(
    Guid EntityId,
    string EntityType,
    string Period,
    double Value,
    string Currency);
