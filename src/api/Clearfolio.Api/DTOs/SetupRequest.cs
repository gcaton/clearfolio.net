using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

public record SetupRequest(
    [Required, StringLength(100)] string DisplayName,
    [StringLength(100)] string? HouseholdName,
    [StringLength(10)] string? Currency,
    [StringLength(2)] string? PeriodType,
    [StringLength(10)] string? Locale);
