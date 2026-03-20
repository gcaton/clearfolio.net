using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clearfolio.Api.Endpoints;

public static class HouseholdEndpoints
{
    public static WebApplication MapHouseholdEndpoints(this WebApplication app)
    {
        app.MapGet("/api/household", GetHousehold);
        app.MapPut("/api/household", UpdateHousehold);
        app.MapDelete("/api/household", DeleteHousehold);
        return app;
    }

    private static IResult GetHousehold(HttpContext context)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        var h = member.Household;
        return Results.Ok(new HouseholdDto(h.Id, h.Name, h.BaseCurrency, h.PreferredPeriodType, h.CreatedAt));
    }

    private static async Task<IResult> UpdateHousehold(HttpContext context, UpdateHouseholdRequest request, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        var household = await db.Households.FindAsync(member.HouseholdId);
        if (household is null) return Results.NotFound();

        household.Name = request.Name;
        household.BaseCurrency = request.BaseCurrency;
        household.PreferredPeriodType = request.PreferredPeriodType;

        await db.SaveChangesAsync();

        return Results.Ok(new HouseholdDto(household.Id, household.Name, household.BaseCurrency, household.PreferredPeriodType, household.CreatedAt));
    }

    private static async Task<IResult> DeleteHousehold(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.Items["HouseholdMember"] as HouseholdMember;
        if (member is null) return Results.Unauthorized();
        if (!member.IsPrimary) return Results.Forbid();

        var householdId = member.HouseholdId;

        await using var transaction = await db.Database.BeginTransactionAsync();

        await db.Snapshots.Where(s => s.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Assets.Where(a => a.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Liabilities.Where(l => l.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.HouseholdMembers.Where(m => m.HouseholdId == householdId).ExecuteDeleteAsync();
        await db.Households.Where(h => h.Id == householdId).ExecuteDeleteAsync();

        await transaction.CommitAsync();

        return Results.NoContent();
    }

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
