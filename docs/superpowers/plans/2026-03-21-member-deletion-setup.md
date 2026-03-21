# Member Deletion & First-Time Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add member deletion with cascading data purge, a nuclear household reset, and a first-time setup flow for new users.

**Architecture:** Backend adds three new endpoints (setup, delete member, delete household) and modifies the middleware to stop auto-provisioning. Frontend adds a `/setup` route with a guard, a setup component, and delete controls in settings.

**Tech Stack:** .NET minimal API, EF Core (SQLite), Angular 19, PrimeNG

**Spec:** `docs/superpowers/specs/2026-03-21-member-deletion-setup-design.md`

---

## File Map

### API (Create)
- `src/api/Clearfolio.Api/DTOs/SetupRequest.cs` — Request DTO for setup endpoint
- `src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs` — Response DTO for needsSetup state

### API (Modify)
- `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs` — Stop auto-provisioning, allow null member through
- `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs` — Add setup, delete member, modify /me
- `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs` — Add delete household

### Frontend (Create)
- `src/app/src/app/core/auth/setup.guard.ts` — Route guard redirecting to /setup
- `src/app/src/app/features/setup/setup.component.ts` — First-time setup page
- `src/app/src/app/features/setup/setup.component.html` — Setup template
- `src/app/src/app/features/setup/setup.component.scss` — Setup styles

### Frontend (Modify)
- `src/app/src/app/core/api/api.service.ts` — Add setup, deleteMember, deleteAllData methods
- `src/app/src/app/core/auth/auth.service.ts` — Handle needsSetup state, expose signals
- `src/app/src/app/app.routes.ts` — Add /setup route, attach guards
- `src/app/src/app/app.ts` — Conditionally hide nav when needsSetup
- `src/app/src/app/features/settings/settings.component.ts` — Add delete member + danger zone logic
- `src/app/src/app/features/settings/settings.component.html` — Add delete buttons + danger zone UI
- `src/app/src/app/features/settings/settings.component.scss` — Danger zone styles

---

### Task 1: API — Setup and Member Status DTOs

**Files:**
- Create: `src/api/Clearfolio.Api/DTOs/SetupRequest.cs`
- Create: `src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs`

- [ ] **Step 1: Create SetupRequest DTO**

```csharp
// src/api/Clearfolio.Api/DTOs/SetupRequest.cs
namespace Clearfolio.Api.DTOs;

public record SetupRequest(string DisplayName);
```

- [ ] **Step 2: Create SetupStatusDto**

```csharp
// src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs
namespace Clearfolio.Api.DTOs;

public record SetupStatusDto(bool NeedsSetup, string Email);
```

- [ ] **Step 3: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add src/api/Clearfolio.Api/DTOs/SetupRequest.cs src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs
git commit -m "feat(api): add DTOs for setup flow"
```

---

### Task 2: API — Modify Middleware to Stop Auto-Provisioning

**Files:**
- Modify: `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs`

The middleware currently auto-creates a member if none exists for the JWT email. Change it to:
1. If no member exists, set `context.Items["HouseholdMember"]` to `null` and `context.Items["UserEmail"]` to the email
2. Allow the request through — endpoints decide what to do with a null member

- [ ] **Step 1: Modify InvokeAsync to stop auto-provisioning**

In `CloudflareJwtMiddleware.cs`, replace the `InvokeAsync` method body (lines 27-48). Remove the `AutoProvision` call and the `AutoProvision` method entirely.

```csharp
public async Task InvokeAsync(HttpContext context, ClearfolioDbContext db)
{
    var email = await ResolveEmail(context);
    if (email is null)
    {
        context.Response.StatusCode = 401;
        return;
    }

    var member = await db.HouseholdMembers
        .Include(m => m.Household)
        .FirstOrDefaultAsync(m => m.Email == email);

    context.Items["UserEmail"] = email;
    context.Items["HouseholdMember"] = member; // may be null

    await _next(context);
}
```

Delete the entire `AutoProvision` method (lines 140-174).

- [ ] **Step 2: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```bash
git add src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs
git commit -m "feat(api): stop auto-provisioning members in middleware"
```

---

### Task 3: API — Add Setup Endpoint and Modify /me

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs`

- [ ] **Step 1: Add the setup endpoint and modify GetCurrentMember**

In `MembersEndpoints.cs`:

1. Add route mapping in `MapMembersEndpoints`:
```csharp
app.MapPost("/api/members/setup", SetupMember);
```

2. Modify `GetCurrentMember` to handle null member — return 404 with `SetupStatusDto`:
```csharp
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
```

3. Add the `SetupMember` handler:
```csharp
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
```

4. Update `GetMember` helper and all existing callers to handle null member with a 401 check. Change the helper:
```csharp
private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
    context.Items["HouseholdMember"] as HouseholdMember;
```

5. Update `GetMembers`, `CreateMember`, `UpdateMember` to use the null-check pattern:
```csharp
var member = GetMemberOrNull(context);
if (member is null) return Results.Unauthorized();
```

Add `using Clearfolio.Api.DTOs;` at the top if not already present (it is — `SetupRequest` and `SetupStatusDto` are in the same namespace).

- [ ] **Step 2: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs
git commit -m "feat(api): add setup endpoint and handle needsSetup in /me"
```

---

### Task 4: API — Add Delete Member Endpoint

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs`

- [ ] **Step 1: Add route mapping**

In `MapMembersEndpoints`, add:
```csharp
app.MapDelete("/api/members/{id:guid}", DeleteMember);
```

- [ ] **Step 2: Add DeleteMember handler**

```csharp
private static async Task<IResult> DeleteMember(Guid id, HttpContext context, ClearfolioDbContext db)
{
    var caller = GetMemberOrNull(context);
    if (caller is null) return Results.Unauthorized();
    if (!caller.IsPrimary) return Results.Forbid();

    var target = await db.HouseholdMembers.FirstOrDefaultAsync(m => m.Id == id && m.HouseholdId == caller.HouseholdId);
    if (target is null) return Results.NotFound();
    if (target.IsPrimary) return Results.BadRequest("Cannot delete the primary member. Use DELETE /api/household to reset all data.");

    await using var transaction = await db.Database.BeginTransactionAsync();

    var assetIds = await db.Assets
        .Where(a => a.OwnerMemberId == id)
        .Select(a => a.Id)
        .ToListAsync();

    var liabilityIds = await db.Liabilities
        .Where(l => l.OwnerMemberId == id)
        .Select(l => l.Id)
        .ToListAsync();

    var entityIds = assetIds.Concat(liabilityIds).ToList();

    if (entityIds.Count > 0)
        await db.Snapshots.Where(s => entityIds.Contains(s.EntityId)).ExecuteDeleteAsync();

    await db.Assets.Where(a => a.OwnerMemberId == id).ExecuteDeleteAsync();
    await db.Liabilities.Where(l => l.OwnerMemberId == id).ExecuteDeleteAsync();
    await db.Snapshots.Where(s => s.RecordedBy == id).ExecuteDeleteAsync();
    await db.HouseholdMembers.Where(m => m.Id == id).ExecuteDeleteAsync();

    await transaction.CommitAsync();

    return Results.NoContent();
}
```

- [ ] **Step 3: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs
git commit -m "feat(api): add delete member endpoint with cascading data purge"
```

---

### Task 5: API — Add Delete Household Endpoint

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs`

- [ ] **Step 1: Add route mapping**

In `MapHouseholdEndpoints`, add:
```csharp
app.MapDelete("/api/household", DeleteHousehold);
```

- [ ] **Step 2: Add DeleteHousehold handler**

```csharp
private static async Task<IResult> DeleteHousehold(HttpContext context, ClearfolioDbContext db)
{
    var member = context.Items["HouseholdMember"] as HouseholdMember;
    if (member is null) return Results.Unauthorized();
    if (!member.IsPrimary) return Results.Forbid();

    var householdId = member.HouseholdId;

    await using var transaction = await db.Database.BeginTransactionAsync();

    await db.Snapshots.Where(s => s.HouseholdId == householdId).ExecuteDeleteAsync();
    await db.Assets.Where(a => a.HouseholdId == householdId).ExecuteDeleteAsync();
    await db.Liabilities.Where(l => l.HouseholdId == householdId).ExecuteDeleteAsync();
    await db.HouseholdMembers.Where(m => m.HouseholdId == householdId).ExecuteDeleteAsync();
    await db.Households.Where(h => h.Id == householdId).ExecuteDeleteAsync();

    await transaction.CommitAsync();

    return Results.NoContent();
}
```

- [ ] **Step 3: Update GetHousehold and UpdateHousehold to handle null member**

Change the existing `GetMember` helper to handle null:
```csharp
private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
    context.Items["HouseholdMember"] as HouseholdMember;
```

Update `GetHousehold`:
```csharp
private static IResult GetHousehold(HttpContext context)
{
    var member = GetMemberOrNull(context);
    if (member is null) return Results.Unauthorized();
    var h = member.Household;
    return Results.Ok(new HouseholdDto(h.Id, h.Name, h.BaseCurrency, h.PreferredPeriodType, h.CreatedAt));
}
```

Update `UpdateHousehold`:
```csharp
private static async Task<IResult> UpdateHousehold(HttpContext context, UpdateHouseholdRequest request, ClearfolioDbContext db)
{
    var member = GetMemberOrNull(context);
    if (member is null) return Results.Unauthorized();
    // ... rest unchanged
}
```

- [ ] **Step 4: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 5: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs
git commit -m "feat(api): add delete household endpoint for nuclear reset"
```

---

### Task 6: API — Update Remaining Endpoints for Null Member

**Files:**
- Modify: `src/api/Clearfolio.Api/Endpoints/AssetsEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/LiabilitiesEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/SnapshotsEndpoints.cs`
- Modify: `src/api/Clearfolio.Api/Endpoints/DashboardEndpoints.cs`

Every endpoint file has a `GetMember` helper that casts `context.Items["HouseholdMember"]!`. Since the middleware now allows null through, each file needs the same update:

- [ ] **Step 1: Update each file's GetMember helper**

In each of the four files, change:
```csharp
private static HouseholdMember GetMember(HttpContext context) =>
    (HouseholdMember)context.Items["HouseholdMember"]!;
```
to:
```csharp
private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
    context.Items["HouseholdMember"] as HouseholdMember;
```

And add a null check at the start of every handler that calls it:
```csharp
var member = GetMemberOrNull(context);
if (member is null) return Results.Unauthorized();
```

This is a mechanical change across all handlers in all four files.

- [ ] **Step 2: Verify API builds**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```bash
git add src/api/Clearfolio.Api/Endpoints/
git commit -m "feat(api): handle null member in all endpoints after middleware change"
```

---

### Task 7: Frontend — Add API Methods

**Files:**
- Modify: `src/app/src/app/core/api/api.service.ts`

- [ ] **Step 1: Add setup, deleteMember, and deleteAllData methods**

Add to the Members section of `ApiService`:

```typescript
setup(displayName: string) {
  return this.http.post<Member>('/api/members/setup', { displayName });
}

deleteMember(id: string) {
  return this.http.delete(`/api/members/${id}`);
}
```

Add to a new section after Members:

```typescript
// Household - destructive
deleteAllData() {
  return this.http.delete('/api/household');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/src/app/core/api/api.service.ts
git commit -m "feat(app): add setup, deleteMember, deleteAllData API methods"
```

---

### Task 8: Frontend — Update AuthService for Setup State

**Files:**
- Modify: `src/app/src/app/core/auth/auth.service.ts`

The `init()` method currently calls `getCurrentMember()` and sets the member on success or does nothing on error. Now, a 404 response means `needsSetup`. The 404 body contains `{ needsSetup: true, email: "..." }`.

- [ ] **Step 1: Add needsSetup and setupEmail signals, update init()**

Replace the entire file:

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../api/api.service';
import { Member } from '../api/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private _currentMember = signal<Member | null>(null);
  private _members = signal<Member[]>([]);
  private _loading = signal(true);
  private _needsSetup = signal(false);
  private _setupEmail = signal<string | null>(null);

  readonly currentMember = this._currentMember.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._currentMember() !== null);
  readonly needsSetup = this._needsSetup.asReadonly();
  readonly setupEmail = this._setupEmail.asReadonly();

  init() {
    this._loading.set(true);
    this.api.getCurrentMember().subscribe({
      next: (member) => {
        this._currentMember.set(member);
        this._needsSetup.set(false);
        this._setupEmail.set(null);
        this._loading.set(false);
        this.loadMembers();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404 && err.error?.needsSetup) {
          this._needsSetup.set(true);
          this._setupEmail.set(err.error.email);
        }
        this._currentMember.set(null);
        this._loading.set(false);
      },
    });
  }

  /** Re-inits auth and returns a promise that resolves when loading completes. */
  setupComplete(): Promise<void> {
    return new Promise((resolve) => {
      this._loading.set(true);
      this._needsSetup.set(false);
      this.api.getCurrentMember().subscribe({
        next: (member) => {
          this._currentMember.set(member);
          this._loading.set(false);
          this.loadMembers();
          resolve();
        },
        error: () => {
          this._loading.set(false);
          resolve();
        },
      });
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe((members) => this._members.set(members));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/src/app/core/auth/auth.service.ts
git commit -m "feat(app): handle needsSetup state in AuthService"
```

---

### Task 9: Frontend — Create Setup Guard

**Files:**
- Create: `src/app/src/app/core/auth/setup.guard.ts`

Two guards: one that redirects to `/setup` if not set up (for all app routes), and one that redirects away from `/setup` if already set up.

- [ ] **Step 1: Create the guard file**

```typescript
// src/app/src/app/core/auth/setup.guard.ts
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

function waitForAuth(auth: AuthService): Promise<void> {
  if (!auth.loading()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
}

export const requireSetupComplete: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (auth.needsSetup()) return router.createUrlTree(['/setup']);
  return true;
};

export const requireSetupNeeded: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (!auth.needsSetup()) return router.createUrlTree(['/dashboard']);
  return true;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/src/app/core/auth/setup.guard.ts
git commit -m "feat(app): add route guards for setup flow"
```

---

### Task 10: Frontend — Create Setup Component

**Files:**
- Create: `src/app/src/app/features/setup/setup.component.ts`
- Create: `src/app/src/app/features/setup/setup.component.html`
- Create: `src/app/src/app/features/setup/setup.component.scss`

- [ ] **Step 1: Create setup.component.ts**

```typescript
import { Component, ChangeDetectionStrategy, inject, signal, model } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputText, Button],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected email = this.auth.setupEmail;
  protected displayName = model('');
  protected saving = signal(false);

  submit() {
    const name = this.displayName().trim();
    if (!name) return;
    this.saving.set(true);
    this.api.setup(name).subscribe({
      next: () => {
        // Re-init auth and wait for it to complete before navigating
        this.auth.setupComplete().then(() => {
          this.router.navigate(['/dashboard']);
        });
      },
      error: () => this.saving.set(false),
    });
  }
}
```

- [ ] **Step 2: Create setup.component.html**

```html
<div class="setup-page">
  <div class="setup-card">
    <img src="logo.svg" alt="" class="setup-logo" />
    <h1>Welcome to clearfolio</h1>
    <p class="setup-subtitle">Let's get you set up.</p>

    <div class="setup-form">
      <label for="email">Email</label>
      <input pInputText id="email" [value]="email()" readonly class="email-readonly" />

      <label for="displayName">Display Name</label>
      <input pInputText id="displayName" [(ngModel)]="displayName" placeholder="e.g. Sarah" (keydown.enter)="submit()" />

      <p-button label="Get Started" icon="pi pi-arrow-right" (onClick)="submit()"
        [disabled]="!displayName().trim() || saving()" [loading]="saving()" />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create setup.component.scss**

```scss
.setup-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

.setup-card {
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.setup-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
}

h1 {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
}

.setup-subtitle {
  color: var(--p-text-muted-color);
  margin-bottom: 2rem;
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;

  label {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--p-text-color);
  }
}

.email-readonly {
  opacity: 0.7;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/features/setup/
git commit -m "feat(app): add first-time setup component"
```

---

### Task 11: Frontend — Update Routes and App Shell

**Files:**
- Modify: `src/app/src/app/app.routes.ts`
- Modify: `src/app/src/app/app.ts`

- [ ] **Step 1: Update app.routes.ts**

Replace the entire file:

```typescript
import { Routes } from '@angular/router';
import { requireSetupComplete, requireSetupNeeded } from './core/auth/setup.guard';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [requireSetupNeeded],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./features/assets/assets.component').then((m) => m.AssetsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'liabilities',
    loadComponent: () =>
      import('./features/liabilities/liabilities.component').then((m) => m.LiabilitiesComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'snapshots',
    loadComponent: () =>
      import('./features/snapshots/snapshots.component').then((m) => m.SnapshotsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [requireSetupComplete],
  },
];
```

- [ ] **Step 2: Update app.ts to hide nav when needsSetup**

In the `App` component template, wrap the `<nav>` and `<p-drawer>` in a conditional:

Replace:
```html
<nav class="app-nav">
```
with:
```html
@if (!auth.needsSetup()) {
<nav class="app-nav">
```

After the closing `</p-drawer>` tag, add:
```html
}
```

The `<main class="app-content">` and `<router-outlet />` remain outside the conditional so the setup page renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/src/app/app.routes.ts src/app/src/app/app.ts
git commit -m "feat(app): add setup route with guards, hide nav during setup"
```

---

### Task 12: Frontend — Add Member Deletion to Settings

**Files:**
- Modify: `src/app/src/app/features/settings/settings.component.ts`
- Modify: `src/app/src/app/features/settings/settings.component.html`
- Modify: `src/app/src/app/features/settings/settings.component.scss`

- [ ] **Step 1: Add delete logic to settings.component.ts**

Add imports for `ConfirmDialog` and `Router`:
```typescript
import { Router } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
```

Update the `imports` array to include `ConfirmDialogModule`.
Update the `providers` array to include `ConfirmationService`.

Add injects:
```typescript
private router = inject(Router);
private confirmationService = inject(ConfirmationService);
```

Add properties:
```typescript
protected currentMember = this.auth.currentMember;
protected deleteAllConfirmName = '';
protected deleteAllDialogVisible = signal(false);
```

Add methods:
```typescript
confirmDeleteMember(member: Member) {
  this.confirmationService.confirm({
    message: `This will permanently delete all assets, liabilities, and snapshots owned by ${member.displayName}. This cannot be undone.`,
    header: `Delete ${member.displayName}?`,
    icon: 'pi pi-exclamation-triangle',
    acceptButtonStyleClass: 'p-button-danger',
    accept: () => {
      this.api.deleteMember(member.id).subscribe(() => {
        this.api.getMembers().subscribe((m) => this.members.set(m));
        this.auth.loadMembers();
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${member.displayName} and all their data have been deleted` });
      });
    },
  });
}

openDeleteAllDialog() {
  this.deleteAllConfirmName = '';
  this.deleteAllDialogVisible.set(true);
}

confirmDeleteAll() {
  const h = this.household();
  if (!h || this.deleteAllConfirmName !== h.name) return;
  this.api.deleteAllData().subscribe(() => {
    this.auth.init();
    this.router.navigate(['/setup']);
  });
}
```

- [ ] **Step 2: Update settings.component.html**

Add a delete button to each member card. In the `member-name-row` div, inside the `@else` block (non-editing state), after the edit button, add:

```html
@if (currentMember()?.isPrimary && !member.isPrimary) {
  <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" (onClick)="confirmDeleteMember(member)" />
}
```

Add `<p-confirmdialog />` after the `<p-toast />`.

After the closing `</p-tabs>` tag (and before the existing `<p-dialog>` for add member), add the danger zone:

```html
@if (currentMember()?.isPrimary) {
  <div class="danger-zone">
    <h3>Danger Zone</h3>
    <p>Permanently delete all household data including all members, assets, liabilities, and snapshots.</p>
    <p-button label="Delete All Data" icon="pi pi-trash" severity="danger" (onClick)="openDeleteAllDialog()" />
  </div>
}

<p-dialog header="Delete All Data" [(visible)]="deleteAllDialogVisible" [modal]="true" [style]="{ width: '450px' }">
  <p>This will <strong>permanently delete all data</strong> and cannot be undone. Type the household name to confirm:</p>
  <p class="confirm-name">{{ household()?.name }}</p>
  <input pInputText [(ngModel)]="deleteAllConfirmName" placeholder="Type household name" class="confirm-input" />
  <ng-template #footer>
    <p-button label="Cancel" [text]="true" (onClick)="deleteAllDialogVisible.set(false)" />
    <p-button label="Delete Everything" icon="pi pi-trash" severity="danger" (onClick)="confirmDeleteAll()"
      [disabled]="deleteAllConfirmName !== household()?.name" />
  </ng-template>
</p-dialog>
```

- [ ] **Step 3: Add danger zone styles to settings.component.scss**

```scss
.danger-zone {
  margin-top: 3rem;
  padding: 1.5rem;
  border: 1px solid var(--p-red-300);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--p-red-50) 50%, transparent);

  :root.app-dark & {
    background: color-mix(in srgb, var(--p-red-950) 30%, transparent);
    border-color: var(--p-red-800);
  }

  h3 {
    margin: 0 0 0.5rem;
    color: var(--p-red-500);
  }

  p {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--p-text-muted-color);
  }
}

.confirm-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--p-text-color);
}

.confirm-input {
  width: 100%;
  margin-top: 0.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/src/app/features/settings/
git commit -m "feat(app): add member deletion and danger zone to settings"
```

---

### Task 13: Smoke Test

- [ ] **Step 1: Build the full API**

Run: `dotnet build src/api/Clearfolio.Api/`
Expected: Build succeeded, no errors

- [ ] **Step 2: Build the Angular app**

Run: `cd src/app && npx ng build`
Expected: Build succeeded, no errors

- [ ] **Step 3: Commit all remaining changes (if any)**

Verify nothing is uncommitted:
Run: `git status`
Expected: Clean working tree
