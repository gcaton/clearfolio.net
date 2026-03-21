using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Clearfolio.Api.Services;

public class HistoricalReturnsService(IHttpClientFactory httpClientFactory, IMemoryCache cache)
{
    public record HistoricalReturn(double AnnualisedReturn, double Volatility, int DataPoints, double PeriodYears);

    public async Task<HistoricalReturn?> GetHistoricalReturn(string symbol)
    {
        var cacheKey = $"historical-return:{symbol}";
        if (cache.TryGetValue(cacheKey, out HistoricalReturn? cached))
            return cached;

        try
        {
            var client = httpClientFactory.CreateClient();
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var fiveYearsAgo = DateTimeOffset.UtcNow.AddYears(-5).ToUnixTimeSeconds();

            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{Uri.EscapeDataString(symbol)}?period1={fiveYearsAgo}&period2={now}&interval=1wk";
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var prices = doc.RootElement
                .GetProperty("chart").GetProperty("result")[0]
                .GetProperty("indicators").GetProperty("adjclose")[0]
                .GetProperty("adjclose");

            var values = new List<double>();
            foreach (var p in prices.EnumerateArray())
            {
                if (p.TryGetDouble(out var v) && v > 0)
                    values.Add(v);
            }

            if (values.Count < 52) return null;

            var weeklyReturns = new List<double>();
            for (var i = 1; i < values.Count; i++)
                weeklyReturns.Add(values[i] / values[i - 1] - 1);

            var meanWeekly = weeklyReturns.Average();
            var variance = weeklyReturns.Sum(r => (r - meanWeekly) * (r - meanWeekly)) / (weeklyReturns.Count - 1);
            var stdDevWeekly = Math.Sqrt(variance);

            var annualisedReturn = Math.Pow(1 + meanWeekly, 52) - 1;
            var annualisedVolatility = stdDevWeekly * Math.Sqrt(52);

            var periodYears = values.Count / 52.0;
            var result = new HistoricalReturn(
                Math.Round(annualisedReturn, 4),
                Math.Round(annualisedVolatility, 4),
                values.Count,
                Math.Round(periodYears, 1));

            cache.Set(cacheKey, result, TimeSpan.FromHours(24));
            return result;
        }
        catch
        {
            return null;
        }
    }
}
