using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

public record HouseholdDto(
    Guid Id,
    string Name,
    string BaseCurrency,
    string PreferredPeriodType,
    string Locale,
    string CreatedAt);

public record UpdateHouseholdRequest(
    [Required, StringLength(100)] string Name,
    [Required, StringLength(10)] string BaseCurrency,
    [Required, StringLength(2)] string PreferredPeriodType,
    [Required, StringLength(10)] string Locale);
