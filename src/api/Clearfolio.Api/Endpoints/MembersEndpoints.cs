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

    private static IResult GetCurrentMember(HttpContext context)
    {
        var member = context.Items["HouseholdMember"] as HouseholdMember;
        if (member is null)
        {
            var email = (string)context.Items["UserEmail"]!;
            return Results.NotFound(new SetupStatusDto(true, email));
        }
        return Results.Ok(new MemberDto(member.Id, member.Email, member.DisplayName, member.MemberTag, member.IsPrimary, member.CreatedAt));
    }

    private static async Task<IResult> SetupMember(SetupRequest request, HttpContext context, ClearfolioDbContext db)
    {
        if (context.Items["HouseholdMember"] is HouseholdMember)
            return Results.BadRequest("Already set up.");

        var displayName = request.DisplayName?.Trim();
        if (string.IsNullOrEmpty(displayName))
            return Results.BadRequest("Display name is required.");

        var email = (string)context.Items["UserEmail"]!;

        // Handle race condition — if member was created concurrently
        var existing = await db.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.Email == email);
        if (existing is not null)
            return Results.Ok(new MemberDto(existing.Id, existing.Email, existing.DisplayName, existing.MemberTag, existing.IsPrimary, existing.CreatedAt));

        var household = new Household
        {
            Id = Guid.NewGuid(),
            Name = "My Household",
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.Households.Add(household);

        var member = new HouseholdMember
        {
            Id = Guid.NewGuid(),
            HouseholdId = household.Id,
            Email = email,
            DisplayName = displayName,
            MemberTag = "p1",
            IsPrimary = true,
            CreatedAt = DateTime.UtcNow.ToString("o"),
            Household = household
        };
        db.HouseholdMembers.Add(member);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Concurrent insert won the race — return the existing member
            db.ChangeTracker.Clear();
            var raced = await db.HouseholdMembers
                .Include(m => m.Household)
                .FirstAsync(m => m.Email == email);
            return Results.Ok(new MemberDto(raced.Id, raced.Email, raced.DisplayName, raced.MemberTag, raced.IsPrimary, raced.CreatedAt));
        }

        return Results.Created($"/api/members/{member.Id}", new MemberDto(member.Id, member.Email, member.DisplayName, member.MemberTag, member.IsPrimary, member.CreatedAt));
    }

    private static async Task<IResult> CreateMember(CreateMemberRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var currentMember = GetMemberOrNull(context);
        if (currentMember is null) return Results.Unauthorized();

        var exists = await db.HouseholdMembers.AnyAsync(m => m.Email == request.Email);
        if (exists) return Results.BadRequest("A member with this email already exists.");

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

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
