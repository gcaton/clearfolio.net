namespace Clearfolio.Api.DTOs;

public record DashboardSummaryDto(
    string Period,
    string View,
    double TotalAssets,
    double TotalLiabilities,
    double NetWorth,
    List<CategoryBreakdownDto> AssetsByCategory,
    List<CategoryBreakdownDto> LiabilitiesByCategory,
    List<LiquidityBreakdownDto> LiquidityBreakdown,
    List<GrowthBreakdownDto> GrowthBreakdown,
    List<DebtQualityBreakdownDto> DebtQualityBreakdown);

public record CategoryBreakdownDto(string Category, double Value);
public record LiquidityBreakdownDto(string Liquidity, double Value);
public record GrowthBreakdownDto(string GrowthClass, double Value);
public record DebtQualityBreakdownDto(string DebtQuality, double Value);

public record TrendPointDto(string Period, double Assets, double Liabilities, double NetWorth);

public record CompositionPointDto(string Period, string Category, double Value);

public record MemberComparisonDto(string MemberTag, string DisplayName, double Assets, double Liabilities, double NetWorth);

public record SuperGapDto(string MemberTag, string DisplayName, double SuperBalance);
