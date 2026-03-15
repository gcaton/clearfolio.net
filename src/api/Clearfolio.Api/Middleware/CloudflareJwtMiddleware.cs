using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Middleware;

public class CloudflareJwtMiddleware(RequestDelegate next, IConfiguration config, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context, ClearfolioDbContext db)
    {
        var email = ResolveEmail(context);
        if (email is null)
        {
            context.Response.StatusCode = 401;
            return;
        }

        var member = await db.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.Email == email);

        if (member is null)
        {
            member = await AutoProvision(db, email);
        }

        context.Items["UserEmail"] = email;
        context.Items["HouseholdMember"] = member;

        await next(context);
    }

    private string? ResolveEmail(HttpContext context)
    {
        if (env.IsDevelopment())
        {
            return config["DevAuth:MockUserEmail"];
        }

        return context.Request.Headers.TryGetValue("Cf-Access-Jwt-Assertion", out var token) && token.Count > 0
            ? null // TODO: validate JWT and extract email claim
            : null;
    }

    private static async Task<HouseholdMember> AutoProvision(ClearfolioDbContext db, string email)
    {
        var existingHousehold = await db.Households.FirstOrDefaultAsync();

        var household = existingHousehold ?? new Household
        {
            Id = Guid.NewGuid(),
            Name = "My Household",
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        if (existingHousehold is null)
        {
            db.Households.Add(household);
        }

        var memberCount = await db.HouseholdMembers.CountAsync(m => m.HouseholdId == household.Id);

        var member = new HouseholdMember
        {
            Id = Guid.NewGuid(),
            HouseholdId = household.Id,
            Email = email,
            DisplayName = email.Split('@')[0],
            MemberTag = $"p{memberCount + 1}",
            IsPrimary = memberCount == 0,
            CreatedAt = DateTime.UtcNow.ToString("o"),
            Household = household
        };

        db.HouseholdMembers.Add(member);
        await db.SaveChangesAsync();

        return member;
    }
}
