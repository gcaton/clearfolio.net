namespace Clearfolio.Api.Helpers;

public static class FrequencyHelper
{
    public static readonly Dictionary<string, int> Multipliers = new(StringComparer.OrdinalIgnoreCase)
    {
        ["weekly"] = 52,
        ["fortnightly"] = 26,
        ["monthly"] = 12,
        ["quarterly"] = 4,
        ["yearly"] = 1,
    };

    public static double Annualise(double amount, string? frequency) =>
        frequency is not null && Multipliers.TryGetValue(frequency, out var mult) ? amount * mult : 0;

    public static double NormaliseContribution(double? amount, string? frequency)
    {
        if (amount is null or <= 0 || frequency is null)
            return 0;
        return Multipliers.TryGetValue(frequency, out var mult)
            ? amount.Value * mult
            : 0;
    }
}
