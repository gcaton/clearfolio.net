using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class LiabilitiesEndpoints
{
    public static WebApplication MapLiabilitiesEndpoints(this WebApplication app)
    {
        app.MapGet("/api/liabilities", GetLiabilities);
        app.MapPost("/api/liabilities", CreateLiability);
        app.MapPut("/api/liabilities/{id:guid}", UpdateLiability);
        app.MapDelete("/api/liabilities/{id:guid}", DeleteLiability);
        return app;
    }

    private static async Task<IResult> GetLiabilities(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var liabilities = await db.Liabilities
            .AsNoTracking()
            .Include(l => l.LiabilityType)
            .Include(l => l.OwnerMember)
            .Where(l => l.HouseholdId == member.HouseholdId && l.IsActive)
            .OrderBy(l => l.LiabilityType.SortOrder)
            .ThenBy(l => l.Label)
            .Select(l => ToDto(l))
            .ToListAsync();

        return Results.Ok(liabilities);
    }

    private static async Task<IResult> CreateLiability(CreateLiabilityRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();
        var now = DateTime.UtcNow.ToString("o");

        var liability = new Liability
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            LiabilityTypeId = request.LiabilityTypeId,
            OwnerMemberId = request.OwnerMemberId,
            OwnershipType = request.OwnershipType,
            JointSplit = request.JointSplit,
            Label = request.Label,
            Currency = request.Currency,
            Notes = request.Notes,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Liabilities.Add(liability);
        await db.SaveChangesAsync();

        await db.Entry(liability).Reference(l => l.LiabilityType).LoadAsync();
        if (liability.OwnerMemberId is not null)
            await db.Entry(liability).Reference(l => l.OwnerMember).LoadAsync();

        return Results.Created($"/api/liabilities/{liability.Id}", ToDto(liability));
    }

    private static async Task<IResult> UpdateLiability(Guid id, UpdateLiabilityRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var liability = await db.Liabilities
            .Include(l => l.LiabilityType)
            .Include(l => l.OwnerMember)
            .FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == member.HouseholdId);

        if (liability is null) return Results.NotFound();

        liability.LiabilityTypeId = request.LiabilityTypeId;
        liability.OwnerMemberId = request.OwnerMemberId;
        liability.OwnershipType = request.OwnershipType;
        liability.JointSplit = request.JointSplit;
        liability.Label = request.Label;
        liability.Currency = request.Currency;
        liability.Notes = request.Notes;
        liability.UpdatedAt = DateTime.UtcNow.ToString("o");

        await db.SaveChangesAsync();

        await db.Entry(liability).Reference(l => l.LiabilityType).LoadAsync();
        if (liability.OwnerMemberId is not null)
            await db.Entry(liability).Reference(l => l.OwnerMember).LoadAsync();

        return Results.Ok(ToDto(liability));
    }

    private static async Task<IResult> DeleteLiability(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var liability = await db.Liabilities.FirstOrDefaultAsync(l => l.Id == id && l.HouseholdId == member.HouseholdId);
        if (liability is null) return Results.NotFound();

        liability.IsActive = false;
        liability.UpdatedAt = DateTime.UtcNow.ToString("o");
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static LiabilityDto ToDto(Liability l) => new(
        l.Id, l.LiabilityTypeId, l.LiabilityType.Name,
        l.OwnerMemberId, l.OwnerMember?.DisplayName,
        l.OwnershipType, l.JointSplit,
        l.Label, l.Currency, l.Notes, l.IsActive,
        l.CreatedAt, l.UpdatedAt);

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
