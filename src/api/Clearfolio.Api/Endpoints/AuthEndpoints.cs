using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapGet("/status", GetStatus);
        group.MapPost("/login", Login).RequireRateLimiting("auth");
        group.MapPost("/logout", Logout);
        group.MapPut("/passphrase", SetPassphrase).RequireRateLimiting("auth");
        group.MapDelete("/passphrase", RemovePassphrase).RequireRateLimiting("auth");
    }

    private static async Task<IResult> GetStatus(HttpContext context, ClearfolioDbContext db)
    {
        var hasPassphrase = await db.AppSettings.AnyAsync(s => s.Key == "passphrase");
        var setupComplete = await db.Households.AnyAsync();

        var authenticated = true;
        if (hasPassphrase)
        {
            var sessionToken = context.Request.Cookies["clearfolio_session"];
            if (string.IsNullOrEmpty(sessionToken))
            {
                authenticated = false;
            }
            else
            {
                var sessionKey = $"session:{sessionToken}";
                var session = await db.AppSettings.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Key == sessionKey);
                authenticated = session is not null &&
                    long.TryParse(session.Value, out var expiry) &&
                    DateTimeOffset.UtcNow.ToUnixTimeSeconds() <= expiry;
            }
        }

        return Results.Ok(new { passphraseEnabled = hasPassphrase, authenticated, setupComplete });
    }

    private static async Task<IResult> Login(HttpContext context, ClearfolioDbContext db)
    {
        var request = await context.Request.ReadFromJsonAsync<LoginRequest>();
        if (request is null || string.IsNullOrEmpty(request.Passphrase))
            return ApiErrors.BadRequest("Passphrase is required.");

        var passphraseSetting = await db.AppSettings
            .FirstOrDefaultAsync(s => s.Key == "passphrase");

        if (passphraseSetting is null)
            return ApiErrors.BadRequest("No passphrase is set.");

        if (!BCrypt.Net.BCrypt.Verify(request.Passphrase, passphraseSetting.Value))
            return Results.Unauthorized();

        var sessionDays = int.TryParse(
            Environment.GetEnvironmentVariable("CLEARFOLIO_SESSION_DAYS"), out var days)
            ? days : 30;

        // #1: Use cryptographically random token instead of GUID
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var expiry = DateTimeOffset.UtcNow.AddDays(sessionDays).ToUnixTimeSeconds();

        db.AppSettings.Add(new AppSetting
        {
            Key = $"session:{token}",
            Value = expiry.ToString()
        });

        // #3: Clean up expired sessions on login
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var expiredSessions = await db.AppSettings
            .Where(s => s.Key.StartsWith("session:"))
            .ToListAsync();
        foreach (var expired in expiredSessions.Where(s =>
            !long.TryParse(s.Value, out var exp) || now > exp))
        {
            db.AppSettings.Remove(expired);
        }

        await db.SaveChangesAsync();

        // #5: Set Secure flag when behind HTTPS
        var isHttps = context.Request.IsHttps ||
            string.Equals(context.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        context.Response.Cookies.Append("clearfolio_session", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = isHttps,
            SameSite = SameSiteMode.Strict,
            MaxAge = TimeSpan.FromDays(sessionDays),
            Path = "/"
        });

        return Results.Ok();
    }

    private static async Task<IResult> Logout(HttpContext context, ClearfolioDbContext db)
    {
        var sessionToken = context.Request.Cookies["clearfolio_session"];
        if (!string.IsNullOrEmpty(sessionToken))
        {
            var sessionKey = $"session:{sessionToken}";
            var session = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == sessionKey);
            if (session is not null)
            {
                db.AppSettings.Remove(session);
                await db.SaveChangesAsync();
            }
        }

        context.Response.Cookies.Delete("clearfolio_session", new CookieOptions { Path = "/" });
        return Results.Ok();
    }

    private static async Task<IResult> SetPassphrase(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null)
            return Results.Unauthorized();

        var request = await context.Request.ReadFromJsonAsync<SetPassphraseRequest>();
        if (request is null || string.IsNullOrEmpty(request.NewPassphrase))
            return ApiErrors.BadRequest("New passphrase is required.");

        // #2: Enforce minimum passphrase length
        if (request.NewPassphrase.Length < 8)
            return ApiErrors.BadRequest("Passphrase must be at least 8 characters.");

        var existing = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == "passphrase");

        if (existing is not null)
        {
            if (string.IsNullOrEmpty(request.CurrentPassphrase) ||
                !BCrypt.Net.BCrypt.Verify(request.CurrentPassphrase, existing.Value))
                return Results.Unauthorized();

            existing.Value = BCrypt.Net.BCrypt.HashPassword(request.NewPassphrase);
        }
        else
        {
            db.AppSettings.Add(new AppSetting
            {
                Key = "passphrase",
                Value = BCrypt.Net.BCrypt.HashPassword(request.NewPassphrase)
            });
        }

        await db.SaveChangesAsync();
        return Results.Ok();
    }

    private static async Task<IResult> RemovePassphrase(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null)
            return Results.Unauthorized();

        var request = await context.Request.ReadFromJsonAsync<RemovePassphraseRequest>();
        if (request is null || string.IsNullOrEmpty(request.CurrentPassphrase))
            return ApiErrors.BadRequest("Current passphrase is required.");

        var existing = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == "passphrase");
        if (existing is null)
            return ApiErrors.BadRequest("No passphrase is set.");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassphrase, existing.Value))
            return Results.Unauthorized();

        var toRemove = await db.AppSettings
            .Where(s => s.Key == "passphrase" || s.Key.StartsWith("session:"))
            .ToListAsync();
        db.AppSettings.RemoveRange(toRemove);
        await db.SaveChangesAsync();

        return Results.Ok();
    }

    private record LoginRequest(string Passphrase);
    private record SetPassphraseRequest(string? CurrentPassphrase, string NewPassphrase);
    private record RemovePassphraseRequest(string CurrentPassphrase);
}
