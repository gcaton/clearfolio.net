namespace Clearfolio.Api.DTOs;

public record QuoteDto(
    string Symbol,
    string? Name,
    double? Price,
    double? Change,
    double? ChangePercent,
    string? Currency,
    string? Exchange);
