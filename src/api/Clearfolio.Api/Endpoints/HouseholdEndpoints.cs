using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class HouseholdEndpoints
{
    public static WebApplication MapHouseholdEndpoints(this WebApplication app)
    {
        app.MapGet("/api/household", GetHousehold);
        app.MapPut("/api/household", UpdateHousehold);
        return app;
    }

    private static IResult GetHousehold(HttpContext context)
    {
        var member = GetMember(context);
        var h = member.Household;

        return Results.Ok(new HouseholdDto(h.Id, h.Name, h.BaseCurrency, h.PreferredPeriodType, h.CreatedAt));
    }

    private static async Task<IResult> UpdateHousehold(HttpContext context, UpdateHouseholdRequest request, ClearfolioDbContext db)
    {
        var member = GetMember(context);
        var household = await db.Households.FindAsync(member.HouseholdId);
        if (household is null) return Results.NotFound();

        household.Name = request.Name;
        household.BaseCurrency = request.BaseCurrency;
        household.PreferredPeriodType = request.PreferredPeriodType;

        await db.SaveChangesAsync();

        return Results.Ok(new HouseholdDto(household.Id, household.Name, household.BaseCurrency, household.PreferredPeriodType, household.CreatedAt));
    }

    private static HouseholdMember GetMember(HttpContext context) =>
        (HouseholdMember)context.Items["HouseholdMember"]!;
}
