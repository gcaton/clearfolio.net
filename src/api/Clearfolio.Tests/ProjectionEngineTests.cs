using Clearfolio.Api.Helpers;
using Clearfolio.Api.Services;
using static Clearfolio.Api.Services.ProjectionEngine;

namespace Clearfolio.Tests;

[TestClass]
public class ProjectionEngineTests
{
    private static EntityInput MakeAsset(
        double currentValue = 100_000,
        double annualContribution = 0,
        double returnRate = 0.07,
        double volatility = 0.15,
        double interestRate = 0,
        string? contributionEndDate = null) => new(
        Guid.NewGuid(), "Test Asset", "Investment", "asset",
        currentValue, annualContribution, returnRate, volatility,
        interestRate, contributionEndDate);

    private static EntityInput MakeLiability(
        double currentValue = 50_000,
        double annualContribution = 10_000,
        double interestRate = 0.05) => new(
        Guid.NewGuid(), "Test Loan", "Mortgage", "liability",
        currentValue, annualContribution, 0, 0,
        interestRate, null);

    // --- NormaliseContribution ---

    [TestMethod]
    [DataRow("weekly", 52)]
    [DataRow("fortnightly", 26)]
    [DataRow("monthly", 12)]
    [DataRow("quarterly", 4)]
    [DataRow("yearly", 1)]
    public void NormaliseContribution_CorrectMultiplier(string frequency, int expectedMultiplier)
    {
        var result = FrequencyHelper.NormaliseContribution(100, frequency);
        Assert.AreEqual(100.0 * expectedMultiplier, result);
    }

    [TestMethod]
    public void NormaliseContribution_NullAmount_ReturnsZero()
    {
        Assert.AreEqual(0, FrequencyHelper.NormaliseContribution(null, "monthly"));
    }

    [TestMethod]
    public void NormaliseContribution_ZeroAmount_ReturnsZero()
    {
        Assert.AreEqual(0, FrequencyHelper.NormaliseContribution(0, "monthly"));
    }

    [TestMethod]
    public void NormaliseContribution_NegativeAmount_ReturnsZero()
    {
        Assert.AreEqual(0, FrequencyHelper.NormaliseContribution(-100, "monthly"));
    }

    [TestMethod]
    public void NormaliseContribution_NullFrequency_ReturnsZero()
    {
        Assert.AreEqual(0, FrequencyHelper.NormaliseContribution(100, null));
    }

    [TestMethod]
    public void NormaliseContribution_UnknownFrequency_ReturnsZero()
    {
        Assert.AreEqual(0, FrequencyHelper.NormaliseContribution(100, "biannually"));
    }

    // --- RunCompound ---

    [TestMethod]
    public void RunCompound_SingleAsset_NoContribution_GrowsAtReturnRate()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.10);
        var result = ProjectionEngine.RunCompound([asset], horizon: 3);

        Assert.AreEqual(4, result.Years.Count); // Year 0 + 3 years
        Assert.AreEqual(100_000, result.Years[0].Assets);
        Assert.AreEqual(110_000, result.Years[1].Assets);          // 100k * 1.10
        Assert.AreEqual(121_000, result.Years[2].Assets);          // 110k * 1.10
        Assert.AreEqual(133_100, result.Years[3].Assets);          // 121k * 1.10
    }

    [TestMethod]
    public void RunCompound_SingleAsset_WithContribution()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.10, annualContribution: 10_000);
        var result = ProjectionEngine.RunCompound([asset], horizon: 1);

        // Year 0: 100,000
        // Year 1: 100,000 * 1.10 + 10,000 = 120,000
        Assert.AreEqual(100_000, result.Years[0].Assets);
        Assert.AreEqual(120_000, result.Years[1].Assets);
    }

    [TestMethod]
    public void RunCompound_Liability_DecreasesWithPayments()
    {
        var liability = MakeLiability(currentValue: 50_000, annualContribution: 10_000, interestRate: 0.05);
        var result = ProjectionEngine.RunCompound([liability], horizon: 1);

        // Year 0: 50,000
        // Year 1: max(0, 50,000 * 1.05 - 10,000) = 42,500
        Assert.AreEqual(50_000, result.Years[0].Liabilities);
        Assert.AreEqual(42_500, result.Years[1].Liabilities);
    }

    [TestMethod]
    public void RunCompound_Liability_FlooredAtZero()
    {
        var liability = MakeLiability(currentValue: 5_000, annualContribution: 10_000, interestRate: 0.0);
        var result = ProjectionEngine.RunCompound([liability], horizon: 1);

        // max(0, 5,000 * 1.0 - 10,000) = 0
        Assert.AreEqual(0, result.Years[1].Liabilities);
    }

    [TestMethod]
    public void RunCompound_NetWorth_IsAssetMinusLiability()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0);
        var liability = MakeLiability(currentValue: 40_000, annualContribution: 0, interestRate: 0);
        var result = ProjectionEngine.RunCompound([asset, liability], horizon: 1);

        Assert.AreEqual(60_000, result.Years[0].NetWorth);
    }

    [TestMethod]
    public void RunCompound_WithInflation_DiscountsValues()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0);
        var result = ProjectionEngine.RunCompound([asset], horizon: 1, inflationRate: 0.03);

        // Year 0: no discount
        Assert.AreEqual(100_000, result.Years[0].Assets);
        // Year 1: 100,000 / 1.03 ≈ 97,087.38
        Assert.AreEqual(97_087.38, result.Years[1].Assets);
    }

    [TestMethod]
    public void RunCompound_ContributionEndDate_StopsContributions()
    {
        var startYear = DateTime.UtcNow.Year;
        var asset = MakeAsset(
            currentValue: 100_000,
            returnRate: 0,
            annualContribution: 10_000,
            contributionEndDate: $"{startYear}-12-31");
        var result = ProjectionEngine.RunCompound([asset], horizon: 2);

        // Year 0 → 1: contribution applies (year == endDate.Year), value = 110,000
        Assert.AreEqual(110_000, result.Years[1].Assets);
        // Year 1 → 2: contribution stops (year > endDate.Year), value stays 110,000
        Assert.AreEqual(110_000, result.Years[2].Assets);
    }

    [TestMethod]
    public void RunCompound_HorizonZero_ReturnsOnlyCurrentValues()
    {
        var asset = MakeAsset(currentValue: 50_000);
        var result = ProjectionEngine.RunCompound([asset], horizon: 0);

        Assert.AreEqual(1, result.Years.Count);
        Assert.AreEqual(50_000, result.Years[0].Assets);
    }

    [TestMethod]
    public void RunCompound_EmptyEntities_ReturnsZeroes()
    {
        var result = ProjectionEngine.RunCompound([], horizon: 2);

        Assert.AreEqual(3, result.Years.Count);
        Assert.AreEqual(0, result.Years[0].NetWorth);
        Assert.AreEqual(0, result.Years[2].NetWorth);
    }

    // --- RunScenario ---

    [TestMethod]
    public void RunScenario_BaseCase_MatchesCompound()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.07);
        var compound = ProjectionEngine.RunCompound([asset], horizon: 3);
        var scenario = ProjectionEngine.RunScenario([asset], horizon: 3);

        // Base scenario should match compound projection
        for (var i = 0; i <= 3; i++)
            Assert.AreEqual(compound.Years[i].Assets, scenario.Years[i].Base.Assets);
    }

    [TestMethod]
    public void RunScenario_PessimisticBelowBase_OptimisticAbove()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.07);
        var result = ProjectionEngine.RunScenario([asset], horizon: 5);

        // After year 0, pessimistic < base < optimistic
        for (var i = 1; i <= 5; i++)
        {
            Assert.IsTrue(result.Years[i].Pessimistic.Assets < result.Years[i].Base.Assets,
                $"Year {i}: pessimistic should be less than base");
            Assert.IsTrue(result.Years[i].Base.Assets < result.Years[i].Optimistic.Assets,
                $"Year {i}: base should be less than optimistic");
        }
    }

    [TestMethod]
    public void RunScenario_Liability_AllScenariosDeclineWithPayments()
    {
        var liability = MakeLiability(currentValue: 100_000, annualContribution: 20_000, interestRate: 0.05);
        var result = ProjectionEngine.RunScenario([liability], horizon: 3);

        // All scenarios should show declining liability with payments exceeding interest
        for (var i = 1; i <= 3; i++)
        {
            Assert.IsTrue(result.Years[i].Base.Liabilities < result.Years[0].Base.Liabilities,
                $"Year {i}: liability should decrease from initial value");
        }
    }

    // --- RunMonteCarlo ---

    [TestMethod]
    public void RunMonteCarlo_ReturnsCorrectStructure()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.07, volatility: 0.15);
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 5, simulations: 100);

        Assert.AreEqual(5, result.Horizon);
        Assert.AreEqual(6, result.Years.Count); // Year 0 + 5
        Assert.AreEqual(100, result.Simulations);
    }

    [TestMethod]
    public void RunMonteCarlo_Year0_AllPercentilesEqualCurrentValue()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.07, volatility: 0.15);
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 3, simulations: 500);

        // At year 0, all percentiles should equal current value (no randomness yet)
        Assert.AreEqual(100_000, result.Years[0].P50);
        Assert.AreEqual(100_000, result.Years[0].P10);
        Assert.AreEqual(100_000, result.Years[0].P90);
    }

    [TestMethod]
    public void RunMonteCarlo_PercentilesAreOrdered()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.07, volatility: 0.15);
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 5, simulations: 1000);

        for (var i = 1; i <= 5; i++)
        {
            Assert.IsTrue(result.Years[i].P10 <= result.Years[i].P25, $"Year {i}: P10 <= P25");
            Assert.IsTrue(result.Years[i].P25 <= result.Years[i].P50, $"Year {i}: P25 <= P50");
            Assert.IsTrue(result.Years[i].P50 <= result.Years[i].P75, $"Year {i}: P50 <= P75");
            Assert.IsTrue(result.Years[i].P75 <= result.Years[i].P90, $"Year {i}: P75 <= P90");
        }
    }

    [TestMethod]
    public void RunMonteCarlo_ClampsSimulations_Low()
    {
        var asset = MakeAsset();
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 1, simulations: 10);
        Assert.AreEqual(100, result.Simulations);
    }

    [TestMethod]
    public void RunMonteCarlo_ClampsSimulations_High()
    {
        var asset = MakeAsset();
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 1, simulations: 99999);
        Assert.AreEqual(10000, result.Simulations);
    }

    [TestMethod]
    public void RunMonteCarlo_ZeroVolatility_AllPercentilesEqual()
    {
        var asset = MakeAsset(currentValue: 100_000, returnRate: 0.10, volatility: 0);
        var result = ProjectionEngine.RunMonteCarlo([asset], horizon: 2, simulations: 200);

        // With zero volatility, Monte Carlo should behave deterministically
        Assert.AreEqual(result.Years[1].P10, result.Years[1].P90);
        Assert.AreEqual(result.Years[2].P10, result.Years[2].P90);
    }

    // --- Entity projections ---

    [TestMethod]
    public void RunCompound_ReturnsEntityProjections()
    {
        var asset = MakeAsset(currentValue: 50_000, returnRate: 0.10);
        var result = ProjectionEngine.RunCompound([asset], horizon: 2);

        Assert.AreEqual(1, result.Entities.Count);
        Assert.AreEqual("Test Asset", result.Entities[0].Label);
        Assert.AreEqual("asset", result.Entities[0].EntityType);
        Assert.AreEqual(3, result.Entities[0].Years.Count);
    }
}
