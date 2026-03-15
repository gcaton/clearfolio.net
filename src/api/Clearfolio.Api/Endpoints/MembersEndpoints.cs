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
        app.MapPost("/api/members", CreateMember);
        app.MapPut("/api/members/{id:guid}", UpdateMember);
        return app;
    }

    private static async Task<IResult> GetMembers(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMember(context);

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
        var m = GetMember(context);
        return Results.Ok(new MemberDto(m.Id, m.Email, m.DisplayName, m.MemberTag, m.IsPrimary, m.CreatedAt));
    }

    private static async Task<IResult> CreateMember(CreateMemberRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var currentMember = GetMember(context);

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
        var currentMember = GetMember(context);

        var target = await db.HouseholdMembers.FirstOrDefaultAsync(m => m.Id == id && m.HouseholdId == currentMember.HouseholdId);
        if (target is null) return Results.NotFound();

        target.DisplayName = request.DisplayName;
        await db.SaveChangesAsync();

        return Results.Ok(new MemberDto(target.Id, target.Email, target.DisplayName, target.MemberTag, target.IsPrimary, target.CreatedAt));
    }

    private static HouseholdMember GetMember(HttpContext context) =>
        (HouseholdMember)context.Items["HouseholdMember"]!;
}
