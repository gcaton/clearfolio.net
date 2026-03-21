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
2. **Member resolution**: Load the primary member and set `context.Items["HouseholdMember"]` — same contract the old middleware provided. Downstream endpoints are unchanged.

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

### Login Page

Only rendered if passphrase is enabled and session is not active:
- Centered form: passphrase input + submit button
- On success → session cookie set → redirect to dashboard
- Styled consistently with setup page

---

## 4. Member Model Changes

### HouseholdMember Entity

- `Email` becomes **optional/nullable** — no longer used for auth, purely informational

### Endpoint Changes

- `POST /api/members/setup` — request body expanded: `{ displayName, householdName?, currency?, periodType? }`. Creates household with provided values and primary member with tag "p1".
- `POST /api/members` — `email` parameter becomes optional, only `displayName` required
- `GET /api/members/me` — returns the primary member (no identity resolution needed)
- Middleware no longer does email-based member lookup

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

Commands stay the same. `just dev` still works for Angular hot-reload with proxy to the container API.

---

## 6. Files Changed

### Deleted

- `src/app/Dockerfile`
- `src/api/Dockerfile`
- `src/api/Clearfolio.Api/Middleware/CloudflareJwtMiddleware.cs`

### Created

- `Dockerfile` (repo root)
- `docker-entrypoint.sh` (repo root)
- `src/api/Clearfolio.Api/Middleware/LocalAuthMiddleware.cs`
- `src/api/Clearfolio.Api/Endpoints/AuthEndpoints.cs`
- `src/api/Clearfolio.Api/Models/AppSetting.cs`
- `src/app/src/app/features/login/login.component.ts` (+ template, styles)

### Modified

- `src/app/nginx.conf` — proxy target to `127.0.0.1:8080`
- `src/api/Clearfolio.Api/Program.cs` — swap middleware, register auth endpoints
- `src/api/Clearfolio.Api/Clearfolio.Api.csproj` — remove Cloudflare JWT packages, add BCrypt
- `src/api/Clearfolio.Api/Models/HouseholdMember.cs` — Email nullable
- `src/api/Clearfolio.Api/Endpoints/MembersEndpoints.cs` — expanded setup, remove email requirement
- `src/api/Clearfolio.Api/DTOs/SetupRequest.cs` — add household fields
- `src/api/Clearfolio.Api/Data/ClearfolioDbContext.cs` — add AppSettings DbSet, migration
- `src/app/src/app/core/auth/auth.service.ts` — use `/api/auth/status`, handle passphrase flow
- `src/app/src/app/core/auth/setup.guard.ts` — updated guard logic
- `src/app/src/app/core/api/api.service.ts` — add auth API methods
- `src/app/src/app/features/settings/settings.component.ts` — passphrase management UI
- `.github/workflows/build.yml` — single build job, multi-arch
- `.docker/docker-compose.yml` — single service
- `.docker/docker-compose.prod.yml` — single service, remove CF vars
- `Justfile` — update if needed
- `README.md` — rewrite for self-hosted single-image setup
