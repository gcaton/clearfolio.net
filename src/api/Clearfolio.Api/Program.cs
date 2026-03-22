using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using Clearfolio.Api.Data;
using Clearfolio.Api.Endpoints;
using Clearfolio.Api.Middleware;
using Clearfolio.Api.Services;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// #17: Limit request body size to 10 MB to prevent memory exhaustion from large payloads
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
});

var dbPath = builder.Configuration["DB_PATH"] ?? "clearfolio.db";
builder.Services.AddDbContext<ClearfolioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<HistoricalReturnsService>();

// #21: OpenAPI documentation
builder.Services.AddOpenApi();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5),
            }));
    // #4: Rate limit external API proxy endpoints
    options.AddPolicy("external-api", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
            }));
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
        | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClearfolioDbContext>();

    // #7: EnsureCreated creates the schema without migrations history.
    // This is the intended approach for this app — schema evolution is handled
    // via manual ALTER TABLE statements below for backward compatibility.
    db.Database.EnsureCreated();

    // Add locale column to existing databases (EnsureCreated handles new DBs)
    var connection = db.Database.GetDbConnection();
    if (connection.State != System.Data.ConnectionState.Open)
        connection.Open();
    using (var cmd = connection.CreateCommand())
    {
        cmd.CommandText = "PRAGMA table_info(households);";
        using var reader = cmd.ExecuteReader();
        bool hasLocale = false;
        while (reader.Read())
        {
            if (string.Equals(reader["name"] as string, "locale", StringComparison.OrdinalIgnoreCase))
            { hasLocale = true; break; }
        }
        if (!hasLocale)
            db.Database.ExecuteSqlRaw("ALTER TABLE households ADD COLUMN locale TEXT NOT NULL DEFAULT 'en-AU'");
    }

    // #3: Clean up expired sessions on startup
    var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    var expiredSessions = await db.AppSettings
        .Where(s => s.Key.StartsWith("session:"))
        .ToListAsync();
    var toRemove = expiredSessions
        .Where(s => !long.TryParse(s.Value, out var expiry) || now > expiry)
        .ToList();
    if (toRemove.Count > 0)
    {
        db.AppSettings.RemoveRange(toRemove);
        await db.SaveChangesAsync();
        Log.Information("Cleaned up {Count} expired sessions", toRemove.Count);
    }
}

// Passphrase reset escape hatch
if (Environment.GetEnvironmentVariable("CLEARFOLIO_RESET_PASSPHRASE") == "true")
{
    using var resetScope = app.Services.CreateScope();
    var resetDb = resetScope.ServiceProvider.GetRequiredService<ClearfolioDbContext>();
    var toRemove = await resetDb.AppSettings
        .Where(s => s.Key == "passphrase" || s.Key.StartsWith("session:"))
        .ToListAsync();
    if (toRemove.Count > 0)
    {
        resetDb.AppSettings.RemoveRange(toRemove);
        await resetDb.SaveChangesAsync();
    }
}

app.UseExceptionHandler(error => error.Run(async context =>
{
    context.Response.StatusCode = 500;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new { errors = new[] { "An unexpected error occurred." } });
}));

app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (context, _, _) =>
        context.Request.Path.StartsWithSegments("/api/health") ? LogEventLevel.Debug : LogEventLevel.Information;
});

app.UseRateLimiter();
app.UseMiddleware<LocalAuthMiddleware>();

// #21: OpenAPI endpoint
app.MapOpenApi();

app.MapGet("/api/health", async (ClearfolioDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync("SELECT 1");
    return Results.Ok(new { status = "healthy" });
});

app.MapAuthEndpoints();
app.MapReferenceEndpoints();
app.MapHouseholdEndpoints();
app.MapMembersEndpoints();
app.MapAssetsEndpoints();
app.MapLiabilitiesEndpoints();
app.MapSnapshotsEndpoints();
app.MapDashboardEndpoints();
app.MapQuoteEndpoints();
app.MapProjectionEndpoints();
app.MapExpenseCategoriesEndpoints();
app.MapIncomeStreamsEndpoints();
app.MapExpensesEndpoints();
app.MapCashflowEndpoints();

app.Run();
