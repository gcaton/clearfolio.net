using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Endpoints;
using Clearfolio.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

var dbPath = builder.Configuration["DB_PATH"] ?? "clearfolio.db";
builder.Services.AddDbContext<ClearfolioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddHttpClient();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClearfolioDbContext>();
    db.Database.Migrate();
}

app.UseMiddleware<CloudflareJwtMiddleware>();

app.MapReferenceEndpoints();
app.MapHouseholdEndpoints();
app.MapMembersEndpoints();
app.MapAssetsEndpoints();
app.MapLiabilitiesEndpoints();
app.MapSnapshotsEndpoints();
app.MapDashboardEndpoints();
app.MapQuoteEndpoints();
app.MapProjectionEndpoints();

app.Run();
