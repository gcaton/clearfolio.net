using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class CashflowEndpoints
{
    public static WebApplication MapCashflowEndpoints(this WebApplication app)
    {
        app.MapGet("/api/cashflow/summary", GetSummary);
        return app;
    }

    private static async Task<IResult> GetSummary(HttpContext context, ClearfolioDbContext db, string view = "household")
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var householdId = member.HouseholdId;

        var members = await db.HouseholdMembers
            .AsNoTracking()
            .Where(m => m.HouseholdId == householdId)
            .ToListAsync();

        var targetMember = view is "p1" or "p2"
            ? members.FirstOrDefault(m => m.MemberTag == view)
            : null;

        var incomeStreams = await db.IncomeStreams
            .AsNoTracking()
            .Include(i => i.OwnerMember)
            .Where(i => i.HouseholdId == householdId && i.IsActive)
            .ToListAsync();

        var expenses = await db.Expenses
            .AsNoTracking()
            .Include(e => e.ExpenseCategory)
            .Where(e => e.HouseholdId == householdId && e.IsActive)
            .ToListAsync();

        var assets = await db.Assets
            .AsNoTracking()
            .Where(a => a.HouseholdId == householdId && a.IsActive)
            .ToListAsync();

        var liabilities = await db.Liabilities
            .AsNoTracking()
            .Where(l => l.HouseholdId == householdId && l.IsActive)
            .ToListAsync();

        double totalIncome = 0;
        double totalExpenses = 0;
        double totalContributions = 0;
        double totalRepayments = 0;

        var incomeByMember = new Dictionary<Guid, (string Tag, string Name, double Amount)>();
        var expensesByCategory = new Dictionary<string, double>();

        foreach (var inc in incomeStreams)
        {
            var annual = FrequencyHelper.Annualise(inc.Amount, inc.Frequency);
            if (targetMember is null || inc.OwnerMemberId == targetMember.Id)
            {
                totalIncome += annual;
                if (incomeByMember.TryGetValue(inc.OwnerMemberId, out var existing))
                    incomeByMember[inc.OwnerMemberId] = (existing.Tag, existing.Name, existing.Amount + annual);
                else
                    incomeByMember[inc.OwnerMemberId] = (inc.OwnerMember.MemberTag, inc.OwnerMember.DisplayName, annual);
            }
        }

        foreach (var exp in expenses)
        {
            var annual = FrequencyHelper.Annualise(exp.Amount, exp.Frequency);
            double effective;

            if (targetMember is null)
            {
                effective = annual;
            }
            else if (exp.OwnerMemberId == targetMember.Id)
            {
                effective = annual;
            }
            else if (exp.OwnerMemberId is null)
            {
                effective = annual * 0.5;
            }
            else
            {
                continue;
            }

            totalExpenses += effective;
            var catName = exp.ExpenseCategory.Name;
            expensesByCategory[catName] = expensesByCategory.GetValueOrDefault(catName) + effective;
        }

        double totalPreTaxContributions = 0;

        foreach (var asset in assets)
        {
            if (asset.ContributionAmount is null or 0 || asset.ContributionFrequency is null) continue;
            var annual = FrequencyHelper.Annualise(asset.ContributionAmount.Value, asset.ContributionFrequency);
            double effective;

            if (targetMember is null)
            {
                effective = annual;
            }
            else if (asset.OwnerMemberId == targetMember.Id)
            {
                effective = asset.OwnershipType == "joint" ? annual * asset.JointSplit : annual;
            }
            else if (asset.OwnershipType == "joint" && asset.OwnerMemberId != targetMember.Id)
            {
                effective = annual * (1 - asset.JointSplit);
            }
            else
            {
                continue;
            }

            totalContributions += effective;
            if (asset.IsPreTaxContribution)
                totalPreTaxContributions += effective;
        }

        foreach (var liability in liabilities)
        {
            if (liability.RepaymentAmount is null or 0 || liability.RepaymentFrequency is null) continue;
            var annual = FrequencyHelper.Annualise(liability.RepaymentAmount.Value, liability.RepaymentFrequency);

            if (targetMember is null)
            {
                totalRepayments += annual;
            }
            else
            {
                if (liability.OwnerMemberId == targetMember.Id)
                    totalRepayments += liability.OwnershipType == "joint" ? annual * liability.JointSplit : annual;
                else if (liability.OwnershipType == "joint" && liability.OwnerMemberId != targetMember.Id)
                    totalRepayments += annual * (1 - liability.JointSplit);
            }
        }

        var postTaxContributions = totalContributions - totalPreTaxContributions;
        var disposable = totalIncome - totalExpenses;
        var netCashflow = disposable - postTaxContributions - totalRepayments;
        var savingsRate = totalIncome > 0 ? totalContributions / totalIncome : 0;
        var debtToIncomeRatio = totalIncome > 0 ? totalRepayments / totalIncome : 0;

        var summary = new CashflowSummaryDto(
            TotalAnnualIncome: Math.Round(totalIncome, 2),
            TotalAnnualExpenses: Math.Round(totalExpenses, 2),
            TotalAnnualContributions: Math.Round(totalContributions, 2),
            TotalAnnualRepayments: Math.Round(totalRepayments, 2),
            DisposableIncome: Math.Round(disposable, 2),
            NetCashflow: Math.Round(netCashflow, 2),
            SavingsRate: Math.Round(savingsRate, 4),
            DebtToIncomeRatio: Math.Round(debtToIncomeRatio, 4),
            IncomeByMember: incomeByMember.Values
                .Select(v => new IncomeByMemberDto(v.Tag, v.Name, Math.Round(v.Amount, 2)))
                .OrderBy(v => v.MemberTag)
                .ToList(),
            ExpensesByCategory: expensesByCategory
                .Select(kv => new ExpensesByCategoryDto(kv.Key, Math.Round(kv.Value, 2)))
                .OrderByDescending(v => v.AnnualAmount)
                .ToList()
        );

        return Results.Ok(summary);
    }
}
