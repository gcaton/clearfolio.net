namespace Clearfolio.Api.DTOs;

public record HouseholdDto(
    Guid Id,
    string Name,
    string BaseCurrency,
    string PreferredPeriodType,
    string CreatedAt);

public record UpdateHouseholdRequest(
    string Name,
    string BaseCurrency,
    string PreferredPeriodType);
