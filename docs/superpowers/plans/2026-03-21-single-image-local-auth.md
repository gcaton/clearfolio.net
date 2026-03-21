# Single Docker Image + Local Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Clearfolio into a single Docker image with no-auth-by-default and optional passphrase protection, replacing the two-image Cloudflare Access setup.

**Architecture:** Single container runs nginx (static files + reverse proxy) and the .NET API. Auth moves from Cloudflare JWT to a local passphrase-optional model with cookie sessions. First-run setup wizard collects household config. All existing migrations are deleted and regenerated fresh.

**Tech Stack:** .NET 10 (ASP.NET Core minimal APIs, EF Core, SQLite, BCrypt.Net-Next), Angular 21 (PrimeNG, signals), nginx, Docker multi-stage build

**Spec:** `docs/superpowers/specs/2026-03-21-single-image-local-auth-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `Dockerfile` (repo root) | Three-stage build: Angular → .NET → runtime with nginx |
| `docker-entrypoint.sh` (repo root) | Starts nginx (background) + .NET API (foreground) |
| `src/api/Clearfolio.Api/Models/AppSetting.cs` | Entity for key-value app settings (passphrase, sessions) |
| `src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs` | Passphrase gate + member resolution |
| `src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs` | `/api/auth/*` endpoints (status, login, logout, passphrase) |
| `src/app/src/app/features/login/login.component.ts` | Passphrase login page |
| `src/app/src/app/features/login/login.component.html` | Login template |

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/Dockerfile` | Replaced by root Dockerfile |
| `src/api/Dockerfile` | Replaced by root Dockerfile |
| `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs` | Replaced by LocalAuthMiddleware |
| `src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs` | Replaced by `/api/auth/status` response |
| `src/api/Clearfolio.Api/Migrations/*` | All migrations deleted, regenerated fresh |

### Modified Files

| File | Changes |
|------|---------|
| `src/api/Clearfolio.Api/Clearfolio.Api.csproj` | Remove JWT packages, add BCrypt.Net-Next |
| `src/api/Clearfolio.Api/Program.cs` | Swap middleware, register auth endpoints, passphrase reset logic |
| `src/api/Clearfolio.Api/Models/HouseholdMember.cs` | `Email` → `string?` |
| `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs` | Add `AppSettings` DbSet, remove Email unique index + IsRequired |
| `src/api/Clearfolio.Api/DTOs/SetupRequest.cs` | Add HouseholdName, Currency, PeriodType fields |
| `src/api/Clearfolio.Api/DTOs/MemberDto.cs` | Email nullable, CreateMemberRequest email optional |
| `src/api/Clearfolio.Api/DTOs/ExportDto.cs` | ExportMemberDto Email nullable |
| `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs` | Remove email-based identity, expand setup |
| `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs` | Import handler null-coalesce email |
| `src/api/Clearfolio.Api/appsettings.json` | Remove Cloudflare section |
| `src/api/Clearfolio.Api/appsettings.Development.json` | Remove DevAuth section |
| `src/app/src/app/core/auth/auth.service.ts` | Rewrite signals for new auth model |
| `src/app/src/app/core/auth/setup.guard.ts` | Add requireAuthenticated guard |
| `src/app/src/app/core/api/api.service.ts` | Add auth API methods, make createMember email optional |
| `src/app/src/app/core/api/models.ts` | `Member.email` → `string \| null` |
| `src/app/src/app/app.routes.ts` | Add /login route |
| `src/app/src/app/app.ts` | Update @if blocks for passphrase state |
| `src/app/src/app/features/setup/setup.component.ts` | New signals for expanded form |
| `src/app/src/app/features/setup/setup.component.html` | Remove email, add household fields |
| `src/app/src/app/features/settings/settings.component.ts` | Add passphrase management methods |
| `src/app/src/app/features/settings/settings.component.html` | Email optional in add-member, passphrase UI |
| `src/app/nginx.conf` | proxy_pass → 127.0.0.1:8080 |
| `src/app/proxy.conf.json` | Proxy target → localhost:4200 |
| `.github/workflows/build.yml` | Single build job, multi-arch |
| `.docker/docker-compose.yml` | Single service |
| `.docker/docker-compose.prod.yml` | Single service, remove CF vars |
| `README.md` | Rewrite for self-hosted single-image |

---

## Task 1: API — AppSetting Model + DB Changes

**Files:**
- Create: `src/api/Clearfolio.Api/Models/AppSetting.cs`
- Modify: `src/api/Clearfolio.Api/Models/HouseholdMember.cs`
- Modify: `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs`

- [ ] **Step 1: Create AppSetting entity**

Create `src/api/Clearfolio.Api/Models/AppSetting.cs`:

```csharp
namespace Clearfolio.Api.Models;

public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Make HouseholdMember.Email nullable**

In `src/api/Clearfolio.Api/Models/HouseholdMember.cs`, change:

```csharp
public string Email { get; set; } = string.Empty;
```

to:

```csharp
public string? Email { get; set; }
```

- [ ] **Step 3: Update ClearfolioDbContext**

In `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs`:

Add DbSet:

```csharp
public DbSet<AppSetting> AppSettings { get; set; }
```

Add AppSettings configuration inside `OnModelCreating`:

```csharp
modelBuilder.Entity<AppSetting>(entity =>
{
    entity.ToTable("app_settings");
    entity.HasKey(e => e.Key);
    entity.Property(e => e.Key).HasColumnName("key");
    entity.Property(e => e.Value).HasColumnName("value");
});
```

Update HouseholdMember configuration — remove these two lines (around lines 40 and 46):

```csharp
entity.Property(m => m.Email).HasColumnName("email").IsRequired();
```

Replace with:

```csharp
entity.Property(m => m.Email).HasColumnName("email");
```

And remove the unique index line:

```csharp
entity.HasIndex(m => m.Email).IsUnique();
```

- [ ] **Step 4: Delete all existing migrations and regenerate**

```bash
rm -rf src/api/Clearfolio.Api/Migrations
cd src/api && dotnet ef migrations add InitialCreate --project Clearfolio.Api
```

Verify the generated migration includes the `app_settings` table and that `email` on `household_members` has no unique index and is nullable.

- [ ] **Step 5: Commit**

```bash
git add -A src/api/Clearfolio.Api/Models/AppSetting.cs src/api/Clearfolio.Api/Models/HouseholdMember.cs src/api/Clearfolio.Api/Data/ src/api/Clearfolio.Api/Migrations/
git commit -m "feat: add AppSetting model, make Email nullable, regenerate migrations"
```

---

## Task 2: API — Remove Cloudflare Auth, Add NuGet Packages

**Files:**
- Delete: `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs`
- Delete: `src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs`
- Modify: `src/api/Clearfolio.Api/Clearfolio.Api.csproj`
- Modify: `src/api/Clearfolio.Api/appsettings.json`
- Modify: `src/api/Clearfolio.Api/appsettings.Development.json`

- [ ] **Step 1: Remove Cloudflare JWT NuGet packages, add BCrypt**

In `src/api/Clearfolio.Api/Clearfolio.Api.csproj`, remove these `<PackageReference>` lines:

```xml
<PackageReference Include="Microsoft.IdentityModel.Protocols.OpenIdConnect" Version="8.16.0" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.16.0" />
```

Add:

```xml
<PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
```

Then restore:

```bash
cd src/api && dotnet restore Clearfolio.Api/Clearfolio.Api.csproj
```

- [ ] **Step 2: Delete CloudflareJwtMiddleware.cs**

```bash
rm src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs
```

- [ ] **Step 3: Delete SetupStatusDto.cs**

```bash
rm src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs
```

- [ ] **Step 4: Clean up appsettings.json**

Replace the entire contents of `src/api/Clearfolio.Api/appsettings.json` with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

- [ ] **Step 5: Clean up appsettings.Development.json**

Replace the entire contents of `src/api/Clearfolio.Api/appsettings.Development.json` with:

```json
{
  "DB_PATH": "clearfolio.dev.db"
}
```

- [ ] **Step 6: Verify build**

```bash
cd src/api && dotnet build Clearfolio.Api/Clearfolio.Api.csproj
```

Expected: Build errors for missing `CloudflareJwtMiddleware` reference in `Program.cs` and missing `SetupStatusDto` in `MembersEndpoints.cs`. These are fixed in the next tasks.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove Cloudflare auth dependencies, add BCrypt"
```

---

## Task 3: API — LocalAuthMiddleware

**Files:**
- Create: `src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs`
- Modify: `src/api/Clearfolio.Api/Program.cs`

- [ ] **Step 1: Create LocalAuthMiddleware**

Create `src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs`:

```csharp
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
```

- [ ] **Step 2: Update Program.cs — swap middleware and add passphrase reset**

In `src/api/Clearfolio.Api/Program.cs`:

Replace the `using` for the old middleware namespace if present. Then replace:

```csharp
app.UseMiddleware<CloudflareJwtMiddleware>();
```

with:

```csharp
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
```

Add `using Microsoft.EntityFrameworkCore;` at the top if not already present.

- [ ] **Step 3: Verify build compiles**

```bash
cd src/api && dotnet build Clearfolio.Api/Clearfolio.Api.csproj
```

Expected: May still have errors in MembersEndpoints.cs (SetupStatusDto removed). That's fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs src/api/Clearfolio.Api/Program.cs
git commit -m "feat: add LocalAuthMiddleware with passphrase gate and session validation"
```

---

## Task 4: API — Auth Endpoints

**Files:**
- Create: `src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Program.cs`

- [ ] **Step 1: Create AuthEndpoints**

Create `src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapGet("/status", GetStatus);
        group.MapPost("/login", Login);
        group.MapPost("/logout", Logout);
        group.MapPut("/passphrase", SetPassphrase);
        group.MapDelete("/passphrase", RemovePassphrase);
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
            return Results.BadRequest("Passphrase is required.");

        var passphraseSetting = await db.AppSettings
            .FirstOrDefaultAsync(s => s.Key == "passphrase");

        if (passphraseSetting is null)
            return Results.BadRequest("No passphrase is set.");

        if (!BCrypt.Net.BCrypt.Verify(request.Passphrase, passphraseSetting.Value))
            return Results.Unauthorized();

        var sessionDays = int.TryParse(
            Environment.GetEnvironmentVariable("CLEARFOLIO_SESSION_DAYS"), out var days)
            ? days : 30;

        var token = Guid.NewGuid().ToString("N");
        var expiry = DateTimeOffset.UtcNow.AddDays(sessionDays).ToUnixTimeSeconds();

        db.AppSettings.Add(new AppSetting
        {
            Key = $"session:{token}",
            Value = expiry.ToString()
        });
        await db.SaveChangesAsync();

        context.Response.Cookies.Append("clearfolio_session", token, new CookieOptions
        {
            HttpOnly = true,
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
        var member = context.Items["HouseholdMember"] as HouseholdMember;
        if (member is null)
            return Results.Unauthorized();

        var request = await context.Request.ReadFromJsonAsync<SetPassphraseRequest>();
        if (request is null || string.IsNullOrEmpty(request.NewPassphrase))
            return Results.BadRequest("New passphrase is required.");

        var existing = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == "passphrase");

        if (existing is not null)
        {
            // Updating — require current passphrase
            if (string.IsNullOrEmpty(request.CurrentPassphrase) ||
                !BCrypt.Net.BCrypt.Verify(request.CurrentPassphrase, existing.Value))
                return Results.Unauthorized();

            existing.Value = BCrypt.Net.BCrypt.HashPassword(request.NewPassphrase);
        }
        else
        {
            // Setting for the first time
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
        var member = context.Items["HouseholdMember"] as HouseholdMember;
        if (member is null)
            return Results.Unauthorized();

        var request = await context.Request.ReadFromJsonAsync<RemovePassphraseRequest>();
        if (request is null || string.IsNullOrEmpty(request.CurrentPassphrase))
            return Results.BadRequest("Current passphrase is required.");

        var existing = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == "passphrase");
        if (existing is null)
            return Results.BadRequest("No passphrase is set.");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassphrase, existing.Value))
            return Results.Unauthorized();

        // Remove passphrase and all sessions
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
```

- [ ] **Step 2: Register auth endpoints in Program.cs**

In `src/api/Clearfolio.Api/Program.cs`, add before the other `Map*Endpoints()` calls:

```csharp
app.MapAuthEndpoints();
```

- [ ] **Step 3: Verify build**

```bash
cd src/api && dotnet build Clearfolio.Api/Clearfolio.Api.csproj
```

- [ ] **Step 4: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs src/api/Clearfolio.Api/Program.cs
git commit -m "feat: add auth endpoints (status, login, logout, passphrase management)"
```

---

## Task 5: API — Update DTOs and Member Endpoints

**Files:**
- Modify: `src/api/Clearfolio.Api/DTOs/SetupRequest.cs`
- Modify: `src/api/Clearfolio.Api/DTOs/MemberDto.cs`
- Modify: `src/api/Clearfolio.Api/DTOs/ExportDto.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`

- [ ] **Step 1: Update SetupRequest**

Replace `src/api/Clearfolio.Api/DTOs/SetupRequest.cs`:

```csharp
namespace Clearfolio.Api.DTOs;

public record SetupRequest(
    string DisplayName,
    string? HouseholdName,
    string? Currency,
    string? PeriodType);
```

- [ ] **Step 2: Update MemberDto.cs**

In `src/api/Clearfolio.Api/DTOs/MemberDto.cs`:

Change `MemberDto` Email to nullable:

```csharp
public record MemberDto(
    Guid Id,
    string? Email,
    string DisplayName,
    string MemberTag,
    bool IsPrimary,
    string CreatedAt);
```

Change `CreateMemberRequest` Email to nullable:

```csharp
public record CreateMemberRequest(string? Email, string DisplayName);
```

- [ ] **Step 3: Update ExportDto.cs**

In `src/api/Clearfolio.Api/DTOs/ExportDto.cs`, change `ExportMemberDto`:

```csharp
public record ExportMemberDto(string? Email, string DisplayName, string MemberTag, bool IsPrimary);
```

- [ ] **Step 4: Rewrite MembersEndpoints.cs**

This is the largest change. Key modifications to `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs`:

**`GetCurrentMember`** — replace email-based lookup with primary member lookup:

```csharp
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
```

**`SetupMember`** — remove email-based identity, use expanded request:

```csharp
private static async Task<IResult> SetupMember(HttpContext context, SetupRequest request, ClearfolioDbContext db)
{
    if (string.IsNullOrWhiteSpace(request.DisplayName))
        return Results.BadRequest("Display name is required.");

    // Check if already set up
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
        CreatedAt = DateTime.UtcNow.ToString("o")
    };
    db.HouseholdMembers.Add(member);

    // Seed default expense categories
    var defaultCategories = new[]
    {
        "Housing", "Utilities", "Groceries", "Transport", "Insurance",
        "Healthcare", "Education", "Entertainment", "Dining Out",
        "Clothing", "Personal Care", "Subscriptions", "Other"
    };

    for (var i = 0; i < defaultCategories.Length; i++)
    {
        db.ExpenseCategories.Add(new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            HouseholdId = household.Id,
            Name = defaultCategories[i],
            SortOrder = i,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow.ToString("o")
        });
    }

    await db.SaveChangesAsync();

    return Results.Ok(new MemberDto(
        member.Id, member.Email, member.DisplayName,
        member.MemberTag, member.IsPrimary, member.CreatedAt));
}
```

Note: Check if the existing `SetupMember` already seeds expense categories (it may use a different approach) — match the existing pattern for category names and seeding. The code above is a guide; adapt to what already exists in the codebase.

**`CreateMember`** — remove email uniqueness check:

Replace the email-based duplicate check with:

```csharp
// Email is optional — no uniqueness enforcement
```

And when creating the member, use `request.Email` which is now nullable.

**`GetMembers` helper** — all `GetMemberOrNull(context)` calls should use the member from `context.Items["HouseholdMember"]` as they already do. No change needed for most endpoints.

- [ ] **Step 5: Update HouseholdEndpoints.cs import handler**

In `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`, in the `ImportData` method, where members are created from export data, null-coalesce email:

Find the line that sets `Email = m.Email` and change to:

```csharp
Email = m.Email ?? string.Empty,
```

Or if Email is now nullable on the model, just leave it as `Email = m.Email`.

- [ ] **Step 6: Verify build**

```bash
cd src/api && dotnet build Clearfolio.Api/Clearfolio.Api.csproj
```

Expected: Clean build with no errors. Fix any remaining `UserEmail` references or `SetupStatusDto` references.

- [ ] **Step 7: Commit**

```bash
git add -A src/api/
git commit -m "feat: update DTOs and member endpoints for local auth model"
```

---

## Task 6: Angular — Auth Service Rewrite

**Files:**
- Modify: `src/app/src/app/core/auth/auth.service.ts`
- Modify: `src/app/src/app/core/api/api.service.ts`
- Modify: `src/app/src/app/core/api/models.ts`

- [ ] **Step 1: Add auth API methods to ApiService**

In `src/app/src/app/core/api/api.service.ts`, add these methods:

```typescript
// Auth
getAuthStatus() { return this.http.get<AuthStatus>('/api/auth/status'); }
login(passphrase: string) { return this.http.post('/api/auth/login', { passphrase }); }
logout() { return this.http.post('/api/auth/logout', {}); }
setPassphrase(currentPassphrase: string | null, newPassphrase: string) {
  return this.http.put('/api/auth/passphrase', { currentPassphrase, newPassphrase });
}
removePassphrase(currentPassphrase: string) {
  return this.http.delete('/api/auth/passphrase', { body: { currentPassphrase } });
}
```

Add the `AuthStatus` interface near the top of the file (or in the existing interfaces/models area):

```typescript
export interface AuthStatus {
  passphraseEnabled: boolean;
  authenticated: boolean;
  setupComplete: boolean;
}
```

Also update `createMember` to make email optional:

```typescript
createMember(displayName: string, email?: string) {
  return this.http.post<Member>('/api/members', { email, displayName });
}
```

- [ ] **Step 2: Update models.ts**

In `src/app/src/app/core/api/models.ts`, find the `Member` interface and change `email` from `string` to `string | null`:

```typescript
email: string | null;
```

- [ ] **Step 3: Rewrite AuthService**

Replace the contents of `src/app/src/app/core/auth/auth.service.ts`. The `Member` interface lives in `models.ts` (already updated in Step 2) — import it, don't redefine:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { Member } from '../api/models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  private readonly _currentMember = signal<Member | null>(null);
  private readonly _members = signal<Member[]>([]);
  private readonly _loading = signal(true);
  private readonly _setupComplete = signal(false);
  private readonly _passphraseEnabled = signal(false);
  private readonly _authenticated = signal(false);

  readonly currentMember = this._currentMember.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly setupComplete = this._setupComplete.asReadonly();
  readonly passphraseEnabled = this._passphraseEnabled.asReadonly();
  readonly authenticated = this._authenticated.asReadonly();
  readonly isAuthenticated = computed(() => this._currentMember() !== null);

  // Legacy compatibility — guards and components may still check this
  readonly needsSetup = computed(() => !this._setupComplete());

  async init() {
    try {
      const status = await firstValueFrom(this.api.getAuthStatus());
      this._setupComplete.set(status.setupComplete);
      this._passphraseEnabled.set(status.passphraseEnabled);
      this._authenticated.set(status.authenticated);

      if (status.setupComplete && status.authenticated) {
        const member = await firstValueFrom(this.api.getCurrentMember());
        this._currentMember.set(member);
        await this.loadMembers();
      }
    } catch {
      // Status endpoint should always succeed; if it fails, leave defaults
    } finally {
      this._loading.set(false);
    }
  }

  async onSetupComplete() {
    this._loading.set(true);
    await this.init();
  }

  async loginComplete() {
    this._loading.set(true);
    this._authenticated.set(true);
    try {
      const member = await firstValueFrom(this.api.getCurrentMember());
      this._currentMember.set(member);
      await this.loadMembers();
    } finally {
      this._loading.set(false);
    }
  }

  async loadMembers() {
    const members = await firstValueFrom(this.api.getMembers());
    this._members.set(members);
  }
}
```

Note: The existing `AuthService` may export the `Member` interface. Check where `Member` is imported from across the app — if other files import it from `auth.service.ts`, keep the export. If there's a separate `models` file, use that.

- [ ] **Step 3: Verify Angular build**

```bash
cd src/app && npx ng build 2>&1 | head -50
```

Expected: Errors in guards, setup component, app.ts from removed signals. Fixed in next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/core/auth/auth.service.ts src/app/src/app/core/api/api.service.ts
git commit -m "feat: rewrite auth service for local auth model"
```

---

## Task 7: Angular — Route Guards + Login Route

**Files:**
- Modify: `src/app/src/app/core/auth/setup.guard.ts`
- Create: `src/app/src/app/features/login/login.component.ts`
- Create: `src/app/src/app/features/login/login.component.html`
- Modify: `src/app/src/app/app.routes.ts`

- [ ] **Step 1: Update setup.guard.ts**

Replace `src/app/src/app/core/auth/setup.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

function waitForAuth(auth: AuthService): Promise<void> {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (!auth.loading()) { clearInterval(interval); resolve(); }
    }, 50);
  });
}

export const requireSetupComplete: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (!auth.setupComplete()) {
    return router.createUrlTree(['/setup']);
  }
  return true;
};

export const requireSetupNeeded: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (auth.setupComplete()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

export const requireAuthenticated: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (auth.passphraseEnabled() && !auth.authenticated()) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
```

- [ ] **Step 2: Create login component**

Create `src/app/src/app/features/login/login.component.ts`:

```typescript
import { Component, inject, signal, model } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { Password } from 'primeng/password';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, InputText, Button, Password],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  passphrase = model('');
  submitting = signal(false);
  error = signal<string | null>(null);

  async submit() {
    if (!this.passphrase() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    try {
      await this.api.login(this.passphrase()).toPromise();
      await this.auth.loginComplete();
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Incorrect passphrase.');
    } finally {
      this.submitting.set(false);
    }
  }
}
```

Create `src/app/src/app/features/login/login.component.html`:

```html
<div class="flex align-items-center justify-content-center" style="min-height: 80vh">
  <div class="surface-card p-5 border-round-xl shadow-2" style="width: 100%; max-width: 400px">
    <div class="text-center mb-4">
      <h1 class="text-2xl font-bold m-0">Clearfolio</h1>
      <p class="text-color-secondary mt-2">Enter your passphrase to continue</p>
    </div>

    <div class="flex flex-column gap-3">
      <div class="flex flex-column gap-2">
        <label for="passphrase">Passphrase</label>
        <p-password
          id="passphrase"
          [(ngModel)]="passphrase"
          [feedback]="false"
          [toggleMask]="true"
          (keydown.enter)="submit()"
          styleClass="w-full"
          [inputStyleClass]="'w-full'"
          placeholder="Enter passphrase" />
      </div>

      @if (error()) {
        <small class="text-red-500">{{ error() }}</small>
      }

      <p-button
        label="Unlock"
        (onClick)="submit()"
        [disabled]="!passphrase() || submitting()"
        [loading]="submitting()"
        styleClass="w-full" />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Update app.routes.ts**

In `src/app/src/app/app.routes.ts`:

Add import for the new guard:

```typescript
import { requireSetupComplete, requireSetupNeeded, requireAuthenticated } from './core/auth/setup.guard';
```

Add the login route after the setup route:

```typescript
{
  path: 'login',
  loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  canActivate: [requireSetupComplete]
},
```

Add `requireAuthenticated` to all protected routes. For each route that currently has `canActivate: [requireSetupComplete]`, change to:

```typescript
canActivate: [requireSetupComplete, requireAuthenticated]
```

This applies to: dashboard, assets, liabilities, cashflow, snapshots, projections, settings, help.

- [ ] **Step 4: Verify Angular build**

```bash
cd src/app && npx ng build 2>&1 | head -50
```

Expected: May still have errors in setup component and app.ts. Fixed in next tasks.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/core/auth/setup.guard.ts src/app/src/app/features/login/ src/app/src/app/app.routes.ts
git commit -m "feat: add login component, requireAuthenticated guard, login route"
```

---

## Task 8: Angular — Update Setup Component

**Files:**
- Modify: `src/app/src/app/features/setup/setup.component.ts`
- Modify: `src/app/src/app/features/setup/setup.component.html`

- [ ] **Step 1: Update setup.component.ts**

Rewrite the signals and submit method. Remove `email` signal (was from `auth.setupEmail`). Add new form signals:

```typescript
displayName = model('');
householdName = model('My Household');
currency = model('AUD');
periodType = model('FY');
saving = signal(false);
```

Update `submit()` to pass the expanded request:

```typescript
async submit() {
  if (!this.displayName() || this.saving()) return;
  this.saving.set(true);
  try {
    await this.api.setup(
      this.displayName(),
      this.householdName(),
      this.currency(),
      this.periodType()
    ).toPromise();
    await this.auth.onSetupComplete();
    this.router.navigate(['/dashboard']);
  } finally {
    this.saving.set(false);
  }
}
```

Also update the `setup()` method in `api.service.ts` to accept the new parameters:

```typescript
setup(displayName: string, householdName?: string, currency?: string, periodType?: string) {
  return this.http.post<Member>('/api/members/setup', { displayName, householdName, currency, periodType });
}
```

- [ ] **Step 2: Update setup.component.html**

Remove the readonly email input. Add household name, currency, and period type fields. The form should have:

- Household name input (default "My Household")
- Display name input (required)
- Currency dropdown (AUD, USD, GBP, EUR, NZD, CAD)
- Period type toggle (FY / CY)
- Submit button

Refer to the existing settings component for the currency dropdown and period type toggle patterns — reuse the same options.

- [ ] **Step 3: Verify Angular build**

```bash
cd src/app && npx ng build 2>&1 | head -50
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/features/setup/ src/app/src/app/core/api/api.service.ts
git commit -m "feat: expand setup wizard with household name, currency, period type"
```

---

## Task 9: Angular — Update App Shell + Settings

**Files:**
- Modify: `src/app/src/app/app.ts`
- Modify: `src/app/src/app/features/settings/settings.component.ts`
- Modify: `src/app/src/app/features/settings/settings.component.html`

- [ ] **Step 1: Update app.ts**

In the template, the `@if (!auth.needsSetup())` blocks that gate the nav bar and footer need to also hide when on the login page. Change to:

```typescript
@if (auth.setupComplete() && auth.authenticated())
```

This replaces `@if (!auth.needsSetup())` — find both instances in the template (nav bar and footer).

- [ ] **Step 2: Update settings — make email optional in add-member dialog**

In `src/app/src/app/features/settings/settings.component.html`, find the Add Member dialog. The `newMemberEmail` field should no longer be required. Change the disabled condition on the Add button from:

```html
[disabled]="!newMemberEmail || !newMemberName"
```

to:

```html
[disabled]="!newMemberName"
```

Make the email input label say "Email (optional)" and remove any `required` attribute.

- [ ] **Step 3: Add passphrase management to settings**

In `src/app/src/app/features/settings/settings.component.ts`, add signals and methods:

```typescript
passphraseEnabled = signal(false);
showPassphraseDialog = signal(false);
currentPassphrase = model('');
newPassphrase = model('');
confirmPassphrase = model('');

// Load passphrase status in ngOnInit:
// this.api.getAuthStatus().subscribe(s => this.passphraseEnabled.set(s.passphraseEnabled));

async savePassphrase() {
  if (this.newPassphrase() !== this.confirmPassphrase()) return;
  await this.api.setPassphrase(
    this.passphraseEnabled() ? this.currentPassphrase() : null,
    this.newPassphrase()
  ).toPromise();
  this.passphraseEnabled.set(true);
  this.showPassphraseDialog.set(false);
  this.currentPassphrase.set('');
  this.newPassphrase.set('');
  this.confirmPassphrase.set('');
}

async removePassphrase() {
  await this.api.removePassphrase(this.currentPassphrase()).toPromise();
  this.passphraseEnabled.set(false);
  this.showPassphraseDialog.set(false);
  this.currentPassphrase.set('');
}
```

In `settings.component.html`, add a "Security" section (can be a new tab or section in the Household tab):

- Toggle or button showing passphrase status
- "Set Passphrase" / "Change Passphrase" / "Remove Passphrase" actions
- Dialog for entering current + new + confirm passphrase

- [ ] **Step 4: Verify Angular build**

```bash
cd src/app && npx ng build 2>&1 | head -50
```

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/app.ts src/app/src/app/features/settings/
git commit -m "feat: update app shell auth gating, add passphrase management to settings"
```

---

## Task 10: Single Dockerfile + Entrypoint

**Files:**
- Create: `Dockerfile` (repo root)
- Create: `docker-entrypoint.sh` (repo root)
- Modify: `src/app/nginx.conf`
- Delete: `src/app/Dockerfile`
- Delete: `src/api/Dockerfile`

- [ ] **Step 1: Update nginx.conf**

In `src/app/nginx.conf`, change the proxy_pass target:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

- [ ] **Step 2: Create docker-entrypoint.sh**

Create `docker-entrypoint.sh` at repo root:

```bash
#!/bin/sh
set -e

# Start nginx in background
nginx -g 'daemon off;' &

# Run .NET API in foreground
cd /app
exec dotnet Clearfolio.Api.dll
```

- [ ] **Step 3: Create root Dockerfile**

Create `Dockerfile` at repo root:

```dockerfile
# Stage 1: Build Angular
FROM node:24-alpine AS frontend-build
WORKDIR /app
ARG APP_VERSION=dev

COPY src/app/package.json src/app/package-lock.json ./
RUN npm ci

COPY src/app/ .
RUN sed -i "s/version: 'dev'/version: '${APP_VERSION}'/" src/environments/environment.ts
RUN npx ng build --configuration production

# Stage 2: Build .NET API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src

COPY src/api/Clearfolio.Api/Clearfolio.Api.csproj Clearfolio.Api/
RUN dotnet restore Clearfolio.Api/Clearfolio.Api.csproj

COPY src/api/ .
RUN dotnet publish Clearfolio.Api/Clearfolio.Api.csproj -c Release -o /app/publish

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0

# Install nginx
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*

# Copy Angular build
COPY --from=frontend-build /app/dist/app/browser /usr/share/nginx/html

# Copy nginx config
COPY src/app/nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx site if it exists
RUN rm -f /etc/nginx/sites-enabled/default

# Copy .NET API
WORKDIR /app
COPY --from=api-build /app/publish .

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV DB_PATH=/data/clearfolio.db
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 80
VOLUME /data

ENTRYPOINT ["/docker-entrypoint.sh"]
```

- [ ] **Step 4: Delete old Dockerfiles**

```bash
rm src/app/Dockerfile
rm src/api/Dockerfile
```

- [ ] **Step 5: Test Docker build locally**

```bash
docker build -t clearfolio:test .
```

- [ ] **Step 6: Test Docker run**

```bash
docker run --rm -p 8080:80 -v clearfolio-test:/data clearfolio:test
```

Open `http://localhost:8080` — should see the setup wizard.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-entrypoint.sh src/app/nginx.conf
git rm src/app/Dockerfile src/api/Dockerfile
git commit -m "feat: single Docker image with nginx + .NET API"
```

---

## Task 11: Update Docker Compose + Proxy + Justfile

**Files:**
- Modify: `.docker/docker-compose.yml`
- Modify: `.docker/docker-compose.prod.yml`
- Modify: `src/app/proxy.conf.json`
- Modify: `Justfile`

- [ ] **Step 1: Update dev docker-compose.yml**

Replace `.docker/docker-compose.yml`:

```yaml
services:
  clearfolio:
    build:
      context: ..
      dockerfile: Dockerfile
    ports:
      - "4200:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - DB_PATH=/data/clearfolio.db
    volumes:
      - clearfolio-data:/data

volumes:
  clearfolio-data:
```

- [ ] **Step 2: Update prod docker-compose.yml**

Replace `.docker/docker-compose.prod.yml`:

```yaml
services:
  clearfolio:
    image: ghcr.io/${GITHUB_OWNER}/clearfolio:latest
    restart: unless-stopped
    ports:
      - "${BIND_ADDRESS:-0.0.0.0}:4200:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT:-Production}
      - DB_PATH=/data/clearfolio.db
    volumes:
      - /var/data/clearfolio:/data
```

- [ ] **Step 3: Update proxy.conf.json**

In `src/app/proxy.conf.json`, update the proxy target. The dev Angular server should proxy to the single container's nginx port:

```json
{
  "/api": {
    "target": "http://localhost:4200",
    "secure": false
  }
}
```

- [ ] **Step 4: Update Justfile if needed**

Check if any Justfile commands reference the old service names (`api`, `app`). Update to use `clearfolio` if so. The compose file variable references should still work since they point to the same files.

- [ ] **Step 5: Commit**

```bash
git add .docker/ src/app/proxy.conf.json Justfile
git commit -m "feat: update compose files for single service, fix proxy config"
```

---

## Task 12: Update CI Pipeline

**Files:**
- Modify: `.github/workflows/build.yml`

- [ ] **Step 1: Rewrite build.yml**

Replace `.github/workflows/build.yml`:

```yaml
name: Build and Push

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io

jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      calver: ${{ steps.calver.outputs.version }}
    steps:
      - id: calver
        run: echo "version=$(date -u +'%Y.%m.%d').${{ github.run_number }}" >> "$GITHUB_OUTPUT"

  build:
    needs: version
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    env:
      IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/clearfolio
      VERSION: ${{ needs.version.outputs.calver }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          build-args: |
            APP_VERSION=${{ env.VERSION }}
          tags: |
            ${{ env.IMAGE_NAME }}:latest
            ${{ env.IMAGE_NAME }}:${{ env.VERSION }}
          cache-from: |
            type=gha,scope=linux-amd64
            type=gha,scope=linux-arm64
          cache-to: |
            type=gha,mode=max,scope=linux-amd64
            type=gha,mode=max,scope=linux-arm64

      - uses: actions/delete-package-versions@v5
        with:
          package-name: clearfolio
          package-type: container
          min-versions-to-keep: 5
          delete-only-untagged-versions: false
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "feat: single-image multi-arch CI pipeline"
```

---

## Task 13: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README.md**

Major changes:
- Add Quick Start at top: `docker run -d -p 8080:80 -v clearfolio-data:/data ghcr.io/gcaton/clearfolio`
- Remove Cloudflare Setup section entirely
- Remove Litestream section (personal infra)
- Simplify Raspberry Pi Setup to: install Docker, docker run, open browser
- Update project structure (single Dockerfile, no separate Dockerfiles)
- Update Tech Stack table (remove Auth row referencing Cloudflare Access, remove Cloudflare Tunnel)
- Document optional passphrase and `CLEARFOLIO_RESET_PASSPHRASE=true` escape hatch
- Update available commands (same Justfile commands)

- [ ] **Step 2: Update claude.md if it references Cloudflare auth**

Check `claude.md` for any references to Cloudflare, CF_TEAM_NAME, CF_ACCESS_AUD, or the old two-image setup. Update accordingly.

- [ ] **Step 3: Commit**

```bash
git add README.md claude.md
git commit -m "docs: rewrite README for self-hosted single-image setup"
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Clean build**

```bash
docker build --no-cache -t clearfolio:test .
```

- [ ] **Step 2: Run fresh**

```bash
docker run --rm -p 8080:80 -v clearfolio-e2e:/data clearfolio:test
```

- [ ] **Step 3: Test setup wizard**

Open `http://localhost:8080`. Verify:
- Redirected to `/setup`
- Form shows: household name, display name, currency, period type
- Submit creates household and redirects to dashboard

- [ ] **Step 4: Test core functionality**

- Add a member in settings (email should be optional)
- Create an asset and liability
- Take a snapshot
- Check dashboard loads with data
- Export data, delete all, import data back

- [ ] **Step 5: Test passphrase flow**

- Go to settings, set a passphrase
- Open incognito window → should see login page
- Enter passphrase → should get to dashboard
- Remove passphrase in settings → incognito should go straight to dashboard

- [ ] **Step 6: Test passphrase reset escape hatch**

```bash
docker run --rm -p 8080:80 -v clearfolio-e2e:/data -e CLEARFOLIO_RESET_PASSPHRASE=true clearfolio:test
```

Verify passphrase is cleared.

- [ ] **Step 7: Clean up test volume**

```bash
docker volume rm clearfolio-e2e
```
