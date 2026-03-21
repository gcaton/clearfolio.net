using Clearfolio.Api.Helpers;

namespace Clearfolio.Tests;

[TestClass]
public class PeriodHelperTests
{
    // --- PeriodStart ---

    [TestMethod]
    [DataRow("CY2025-Q1", 2025, 1, 1)]
    [DataRow("CY2025-Q2", 2025, 4, 1)]
    [DataRow("CY2025-Q3", 2025, 7, 1)]
    [DataRow("CY2025-Q4", 2025, 10, 1)]
    public void PeriodStart_CY_ReturnsCorrectDate(string period, int year, int month, int day)
    {
        var result = PeriodHelper.PeriodStart(period);
        Assert.AreEqual(new DateOnly(year, month, day), result);
    }

    [TestMethod]
    [DataRow("FY2025-Q1", 2024, 7, 1)]   // Jul prior year
    [DataRow("FY2025-Q2", 2024, 10, 1)]  // Oct prior year
    [DataRow("FY2025-Q3", 2025, 1, 1)]   // Jan same year
    [DataRow("FY2025-Q4", 2025, 4, 1)]   // Apr same year
    public void PeriodStart_FY_ReturnsCorrectDate(string period, int year, int month, int day)
    {
        var result = PeriodHelper.PeriodStart(period);
        Assert.AreEqual(new DateOnly(year, month, day), result);
    }

    [TestMethod]
    public void PeriodStart_FullCY_ReturnsJanuary1()
    {
        var result = PeriodHelper.PeriodStart("CY2025");
        Assert.AreEqual(new DateOnly(2025, 1, 1), result);
    }

    [TestMethod]
    public void PeriodStart_FullFY_ReturnsJulyPriorYear()
    {
        var result = PeriodHelper.PeriodStart("FY2025");
        Assert.AreEqual(new DateOnly(2024, 7, 1), result);
    }

    [TestMethod]
    public void PeriodStart_InvalidFormat_Throws()
    {
        Assert.ThrowsExactly<ArgumentException>(() => PeriodHelper.PeriodStart("invalid"));
    }

    // --- PreviousPeriod ---

    [TestMethod]
    [DataRow("CY2025-Q2", "CY2025-Q1")]
    [DataRow("CY2025-Q1", "CY2024-Q4")]  // Wraps to prior year
    [DataRow("FY2025-Q1", "FY2024-Q4")]
    [DataRow("FY2025-Q3", "FY2025-Q2")]
    public void PreviousPeriod_ReturnsCorrectPeriod(string input, string expected)
    {
        Assert.AreEqual(expected, PeriodHelper.PreviousPeriod(input));
    }

    [TestMethod]
    public void PreviousPeriod_FullYear_DecreasesYear()
    {
        Assert.AreEqual("CY2024", PeriodHelper.PreviousPeriod("CY2025"));
        Assert.AreEqual("FY2024", PeriodHelper.PreviousPeriod("FY2025"));
    }

    // --- NextPeriod ---

    [TestMethod]
    [DataRow("CY2025-Q1", "CY2025-Q2")]
    [DataRow("CY2025-Q4", "CY2026-Q1")]  // Wraps to next year
    [DataRow("FY2025-Q4", "FY2026-Q1")]
    [DataRow("FY2025-Q2", "FY2025-Q3")]
    public void NextPeriod_ReturnsCorrectPeriod(string input, string expected)
    {
        Assert.AreEqual(expected, PeriodHelper.NextPeriod(input));
    }

    // --- SameQuarterPriorYear ---

    [TestMethod]
    [DataRow("CY2025-Q3", "CY2024-Q3")]
    [DataRow("FY2025-Q1", "FY2024-Q1")]
    [DataRow("CY2025", "CY2024")]
    public void SameQuarterPriorYear_ReturnsCorrectPeriod(string input, string expected)
    {
        Assert.AreEqual(expected, PeriodHelper.SameQuarterPriorYear(input));
    }

    // --- PreviousPeriods ---

    [TestMethod]
    public void PreviousPeriods_ReturnsCorrectChain()
    {
        var result = PeriodHelper.PreviousPeriods("CY2025-Q3", 4);

        Assert.AreEqual(4, result.Count);
        Assert.AreEqual("CY2024-Q4", result[0]);
        Assert.AreEqual("CY2025-Q1", result[1]);
        Assert.AreEqual("CY2025-Q2", result[2]);
        Assert.AreEqual("CY2025-Q3", result[3]);
    }

    [TestMethod]
    public void PreviousPeriods_CrossesYearBoundary_FY()
    {
        var result = PeriodHelper.PreviousPeriods("FY2025-Q2", 3);

        Assert.AreEqual(3, result.Count);
        Assert.AreEqual("FY2024-Q4", result[0]);  // Oldest first (reversed)
        Assert.AreEqual("FY2025-Q1", result[1]);
        Assert.AreEqual("FY2025-Q2", result[2]);
    }

    // --- Roundtrip: Next then Previous returns original ---

    [TestMethod]
    [DataRow("CY2025-Q1")]
    [DataRow("CY2025-Q4")]
    [DataRow("FY2025-Q1")]
    [DataRow("FY2025-Q4")]
    public void NextThenPrevious_Roundtrips(string period)
    {
        Assert.AreEqual(period, PeriodHelper.PreviousPeriod(PeriodHelper.NextPeriod(period)));
    }
}
