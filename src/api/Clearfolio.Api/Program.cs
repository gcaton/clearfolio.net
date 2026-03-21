using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Endpoints;
using Clearfolio.Api.Middleware;
using Clearfolio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var dbPath = builder.Configuration["DB_PATH"] ?? "clearfolio.db";
builder.Services.AddDbContext<ClearfolioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<HistoricalReturnsService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClearfolioDbContext>();
    db.Database.Migrate();
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

app.UseMiddleware<LocalAuthMiddleware>();

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
