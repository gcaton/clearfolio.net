using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class MembersEndpoints
{
    public static WebApplication MapMembersEndpoints(this WebApplication app)
    {
        app.MapGet("/api/members", GetMembers);
        app.MapGet("/api/members/me", GetCurrentMember);
        app.MapPost("/api/members/setup", SetupMember);
        app.MapPost("/api/members", CreateMember);
        app.MapPut("/api/members/{id:guid}", UpdateMember);
        app.MapDelete("/api/members/{id:guid}", DeleteMember);
        return app;
    }

    private static async Task<IResult> GetMembers(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var members = await db.HouseholdMembers
            .AsNoTracking()
            .Where(m => m.HouseholdId == member.HouseholdId)
            .OrderBy(m => m.MemberTag)
            .Select(m => new MemberDto(m.Id, m.Email, m.DisplayName, m.MemberTag, m.IsPrimary, m.CreatedAt))
            .ToListAsync();

        return Results.Ok(members);
    }

    private static async Task<IResult> GetCurrentMember(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.Items["HouseholdMember"] as HouseholdMember;
        if (member is null)
        {
            var setupComplete = await db.Households.AnyAsync();
            if (!setupComplete)
                return Results.NotFound();
            return Results.Unauthorized();
        }

        return Results.Ok(new MemberDto(
            member.Id, member.Email, member.DisplayName,
            member.MemberTag, member.IsPrimary, member.CreatedAt));
    }

    private static async Task<IResult> SetupMember(SetupRequest request, HttpContext context, ClearfolioDbContext db)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
            return Results.BadRequest("Display name is required.");

        if (await db.Households.AnyAsync())
            return Results.BadRequest("Setup has already been completed.");

        var household = new Household
        {
            Id = Guid.NewGuid(),
            Name = request.HouseholdName ?? "My Household",
            BaseCurrency = request.Currency ?? "AUD",
            PreferredPeriodType = request.PeriodType ?? "FY",
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.Households.Add(household);

        var member = new HouseholdMember
        {
            Id = Guid.NewGuid(),
            HouseholdId = household.Id,
            DisplayName = request.DisplayName.Trim(),
            MemberTag = "p1",
            IsPrimary = true,
            CreatedAt = DateTime.UtcNow.ToString("o"),
            Household = household
        };
        db.HouseholdMembers.Add(member);

        ExpenseCategoriesEndpoints.SeedDefaultCategories(db, household.Id);

        await db.SaveChangesAsync();

        return Results.Created($"/api/members/{member.Id}", new MemberDto(
            member.Id, member.Email, member.DisplayName,
            member.MemberTag, member.IsPrimary, member.CreatedAt));
    }

    private static async Task<IResult> CreateMember(CreateMemberRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var currentMember = GetMemberOrNull(context);
        if (currentMember is null) return Results.Unauthorized();

        var memberCount = await db.HouseholdMembers.CountAsync(m => m.HouseholdId == currentMember.HouseholdId);

        var member = new HouseholdMember
        {
            Id = Guid.NewGuid(),
            HouseholdId = currentMember.HouseholdId,
            Email = request.Email,
            DisplayName = request.DisplayName,
            MemberTag = $"p{memberCount + 1}",
            IsPrimary = false,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        db.HouseholdMembers.Add(member);
        await db.SaveChangesAsync();

        return Results.Created($"/api/members/{member.Id}", new MemberDto(member.Id, member.Email, member.DisplayName, member.MemberTag, member.IsPrimary, member.CreatedAt));
    }

    private static async Task<IResult> UpdateMember(Guid id, UpdateMemberRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var currentMember = GetMemberOrNull(context);
        if (currentMember is null) return Results.Unauthorized();

        var target = await db.HouseholdMembers.FirstOrDefaultAsync(m => m.Id == id && m.HouseholdId == currentMember.HouseholdId);
        if (target is null) return Results.NotFound();

        target.DisplayName = request.DisplayName;
        if (!string.IsNullOrWhiteSpace(request.Email))
            target.Email = request.Email;
        await db.SaveChangesAsync();

        return Results.Ok(new MemberDto(target.Id, target.Email, target.DisplayName, target.MemberTag, target.IsPrimary, target.CreatedAt));
    }

    private static async Task<IResult> DeleteMember(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var caller = GetMemberOrNull(context);
        if (caller is null) return Results.Unauthorized();
        if (!caller.IsPrimary) return Results.Forbid();

        var target = await db.HouseholdMembers.FirstOrDefaultAsync(m => m.Id == id && m.HouseholdId == caller.HouseholdId);
        if (target is null) return Results.NotFound();
        if (target.IsPrimary) return Results.BadRequest("Cannot delete the primary member. Use DELETE /api/household to reset all data.");

        await using var transaction = await db.Database.BeginTransactionAsync();

        var assetIds = await db.Assets
            .Where(a => a.OwnerMemberId == id)
            .Select(a => a.Id)
            .ToListAsync();

        var liabilityIds = await db.Liabilities
            .Where(l => l.OwnerMemberId == id)
            .Select(l => l.Id)
            .ToListAsync();

        var entityIds = assetIds.Concat(liabilityIds).ToList();

        if (entityIds.Count > 0)
            await db.Snapshots.Where(s => entityIds.Contains(s.EntityId)).ExecuteDeleteAsync();

        await db.Assets.Where(a => a.OwnerMemberId == id).ExecuteDeleteAsync();
        await db.Liabilities.Where(l => l.OwnerMemberId == id).ExecuteDeleteAsync();
        await db.IncomeStreams.Where(i => i.OwnerMemberId == id).ExecuteDeleteAsync();
        await db.Expenses.Where(e => e.OwnerMemberId == id).ExecuteDeleteAsync();
        await db.Snapshots.Where(s => s.RecordedBy == id).ExecuteDeleteAsync();
        await db.HouseholdMembers.Where(m => m.Id == id).ExecuteDeleteAsync();

        await transaction.CommitAsync();

        return Results.NoContent();
    }

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
