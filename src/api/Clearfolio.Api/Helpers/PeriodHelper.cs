using System.Text.RegularExpressions;

namespace Clearfolio.Api.Helpers;

public static partial class PeriodHelper
{
    [GeneratedRegex(@"^(CY|FY)(\d{4})(?:-(Q[1-4]))?$")]
    private static partial Regex PeriodPattern();

    public static DateOnly PeriodStart(string period)
    {
        var match = PeriodPattern().Match(period);
        if (!match.Success)
            throw new ArgumentException($"Invalid period format: {period}");

        var convention = match.Groups[1].Value;
        var year = int.Parse(match.Groups[2].Value);
        var quarter = match.Groups[3].Success ? match.Groups[3].Value : null;

        if (convention == "FY")
        {
            return quarter switch
            {
                "Q1" => new DateOnly(year - 1, 7, 1),
                "Q2" => new DateOnly(year - 1, 10, 1),
                "Q3" => new DateOnly(year, 1, 1),
                "Q4" => new DateOnly(year, 4, 1),
                _ => new DateOnly(year - 1, 7, 1), // Full FY starts July prior year
            };
        }

        // CY
        return quarter switch
        {
            "Q1" => new DateOnly(year, 1, 1),
            "Q2" => new DateOnly(year, 4, 1),
            "Q3" => new DateOnly(year, 7, 1),
            "Q4" => new DateOnly(year, 10, 1),
            _ => new DateOnly(year, 1, 1),
        };
    }

    public static string CurrentPeriod(string convention)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var month = today.Month;

        if (convention == "FY")
        {
            var fyYear = month >= 7 ? today.Year + 1 : today.Year;
            var quarter = month switch
            {
                >= 7 and <= 9 => "Q1",
                >= 10 and <= 12 => "Q2",
                >= 1 and <= 3 => "Q3",
                _ => "Q4",
            };
            return $"FY{fyYear}-{quarter}";
        }

        // CY
        var cyQuarter = month switch
        {
            >= 1 and <= 3 => "Q1",
            >= 4 and <= 6 => "Q2",
            >= 7 and <= 9 => "Q3",
            _ => "Q4",
        };
        return $"CY{today.Year}-{cyQuarter}";
    }

    public static string PreviousPeriod(string period)
    {
        var match = PeriodPattern().Match(period);
        if (!match.Success)
            throw new ArgumentException($"Invalid period format: {period}");

        var convention = match.Groups[1].Value;
        var year = int.Parse(match.Groups[2].Value);
        var quarter = match.Groups[3].Success ? match.Groups[3].Value : null;

        if (quarter is null)
            return $"{convention}{year - 1}";

        return quarter switch
        {
            "Q1" => $"{convention}{year - 1}-Q4",
            "Q2" => $"{convention}{year}-Q1",
            "Q3" => $"{convention}{year}-Q2",
            "Q4" => $"{convention}{year}-Q3",
            _ => throw new ArgumentException($"Invalid quarter: {quarter}"),
        };
    }

    public static string SameQuarterPriorYear(string period)
    {
        var match = PeriodPattern().Match(period);
        if (!match.Success)
            throw new ArgumentException($"Invalid period format: {period}");

        var convention = match.Groups[1].Value;
        var year = int.Parse(match.Groups[2].Value);
        var quarter = match.Groups[3].Success ? $"-{match.Groups[3].Value}" : "";

        return $"{convention}{year - 1}{quarter}";
    }

    public static List<string> PreviousPeriods(string period, int count)
    {
        var periods = new List<string>(count);
        var current = period;
        for (var i = 0; i < count; i++)
        {
            periods.Add(current);
            current = PreviousPeriod(current);
        }
        periods.Reverse();
        return periods;
    }
}
