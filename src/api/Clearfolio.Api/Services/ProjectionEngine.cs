namespace Clearfolio.Api.Services;

public static class ProjectionEngine
{
    private static readonly Dictionary<string, int> FrequencyMultipliers = new()
    {
        ["weekly"] = 52,
        ["fortnightly"] = 26,
        ["monthly"] = 12,
        ["quarterly"] = 4,
        ["yearly"] = 1,
    };

    public record EntityInput(
        Guid Id,
        string Label,
        string Category,
        string EntityType,
        double CurrentValue,
        double AnnualContribution,
        double ReturnRate,
        double Volatility,
        double InterestRate,
        string? ContributionEndDate);

    public record YearlyValue(int Year, double Value);

    public record EntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<YearlyValue> Years);

    // --- Compound Growth ---

    public record CompoundYearData(int Year, double Assets, double Liabilities, double NetWorth);

    public record CompoundResult(
        int Horizon,
        List<CompoundYearData> Years,
        List<EntityProjection> Entities);

    public static CompoundResult RunCompound(List<EntityInput> entities, int horizon, double inflationRate = 0)
    {
        var startYear = DateTime.UtcNow.Year;
        var entityResults = new List<EntityProjection>();
        var yearlyTotals = new Dictionary<int, (double assets, double liabilities)>();

        for (var y = 0; y <= horizon; y++)
            yearlyTotals[startYear + y] = (0, 0);

        foreach (var entity in entities)
        {
            var years = new List<YearlyValue>();
            var value = entity.CurrentValue;

            for (var y = 0; y <= horizon; y++)
            {
                var year = startYear + y;
                years.Add(new YearlyValue(year, Math.Round(value, 2)));

                var totals = yearlyTotals[year];
                if (entity.EntityType == "asset")
                    yearlyTotals[year] = (totals.assets + value, totals.liabilities);
                else
                    yearlyTotals[year] = (totals.assets, totals.liabilities + value);

                if (y < horizon)
                {
                    var contribution = GetContribution(entity, year);
                    if (entity.EntityType == "asset")
                        value = value * (1 + entity.ReturnRate) + contribution;
                    else
                        value = Math.Max(0, value * (1 + entity.InterestRate) - contribution);
                }
            }

            entityResults.Add(new EntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, years));
        }

        var compoundYears = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var year = startYear + y;
            var (assets, liabilities) = yearlyTotals[year];
            var d = InflationDiscount(inflationRate, y);
            return new CompoundYearData(year, Math.Round(assets * d, 2), Math.Round(liabilities * d, 2), Math.Round((assets - liabilities) * d, 2));
        }).ToList();

        if (inflationRate > 0)
            entityResults = entityResults.Select(e => e with { Years = e.Years.Select((yv, i) => yv with { Value = Math.Round(yv.Value * InflationDiscount(inflationRate, i), 2) }).ToList() }).ToList();

        return new CompoundResult(horizon, compoundYears, entityResults);
    }

    // --- Scenario-Based ---

    public record ScenarioValues(double Assets, double Liabilities, double NetWorth);
    public record ScenarioYearData(int Year, ScenarioValues Pessimistic, ScenarioValues Base, ScenarioValues Optimistic);
    public record ScenarioEntityYear(int Year, double Pessimistic, double Base, double Optimistic);
    public record ScenarioEntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<ScenarioEntityYear> Years);

    public record ScenarioResult(
        int Horizon,
        List<ScenarioYearData> Years,
        List<ScenarioEntityProjection> Entities);

    public static ScenarioResult RunScenario(List<EntityInput> entities, int horizon, double inflationRate = 0)
    {
        var startYear = DateTime.UtcNow.Year;
        var entityResults = new List<ScenarioEntityProjection>();
        var yearlyTotals = new Dictionary<int, (ScenarioValues pess, ScenarioValues bas, ScenarioValues opt)>();

        for (var y = 0; y <= horizon; y++)
            yearlyTotals[startYear + y] = (new(0, 0, 0), new(0, 0, 0), new(0, 0, 0));

        foreach (var entity in entities)
        {
            var (pessRate, baseRate, optRate) = GetScenarioRates(entity);
            var years = new List<ScenarioEntityYear>();
            double pessValue = entity.CurrentValue, baseValue = entity.CurrentValue, optValue = entity.CurrentValue;

            for (var y = 0; y <= horizon; y++)
            {
                var year = startYear + y;
                years.Add(new ScenarioEntityYear(year, Math.Round(pessValue, 2), Math.Round(baseValue, 2), Math.Round(optValue, 2)));

                var t = yearlyTotals[year];
                if (entity.EntityType == "asset")
                {
                    yearlyTotals[year] = (
                        new(t.pess.Assets + pessValue, t.pess.Liabilities, 0),
                        new(t.bas.Assets + baseValue, t.bas.Liabilities, 0),
                        new(t.opt.Assets + optValue, t.opt.Liabilities, 0));
                }
                else
                {
                    yearlyTotals[year] = (
                        new(t.pess.Assets, t.pess.Liabilities + pessValue, 0),
                        new(t.bas.Assets, t.bas.Liabilities + baseValue, 0),
                        new(t.opt.Assets, t.opt.Liabilities + optValue, 0));
                }

                if (y < horizon)
                {
                    var contribution = GetContribution(entity, year);
                    if (entity.EntityType == "asset")
                    {
                        pessValue = pessValue * (1 + pessRate) + contribution;
                        baseValue = baseValue * (1 + baseRate) + contribution;
                        optValue = optValue * (1 + optRate) + contribution;
                    }
                    else
                    {
                        var rate = entity.InterestRate;
                        pessValue = Math.Max(0, pessValue * (1 + rate) - contribution);
                        baseValue = Math.Max(0, baseValue * (1 + rate) - contribution);
                        optValue = Math.Max(0, optValue * (1 + rate) - contribution);
                    }
                }
            }

            entityResults.Add(new ScenarioEntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, years));
        }

        var scenarioYears = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var year = startYear + y;
            var t = yearlyTotals[year];
            var d = InflationDiscount(inflationRate, y);
            return new ScenarioYearData(year,
                new ScenarioValues(Math.Round(t.pess.Assets * d, 2), Math.Round(t.pess.Liabilities * d, 2), Math.Round((t.pess.Assets - t.pess.Liabilities) * d, 2)),
                new ScenarioValues(Math.Round(t.bas.Assets * d, 2), Math.Round(t.bas.Liabilities * d, 2), Math.Round((t.bas.Assets - t.bas.Liabilities) * d, 2)),
                new ScenarioValues(Math.Round(t.opt.Assets * d, 2), Math.Round(t.opt.Liabilities * d, 2), Math.Round((t.opt.Assets - t.opt.Liabilities) * d, 2)));
        }).ToList();

        if (inflationRate > 0)
            entityResults = entityResults.Select(e => e with { Years = e.Years.Select((yv, i) => yv with {
                Pessimistic = Math.Round(yv.Pessimistic * InflationDiscount(inflationRate, i), 2),
                Base = Math.Round(yv.Base * InflationDiscount(inflationRate, i), 2),
                Optimistic = Math.Round(yv.Optimistic * InflationDiscount(inflationRate, i), 2),
            }).ToList() }).ToList();

        return new ScenarioResult(horizon, scenarioYears, entityResults);
    }

    private static (double pessimistic, double baseRate, double optimistic) GetScenarioRates(EntityInput entity)
    {
        var baseRate = entity.ReturnRate;
        double pessimistic, optimistic;

        if (baseRate > 0)
        {
            pessimistic = Math.Max(baseRate * 0.5, baseRate - 0.03);
            optimistic = Math.Min(baseRate * 1.5, baseRate + 0.03);
        }
        else
        {
            pessimistic = baseRate - 0.03;
            optimistic = baseRate + 0.03;
        }

        return (pessimistic, baseRate, optimistic);
    }

    // --- Monte Carlo ---

    public record MonteCarloYearData(int Year, double P10, double P25, double P50, double P75, double P90);
    public record MonteCarloEntityYear(int Year, double P10, double P25, double P50, double P75, double P90);
    public record MonteCarloEntityProjection(
        Guid Id, string Label, string Category, string EntityType,
        List<MonteCarloEntityYear> Years);

    public record MonteCarloResult(
        int Horizon,
        int Simulations,
        List<MonteCarloYearData> Years,
        List<MonteCarloEntityProjection> Entities);

    public static MonteCarloResult RunMonteCarlo(List<EntityInput> entities, int horizon, int simulations = 1000, double inflationRate = 0)
    {
        simulations = Math.Clamp(simulations, 100, 10000);
        var startYear = DateTime.UtcNow.Year;
        var random = new Random();

        var netWorthByYear = new double[horizon + 1][];
        for (var y = 0; y <= horizon; y++)
            netWorthByYear[y] = new double[simulations];

        var entityValuesByYear = entities.Select(_ =>
        {
            var arr = new double[horizon + 1][];
            for (var y = 0; y <= horizon; y++)
                arr[y] = new double[simulations];
            return arr;
        }).ToArray();

        for (var sim = 0; sim < simulations; sim++)
        {
            for (var e = 0; e < entities.Count; e++)
            {
                var entity = entities[e];
                var value = entity.CurrentValue;

                for (var y = 0; y <= horizon; y++)
                {
                    entityValuesByYear[e][y][sim] = value;
                    var sign = entity.EntityType == "asset" ? 1.0 : -1.0;
                    netWorthByYear[y][sim] += value * sign;

                    if (y < horizon)
                    {
                        var year = startYear + y;
                        var contribution = GetContribution(entity, year);

                        if (entity.EntityType == "asset")
                        {
                            var sampledReturn = SampleNormal(random, entity.ReturnRate, entity.Volatility);
                            value = value * (1 + sampledReturn) + contribution;
                            value = Math.Max(0, value);
                        }
                        else
                        {
                            value = Math.Max(0, value * (1 + entity.InterestRate) - contribution);
                        }
                    }
                }
            }
        }

        var years = Enumerable.Range(0, horizon + 1).Select(y =>
        {
            var sorted = netWorthByYear[y].OrderBy(v => v).ToArray();
            var d = InflationDiscount(inflationRate, y);
            return new MonteCarloYearData(
                startYear + y,
                Math.Round(Percentile(sorted, 0.10) * d, 2),
                Math.Round(Percentile(sorted, 0.25) * d, 2),
                Math.Round(Percentile(sorted, 0.50) * d, 2),
                Math.Round(Percentile(sorted, 0.75) * d, 2),
                Math.Round(Percentile(sorted, 0.90) * d, 2));
        }).ToList();

        var entityProjections = entities.Select((entity, e) =>
        {
            var eYears = Enumerable.Range(0, horizon + 1).Select(y =>
            {
                var sorted = entityValuesByYear[e][y].OrderBy(v => v).ToArray();
                var d = InflationDiscount(inflationRate, y);
                return new MonteCarloEntityYear(
                    startYear + y,
                    Math.Round(Percentile(sorted, 0.10) * d, 2),
                    Math.Round(Percentile(sorted, 0.25) * d, 2),
                    Math.Round(Percentile(sorted, 0.50) * d, 2),
                    Math.Round(Percentile(sorted, 0.75) * d, 2),
                    Math.Round(Percentile(sorted, 0.90) * d, 2));
            }).ToList();
            return new MonteCarloEntityProjection(entity.Id, entity.Label, entity.Category, entity.EntityType, eYears);
        }).ToList();

        return new MonteCarloResult(horizon, simulations, years, entityProjections);
    }

    // --- Helpers ---

    private static double InflationDiscount(double inflationRate, int years)
        => inflationRate > 0 ? 1.0 / Math.Pow(1 + inflationRate, years) : 1.0;

    private static double GetContribution(EntityInput entity, int year)
    {
        if (entity.ContributionEndDate is not null &&
            DateOnly.TryParse(entity.ContributionEndDate, out var endDate) &&
            year > endDate.Year)
            return 0;
        return entity.AnnualContribution;
    }

    public static double NormaliseContribution(double? amount, string? frequency)
    {
        if (amount is null || amount <= 0 || frequency is null)
            return 0;
        return FrequencyMultipliers.TryGetValue(frequency, out var mult)
            ? amount.Value * mult
            : 0;
    }

    private static double SampleNormal(Random random, double mean, double stdDev)
    {
        var u1 = 1.0 - random.NextDouble();
        var u2 = 1.0 - random.NextDouble();
        var z = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
        return mean + stdDev * z;
    }

    private static double Percentile(double[] sorted, double p)
    {
        var index = p * (sorted.Length - 1);
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);
        if (lower == upper) return sorted[lower];
        var frac = index - lower;
        return sorted[lower] * (1 - frac) + sorted[upper] * frac;
    }
}
