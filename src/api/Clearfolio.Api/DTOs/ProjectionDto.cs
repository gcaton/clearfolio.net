namespace Clearfolio.Api.DTOs;

public record ProjectionRequest(
    int Horizon,
    string View,
    string Scope,
    List<Guid>? EntityIds,
    int? Simulations);

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
    double Volatility,
    int DataPoints,
    double PeriodYears);
