using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;

namespace Clearfolio.Api.Middleware;

public class LocalAuthMiddleware
{
    private readonly RequestDelegate _next;

    public LocalAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ClearfolioDbContext db)
    {
        // Auth endpoints are always exempt
        if (context.Request.Path.StartsWithSegments("/api/auth"))
        {
            await _next(context);
            return;
        }

        // Check if passphrase is enabled
        var passphraseSetting = await db.AppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == "passphrase");

        if (passphraseSetting is not null)
        {
            // Passphrase is set — validate session cookie
            var sessionToken = context.Request.Cookies["clearfolio_session"];
            if (string.IsNullOrEmpty(sessionToken))
            {
                context.Response.StatusCode = 401;
                return;
            }

            var sessionKey = $"session:{sessionToken}";
            var session = await db.AppSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == sessionKey);

            if (session is null || !long.TryParse(session.Value, out var expiry) ||
                DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiry)
            {
                // Expired or invalid — clean up and reject
                if (session is not null)
                {
                    db.AppSettings.Remove(session);
                    await db.SaveChangesAsync();
                }
                context.Response.StatusCode = 401;
                return;
            }
        }

        // Resolve primary member for downstream endpoints
        var member = await db.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.IsPrimary);

        context.Items["HouseholdMember"] = member;
        context.Items["UserEmail"] = member?.Email ?? string.Empty;

        await _next(context);
    }
}
