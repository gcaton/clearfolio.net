# Single Docker Image + Local Auth

**Date:** 2026-03-21
**Status:** Approved

## Summary

Consolidate the two-image Docker setup (API + frontend) into a single image for simplified distribution. Replace Cloudflare Access authentication with a no-auth-by-default model and optional passphrase protection. Add a first-run setup wizard for initial household configuration.

## Goals

- One `docker run` command to get the app running
- No external dependencies (no Cloudflare, no OAuth providers)
- Multi-arch support (amd64 + arm64) for broad compatibility
- Optional passphrase for users who want basic access control

## Non-Goals

- Multi-user authentication (login as specific member)
- OAuth/SSO provider integration
- HTTPS termination within the container

---

## 1. Single Docker Image

### Dockerfile (repo root, replaces `src/app/Dockerfile` and `src/api/Dockerfile`)

Three-stage multi-stage build:

- **Stage 1 — Angular build**: Node 24 alpine base. `npm ci`, `ng build --configuration production`. Accepts `APP_VERSION` build arg for version stamping.
- **Stage 2 — .NET API build**: .NET 10 SDK base. `dotnet restore`, `dotnet publish -c Release`.
- **Stage 3 — Runtime**: .NET 10 ASP.NET runtime base. Install nginx. Copy Angular build output to `/usr/share/nginx/html`. Copy published API to `/app`.

### Entrypoint

A shell script (`docker-entrypoint.sh`) that:
1. Starts nginx in the background
2. Runs the .NET API in the foreground

If the API exits, the container exits. Docker `restart: unless-stopped` handles recovery.

### Networking

- Nginx listens on port **80** (the only exposed port)
- Nginx serves static Angular files at `/`
- Nginx proxies `/api/*` to `http://127.0.0.1:8080` (the .NET API, same container)
- `nginx.conf` updated: `proxy_pass` target changes from `http://api:8080` to `http://127.0.0.1:8080`

### Volume

- `/data` — SQLite database persistence
- `DB_PATH` env var defaults to `/data/clearfolio.db`

### Usage

```bash
docker run -d -p 8080:80 -v clearfolio-data:/data ghcr.io/gcaton/clearfolio
```

---

## 2. Auth Replacement

### Removed

- `CloudflareJwtMiddleware.cs` — deleted
- All `CF_TEAM_NAME`, `CF_ACCESS_AUD` env var references
- `Cf-Access-Jwt-Assertion` header handling
- NuGet packages: `System.IdentityModel.Tokens.Jwt`, `Microsoft.IdentityModel.Protocols.OpenIdConnect`, and related `Microsoft.IdentityModel.*` packages

### New: LocalAuthMiddleware

Registered in `Program.cs` in place of the old middleware. Two responsibilities:

1. **Passphrase gate**: If a passphrase is set in the DB (see AppSettings below), check for a valid session cookie. Return 401 if missing/invalid. If no passphrase is set, all requests pass through.
2. **Member resolution**: Load the primary member and set both `context.Items["HouseholdMember"]` and `context.Items["UserEmail"]` (set to the member's email or empty string if null). This preserves the contract that downstream endpoints (`MembersEndpoints`, etc.) rely on — they cast `context.Items["UserEmail"]` with a null-forgiving operator. All `UserEmail` references in endpoints will be migrated away during implementation (replaced with direct primary-member lookup), but the middleware sets both keys during the transition to avoid runtime nullrefs.

### Passphrase Storage

New `AppSettings` table in SQLite:

| Column | Type | Description |
|--------|------|-------------|
| Key | string (PK) | Setting identifier |
| Value | string | Setting value |

Passphrase stored as a **bcrypt hash** under key `"passphrase"`. No row = no auth required.

NuGet package: `BCrypt.Net-Next`

### Session Management

- On successful passphrase entry: API sets an HTTP-only `Set-Cookie` with a random token
- Token stored in the `AppSettings` table (key: `"session:{token}"`, value: expiry timestamp)
- Session expires after **30 days** (configurable via `CLEARFOLIO_SESSION_DAYS` env var)
- Logout clears the cookie and deletes the session row

### New Endpoints (`AuthEndpoints.cs`)

All exempt from the passphrase gate:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/status` | GET | `{ passphraseEnabled: bool, authenticated: bool, setupComplete: bool }` |
| `/api/auth/login` | POST | `{ passphrase: string }` → validates, sets session cookie |
| `/api/auth/logout` | POST | Clears session cookie and server-side session |

Passphrase management (NOT exempt — require active session if passphrase is set):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/passphrase` | PUT | `{ current?: string, new: string }` → set or update passphrase |
| `/api/auth/passphrase` | DELETE | `{ current: string }` → remove passphrase |

### Escape Hatch

Env var `CLEARFOLIO_RESET_PASSPHRASE=true` on container start clears the passphrase row from `AppSettings` and all session rows, then continues normal startup. Documented for "forgot passphrase" recovery.

---

## 3. First-Run Setup Wizard

### Detection

`GET /api/auth/status` returns `setupComplete: false` when no household exists in the DB.

### Angular Flow

1. `AuthService.init()` calls `/api/auth/status` on app boot
2. If `setupComplete: false` → navigate to `/setup`
3. Setup page — single form with:
   - Household name (default: "My Household")
   - Your display name (required)
   - Currency (dropdown, default: AUD)
   - Period type (FY / CY toggle, default: FY)
4. Submit calls `POST /api/members/setup` → creates household + primary member + seeds reference data
5. On success → redirect to `/dashboard`

### Route Guard Priority

```
/api/auth/status → setupComplete? → passphraseEnabled + authenticated? → app loads
                    ↓ no              ↓ no
                    /setup            /login
```

### Angular Auth State Changes

`AuthService` signals rewritten:
- Remove: `needsSetup`, `setupEmail` signals (were based on email from Cloudflare 404 response)
- Add: `setupComplete` signal (from `/api/auth/status`)
- Add: `passphraseEnabled` signal (from `/api/auth/status`)
- Add: `authenticated` signal (from `/api/auth/status`)
- Keep: `currentMember`, `members`, `loading`

### Route Guards (`setup.guard.ts`)

Three exported guards:
- `requireSetupComplete` — redirects to `/setup` if `!setupComplete`
- `requireSetupNeeded` — redirects to `/dashboard` if `setupComplete`
- `requireAuthenticated` — redirects to `/login` if `passphraseEnabled && !authenticated`

App routes chain: `requireSetupComplete` → `requireAuthenticated` → component.

### App Shell (`app.ts`)

Update `@if` blocks that currently gate on `auth.needsSetup()` to also hide nav/footer when on `/login` route (passphrase required but not yet authenticated).

### Routes (`app.routes.ts`)

Add `/login` route with `requireSetupComplete` + `requireAuthenticated` inversion guard (show login only when passphrase is needed).

### Setup Component

- Remove the read-only email field from `setup.component.html` (was bound to `auth.setupEmail()`)
- Add household name, currency, and period type fields
- Submit calls the expanded `POST /api/members/setup`

### Login Page

Only rendered if passphrase is enabled and session is not active:
- Centered form: passphrase input + submit button
- On success → session cookie set → redirect to dashboard
- Styled consistently with setup page

### Settings — Add Member Dialog

- Remove required email field from `settings.component.html` add-member dialog
- Email becomes an optional field
- Remove the `!newMemberEmail` disabled check

---

## 4. Member Model Changes

### HouseholdMember Entity

- `Email` becomes **optional/nullable** — no longer used for auth, purely informational
- `ClearfolioDbContext.cs` must update the `HouseholdMember` configuration: remove `.IsRequired()` on Email, drop `.HasIndex().IsUnique()` on Email

### Endpoint Changes

- `POST /api/members/setup` — request body expanded: `{ displayName, householdName?, currency?, periodType? }`. Creates household with provided values and primary member with tag "p1". Remove all `context.Items["UserEmail"]` usage — no longer resolves identity from email. The setup endpoint no longer checks for an existing member by email; it simply checks if any household exists.
- `POST /api/members` — `email` parameter becomes optional, only `displayName` required. Remove the email-uniqueness check (`AnyAsync(m => m.Email == request.Email)`); replace with display-name-based duplicate prevention or remove entirely.
- `GET /api/members/me` — returns the primary member via direct DB query (`FirstOrDefaultAsync(m => m.IsPrimary)`) instead of email lookup. Remove `context.Items["UserEmail"]` dependency.
- `CreateMemberRequest` DTO — `Email` becomes `string?` (nullable)
- `SetupStatusDto` — deleted (no longer used; replaced by `/api/auth/status` response)

### Export/Import Compatibility

- `ExportMemberDto` — `Email` becomes `string?` (nullable)
- Import handler — null-coalesce `Email` for backward compatibility with v1 exports that include email values
- Export version stays at `"1"` (additive change, not breaking)

### Unchanged

All data endpoints (`/api/assets`, `/api/snapshots`, `/api/dashboard/*`, etc.) continue to scope by household. The view switcher in the Angular UI determines which member's perspective is displayed — this is a frontend-only concern, not an API concern.

---

## 5. CI/CD Pipeline

### `.github/workflows/build.yml`

- Collapse `build-api` and `build-app` jobs into single `build` job
- Image name: `ghcr.io/${{ github.repository_owner }}/clearfolio`
- Build context: repo root
- Dockerfile: `Dockerfile` (repo root)
- Platforms: `linux/amd64,linux/arm64`
- Use per-platform cache scopes (`scope=linux-amd64` / `scope=linux-arm64`) to avoid GHA cache thrashing on multi-arch builds
- `APP_VERSION` build arg passed through
- Single `delete-package-versions` for package `clearfolio`

### `.docker/docker-compose.yml` (dev)

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

### `.docker/docker-compose.prod.yml`

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

### Justfile

Commands stay the same. `just dev` still works for Angular hot-reload — `proxy.conf.json` updated to proxy `/api` to `http://localhost:4200` (the nginx port on the single container) instead of `http://localhost:5000`.

---

## 6. Files Changed

### Deleted

- `src/app/Dockerfile`
- `src/api/Dockerfile`
- `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs`
- `src/api/Clearfolio.Api/DTOs/SetupStatusDto.cs`

### Created

- `Dockerfile` (repo root)
- `docker-entrypoint.sh` (repo root)
- `src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs`
- `src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs`
- `src/api/Clearfolio.Api/Models/AppSetting.cs`
- `src/app/src/app/features/login/login.component.ts` (+ template, styles)
- New EF migration folder (delete all existing migrations, generate fresh `InitialCreate` from updated models)

### Modified

- `src/app/nginx.conf` — proxy target to `127.0.0.1:8080`
- `src/api/Clearfolio.Api/Program.cs` — swap middleware, register auth endpoints
- `src/api/Clearfolio.Api/Clearfolio.Api.csproj` — remove Cloudflare JWT packages, add BCrypt
- `src/api/Clearfolio.Api/Models/HouseholdMember.cs` — Email nullable
- `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs` — expanded setup, remove email-based lookup, remove `context.Items["UserEmail"]` usage
- `src/api/Clearfolio.Api/DTOs/SetupRequest.cs` — add household fields
- `src/api/Clearfolio.Api/DTOs/MemberDto.cs` — Email nullable
- `src/api/Clearfolio.Api/DTOs/ExportDto.cs` — ExportMemberDto Email nullable
- `src/api/Clearfolio.Api/Endpoints/HouseholdEndpoints.cs` — import handler null-coalesce Email
- `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs` — add AppSettings DbSet, update HouseholdMember Email config
- `src/api/Clearfolio.Api/Data/Migrations/*` — delete all, regenerate fresh `InitialCreate` from updated models
- `src/api/Clearfolio.Api/appsettings.Development.json` — remove `DevAuth:MockUserEmail` section
- `src/app/src/app/core/auth/auth.service.ts` — rewrite signals, use `/api/auth/status`
- `src/app/src/app/core/auth/setup.guard.ts` — add `requireAuthenticated` guard
- `src/app/src/app/core/api/api.service.ts` — add auth API methods
- `src/app/src/app/app.routes.ts` — add `/login` route
- `src/app/src/app/app.ts` — update `@if` blocks for passphrase-required state
- `src/app/src/app/features/setup/setup.component.ts` — remove email field, add household fields
- `src/app/src/app/features/setup/setup.component.html` — updated form
- `src/app/src/app/features/settings/settings.component.ts` — passphrase management UI
- `src/app/src/app/features/settings/settings.component.html` — email optional in add-member dialog
- `src/app/proxy.conf.json` — proxy target to `localhost:4200`
- `.github/workflows/build.yml` — single build job, multi-arch
- `.docker/docker-compose.yml` — single service
- `.docker/docker-compose.prod.yml` — single service, remove CF vars
- `Justfile` — update if needed
- `README.md` — rewrite for self-hosted single-image setup
