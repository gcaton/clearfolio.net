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

var dbPath = builder.Configuration["DB_PATH"] ?? "clearfolio.db";
builder.Services.AddDbContext<ClearfolioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<HistoricalReturnsService>();

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
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
        | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClearfolioDbContext>();
    db.Database.EnsureCreated();

    // Add locale column to existing databases (EnsureCreated handles new DBs)
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE households ADD COLUMN locale TEXT NOT NULL DEFAULT 'en-AU'");
    }
    catch { /* Column already exists */ }

    // Apply any pending migrations (backs up DB first)
    if (db.Database.GetPendingMigrations().Any())
    {
        if (File.Exists(dbPath))
        {
            var backupPath = $"{dbPath}.{DateTime.UtcNow:yyyyMMddHHmmss}.pre-migration-backup";
            File.Copy(dbPath, backupPath, overwrite: true);
            Log.Information("Pending migrations detected — backed up database to {BackupPath}", backupPath);
        }

        db.Database.Migrate();
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
