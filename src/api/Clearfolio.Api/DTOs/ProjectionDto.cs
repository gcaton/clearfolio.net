using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

public record ProjectionRequest(
    [Range(1, 50)] int Horizon,
    [Required, StringLength(20)] string View,
    [Required, StringLength(20)] string Scope,
    List<Guid>? EntityIds,
    [Range(100, 10000)] int? Simulations,
    [Range(0, 0.5)] double? InflationRate);

public record ProjectionDefaultDto(
    Guid EntityId,
    string EntityType,
    string Label,
    double? EffectiveReturnRate,
    double? EffectiveVolatility,
    double? EffectiveInterestRate,
    string RateSource,
    double? ContributionAmount,
    string? ContributionFrequency,
    double AnnualContribution,
    double? RepaymentAmount,
    string? RepaymentFrequency,
    double AnnualRepayment,
    double? CurrentValue,
    bool HasCurrentValue);

public record HistoricalReturnDto(
    string Symbol,
    double AnnualisedReturn,
    double ArithmeticReturn,
    double Volatility,
    int DataPoints,
    double PeriodYears);
