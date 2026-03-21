namespace Clearfolio.Api.DTOs;

public record SetupRequest(
    string DisplayName,
    string? HouseholdName,
    string? Currency,
    string? PeriodType);
