using System.Text.Json;
using Clearfolio.Api.DTOs;

namespace Clearfolio.Api.Endpoints;

public static class QuoteEndpoints
{
    public static WebApplication MapQuoteEndpoints(this WebApplication app)
    {
        app.MapGet("/api/quote/{symbol}", GetQuote);
        return app;
    }

    private static async Task<IResult> GetQuote(string symbol, IHttpClientFactory httpFactory)
    {
        var ticker = symbol.Trim().ToUpperInvariant();
        // Append .AX for ASX stocks if no exchange suffix present
        var yahooSymbol = ticker.Contains('.') ? ticker : $"{ticker}.AX";

        try
        {
            var client = httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("User-Agent", "Clearfolio/1.0");

            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{yahooSymbol}?interval=1d&range=1d";
            var response = await client.GetAsync(url);

            if (!response.IsSuccessStatusCode)
                return Results.NotFound(new QuoteDto(ticker, null, null, null, null, null, null));

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var result = json.GetProperty("chart").GetProperty("result")[0];
            var meta = result.GetProperty("meta");

            var price = meta.GetProperty("regularMarketPrice").GetDouble();
            var previousClose = meta.GetProperty("chartPreviousClose").GetDouble();
            var change = price - previousClose;
            var changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
            var currency = meta.GetProperty("currency").GetString();
            var exchange = meta.GetProperty("exchangeName").GetString();
            var shortName = meta.TryGetProperty("shortName", out var sn) ? sn.GetString() : null;
            var longName = meta.TryGetProperty("longName", out var ln) ? ln.GetString() : shortName;

            return Results.Ok(new QuoteDto(
                ticker,
                longName,
                Math.Round(price, 2),
                Math.Round(change, 2),
                Math.Round(changePercent, 2),
                currency,
                exchange));
        }
        catch
        {
            return Results.NotFound(new QuoteDto(ticker, null, null, null, null, null, null));
        }
    }
}
