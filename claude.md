# Clearfolio — Household Net Worth Tracker

## Project overview

Self-hosted household net worth tracker running on a Raspberry Pi 5, exposed via Cloudflare Tunnel with authentication handled entirely by Cloudflare Access (Google OAuth). No passwords stored in-app. Users record periodic snapshots of assets and liabilities across defined categories, with analytical views tracking growth, composition, and household vs individual positions over time.

Domain: `clearfolio.net`

---

## Tech stack

| Layer | Technology |
|---|---|
| API | .NET 10 — minimal API style (not controller-based) |
| ORM | EF Core 10 with SQLite provider |
| Database | SQLite (single file) + Litestream replication to Cloudflare R2 |
| Frontend | Angular 21 (standalone components, signals-based state) |
| UI components | PrimeNG (latest compatible with Angular 21) |
| Charting | Apache ECharts via ngx-echarts |
| Auth | Cloudflare Access JWT validation (no in-app auth) |
| Hosting | Raspberry Pi 5, Nginx, systemd services |
| Tunnel | Cloudflare Tunnel (cloudflared) |
| Backups | Litestream → Cloudflare R2 |
| Task runner | Justfile |

---

## Repository structure

```
clearfolio/
├── CLAUDE.md                        ← this file
├── Justfile                         ← build, deploy, migrate recipes
├── README.md
├── api/                             ← .NET 10 solution
│   ├── Clearfolio.sln
│   └── Clearfolio.Api/
│       ├── Program.cs
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── Middleware/
│       │   └── CloudflareJwtMiddleware.cs
│       ├── Data/
│       │   ├── ClearfolioDbContext.cs
│       │   └── Migrations/
│       ├── Models/                  ← EF Core entities
│       ├── DTOs/                    ← Request/response shapes
│       ├── Endpoints/
│       │   ├── HouseholdEndpoints.cs
│       │   ├── MembersEndpoints.cs
│       │   ├── AssetsEndpoints.cs
│       │   ├── LiabilitiesEndpoints.cs
│       │   ├── SnapshotsEndpoints.cs
│       │   ├── DashboardEndpoints.cs
│       │   └── ReferenceEndpoints.cs
│       └── Helpers/
│           └── PeriodHelper.cs
└── web/                             ← Angular 21 app
    ├── angular.json
    ├── package.json
    ├── proxy.conf.json              ← /api/* → localhost:5000
    └── src/
        └── app/
            ├── core/
            │   ├── auth/            ← CF JWT extraction, current user signal
            │   └── api/             ← HttpClient service wrappers
            ├── shared/
            │   ├── components/      ← period-selector, owner-badge, currency-display
            │   └── pipes/           ← currency, period-label, liquidity-label
            └── features/
                ├── dashboard/
                ├── assets/
                ├── liabilities/
                ├── snapshots/
                └── settings/
```

---

## Database

### File location (production)
```
/var/data/clearfolio/clearfolio.db
```

### EF Core approach
- Migrations are generated from C# entity classes — never write migration SQL by hand
- Migrations apply automatically on startup via `db.Database.Migrate()` in `Program.cs`
- Seed data (asset types, liability types) uses `HasData()` in `OnModelCreating` with fixed GUIDs
- Data migrations (e.g. transforming existing data) use `migrationBuilder.Sql()` inside a migration class

### Generate a migration
```bash
cd api/Clearfolio.Api
dotnet ef migrations add <MigrationName>
dotnet ef database update   # local dev only — prod migrates on startup
```

### Litestream (backup)
Litestream runs as a systemd service alongside the API, continuously replicating the SQLite WAL to Cloudflare R2. Config at `/etc/litestream.yml`. Replaces any cron-based backup approach.

---

## Schema

### households
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| name | TEXT | e.g. "Smith Household" |
| base_currency | TEXT | ISO 4217, default AUD |
| preferred_period_type | TEXT | `CY` or `FY`, default `FY` |
| created_at | TEXT | ISO8601 UTC |

### household_members
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| household_id | TEXT (UUID) | FK → households |
| email | TEXT | From Cloudflare JWT. Unique. |
| display_name | TEXT | e.g. "Greg" |
| member_tag | TEXT | `p1`, `p2` etc. |
| is_primary | INTEGER | First to authenticate = 1 |
| created_at | TEXT | ISO8601 UTC |

### asset_types
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| name | TEXT | e.g. "Superannuation — Accumulation" |
| category | TEXT | `cash` \| `investable` \| `retirement` \| `property` \| `other` |
| liquidity | TEXT | `immediate` \| `short_term` \| `long_term` \| `restricted` |
| growth_class | TEXT | `growth` \| `defensive` \| `mixed` |
| is_super | INTEGER | Boolean — Australian super treatment |
| is_cgt_exempt | INTEGER | Boolean — PPOR etc |
| sort_order | INTEGER | Display ordering |
| is_system | INTEGER | 1 = seeded default |

### liability_types
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| name | TEXT | e.g. "Home Loan (PPOR)" |
| category | TEXT | `mortgage` \| `personal` \| `credit` \| `student` \| `tax` \| `other` |
| debt_quality | TEXT | `productive` \| `neutral` \| `bad` |
| is_hecs | INTEGER | Boolean — CPI-indexed, no interest |
| sort_order | INTEGER | Display ordering |
| is_system | INTEGER | 1 = seeded default |

### assets
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| household_id | TEXT (UUID) | FK → households |
| asset_type_id | TEXT (UUID) | FK → asset_types |
| owner_member_id | TEXT (UUID) | FK → household_members. NULL = joint |
| ownership_type | TEXT | `sole` \| `joint` |
| joint_split | REAL | P1 share, e.g. 0.5. Ignored if sole. |
| label | TEXT | User description |
| currency | TEXT | ISO 4217 |
| notes | TEXT | Optional |
| is_active | INTEGER | Soft delete |
| created_at | TEXT | ISO8601 UTC |
| updated_at | TEXT | ISO8601 UTC |

### liabilities
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| household_id | TEXT (UUID) | FK → households |
| liability_type_id | TEXT (UUID) | FK → liability_types |
| owner_member_id | TEXT (UUID) | FK → household_members. NULL = joint |
| ownership_type | TEXT | `sole` \| `joint` |
| joint_split | REAL | P1 share. Ignored if sole. |
| label | TEXT | User description |
| currency | TEXT | ISO 4217 |
| notes | TEXT | Optional |
| is_active | INTEGER | Soft delete |
| created_at | TEXT | ISO8601 UTC |
| updated_at | TEXT | ISO8601 UTC |

### snapshots
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | PK |
| household_id | TEXT (UUID) | FK → households |
| entity_id | TEXT (UUID) | FK → assets.id or liabilities.id |
| entity_type | TEXT | `asset` \| `liability` |
| period | TEXT | Format: `CY{YYYY}[-Qn\|-Mmm]` or `FY{YYYY}[-Qn\|-Mmm]` |
| value | REAL | Positive. For liabilities: outstanding principal. |
| currency | TEXT | ISO 4217 at snapshot time |
| notes | TEXT | Optional |
| recorded_by | TEXT (UUID) | FK → household_members |
| recorded_at | TEXT | ISO8601 UTC |

**Key indexes:**
- `snapshots(household_id, period)`
- `snapshots(entity_id, period)`
- `household_members(email)`
- `assets(household_id, is_active)`
- `liabilities(household_id, is_active)`

---

## Period conventions

Periods use a convention prefix to distinguish calendar year (CY) from Australian financial year (FY).

### Format
```
FY2025-Q1    Financial year 2025, Q1 = July–September 2024
FY2025-Q2    Financial year 2025, Q2 = October–December 2024
FY2025-Q3    Financial year 2025, Q3 = January–March 2025
FY2025-Q4    Financial year 2025, Q4 = April–June 2025
FY2025       Full financial year 2025
CY2024-Q3    Calendar year 2024, Q3 = July–September 2024
CY2024       Full calendar year 2024
```

### Rules
- FY year label = the year the financial year **ends** in (ATO convention)
- YoY comparisons match on same convention + quarter only — never cross CY↔FY
- `preferred_period_type` on households controls UI default only; both conventions can coexist
- Historical data migration: prefix legacy period strings with `CY` via `migrationBuilder.Sql()`

### PeriodHelper (api/Clearfolio.Api/Helpers/PeriodHelper.cs)
Static utility — single source of truth for all period arithmetic in the API:
- `PeriodStart(string period)` → `DateOnly`
- `CurrentPeriod(string convention)` → period string for today
- `PreviousPeriod(string period)` → one quarter back, same convention
- `SameQuarterPriorYear(string period)` → YoY comparison period

---

## Authentication

### How it works
1. Cloudflare Access intercepts all requests to `clearfolio.net`
2. Unauthenticated users are redirected to Google OAuth
3. On success, Cloudflare injects `Cf-Access-Jwt-Assertion` header on every request
4. `CloudflareJwtMiddleware` validates this JWT on every API request
5. Email claim from JWT is the canonical user identifier
6. First authenticated request auto-provisions a `household_members` row

### JWT middleware responsibilities
- Read `Cf-Access-Jwt-Assertion` header — return 401 if absent
- Fetch and cache JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (60 min cache)
- Validate signature, expiry, and AUD claim
- Set `HttpContext.Items["UserEmail"]` and `HttpContext.Items["HouseholdMember"]`

### Configuration (appsettings.json / environment variables)
```json
{
  "Cloudflare": {
    "TeamName": "<your-team-name>",
    "AccessApplicationAud": "<your-access-app-aud>"
  }
}
```
Never commit real values. Use environment variables in production.

### Local development bypass
In `Development` environment, JWT middleware skips validation and sets a mock user email from `appsettings.Development.json`:
```json
{
  "DevAuth": {
    "MockUserEmail": "you@gmail.com"
  }
}
```

---

## API endpoints

All endpoints are prefixed `/api`. All require valid CF JWT (enforced by middleware). All data queries are scoped to the authenticated user's household.

### Reference (read-only)
```
GET  /api/asset-types
GET  /api/liability-types
```

### Household
```
GET  /api/household
PUT  /api/household
```

### Members
```
GET  /api/members
GET  /api/members/me
PUT  /api/members/{id}
```

### Assets
```
GET    /api/assets
POST   /api/assets
PUT    /api/assets/{id}
DELETE /api/assets/{id}        ← soft delete (is_active = 0)
```

### Liabilities
```
GET    /api/liabilities
POST   /api/liabilities
PUT    /api/liabilities/{id}
DELETE /api/liabilities/{id}   ← soft delete
```

### Snapshots
```
GET    /api/snapshots?period={period}&entityId={id}
POST   /api/snapshots           ← upsert by entity_id + period
PUT    /api/snapshots/{id}
DELETE /api/snapshots/{id}
GET    /api/periods             ← list all periods with snapshot data
```

### Dashboard
```
GET  /api/dashboard/summary?period={period}&view={household|p1|p2}
GET  /api/dashboard/trend?periods={n}&view={household|p1|p2}
GET  /api/dashboard/composition?period={period}
GET  /api/dashboard/members?period={period}
GET  /api/dashboard/super-gap
```

### Dashboard view logic
- `household` — all assets and liabilities at full value
- `p1` — sole P1 assets at full value + joint assets × `joint_split`
- `p2` — sole P2 assets at full value + joint assets × `(1 − joint_split)`

---

## Angular frontend

### Key patterns
- **Standalone components throughout** — no NgModules
- **Signals for state** — use `signal()`, `computed()`, `effect()` rather than RxJS where practical
- **ViewStateService** — `signal<'household' | 'p1' | 'p2'>('household')` consumed by all dashboard components. Persisted to `localStorage`.
- **PeriodService** — Angular mirror of PeriodHelper. Provides current period, previous period, display labels, and quarter date ranges.
- **No login page** — app calls `GET /api/members/me` on startup. 401 redirects to Cloudflare Access login URL.

### Routing structure
```
/                  → redirect to /dashboard
/dashboard         → DashboardComponent
/assets            → AssetsComponent
/liabilities       → LiabilitiesComponent
/snapshots         → SnapshotsComponent
/settings          → SettingsComponent
```

### Dashboard ECharts panels
| Panel | Chart type | API endpoint |
|---|---|---|
| Net worth total | Stat card | dashboard/summary |
| Net worth trend | Line (3 series: assets, liabilities, net worth) | dashboard/trend |
| Asset composition over time | Stacked area | dashboard/composition multi-period |
| Current period composition | Donut | dashboard/composition |
| Liquidity breakdown | Horizontal bar | dashboard/summary |
| Growth vs defensive | Pie | dashboard/summary |
| Super gap | Grouped bar (P1 vs P2) | dashboard/super-gap |
| Member comparison | Grouped bar | dashboard/members |
| Debt quality | Stacked bar | dashboard/summary (liabilities) |

### PrimeNG components in use
| Feature | Component |
|---|---|
| Navigation | `p-menubar`, `p-sidebar` |
| Data tables | `p-table`, `p-paginator` |
| Forms / dialogs | `p-dialog`, `p-drawer` |
| Inputs | `p-inputnumber`, `p-dropdown`, `p-inputtextarea`, `p-togglebutton` |
| Period selector | `p-dropdown` with custom item template |
| View toggle | `p-selectbutton` (Household / P1 / P2) |
| Owner badge | `p-tag` |
| Notifications | `p-toast`, `p-confirmDialog` |
| Loading | `p-skeleton` |
| Settings tabs | `p-tabs` |

---

## Seed data

### Asset types (is_system = 1, fixed GUIDs)
| Name | Category | Liquidity | Growth class | Flags |
|---|---|---|---|---|
| Cash — savings / transaction | cash | immediate | defensive | |
| Cash — term deposit (≤90 days) | cash | short_term | defensive | |
| Term deposit (>90 days) | cash | long_term | defensive | |
| Australian shares / ETFs | investable | short_term | growth | |
| International shares / ETFs | investable | short_term | growth | |
| Bonds / fixed income | investable | short_term | defensive | |
| Cryptocurrency | investable | immediate | growth | |
| Superannuation — Accumulation | retirement | restricted | mixed | is_super |
| Superannuation — Pension phase | retirement | long_term | mixed | is_super |
| Primary residence (PPOR) | property | long_term | growth | is_cgt_exempt |
| Investment property | property | long_term | growth | |
| Vehicle | other | long_term | defensive | |
| Other physical asset | other | long_term | mixed | |

### Liability types (is_system = 1, fixed GUIDs)
| Name | Category | Debt quality | Flags |
|---|---|---|---|
| Home loan — PPOR | mortgage | neutral | |
| Home loan — Investment property | mortgage | productive | |
| Personal loan | personal | bad | |
| Car loan | personal | bad | |
| Credit card | credit | bad | |
| HECS / HELP debt | student | neutral | is_hecs |
| Margin loan | personal | productive | |
| Tax liability | tax | neutral | |
| Other liability | other | neutral | |

---

## Build & deployment

### Justfile recipes
```
just build       # ng build --configuration production + dotnet publish
just deploy      # rsync web dist and API publish output to Pi via SSH
just migrate     # dotnet ef database update against Pi DB (dev use only — prod auto-migrates)
just logs        # tail systemd journal for clearfolio-api.service
just backup      # manually trigger Litestream snapshot
```

### Pi service layout
```
clearfolio-api.service    # Kestrel on localhost:5000
cloudflared.service       # Outbound Cloudflare Tunnel
litestream.service        # Continuous SQLite replication to R2
nginx                     # Serves /var/www/clearfolio, proxies /api/* to :5000
```

### Environment variables (Pi — /etc/clearfolio/env)
```
ASPNETCORE_ENVIRONMENT=Production
DB_PATH=/var/data/clearfolio/clearfolio.db
CF_TEAM_NAME=<your-team>
CF_ACCESS_AUD=<your-aud>
R2_ACCESS_KEY=<key>
R2_SECRET_KEY=<secret>
```

---

## Coding conventions

### .NET
- Minimal API endpoint registration in `*Endpoints.cs` files with extension methods on `WebApplication`
- All endpoint handlers are short — business logic in service classes, not inline lambdas
- Use `Results.Ok()`, `Results.NotFound()`, `Results.BadRequest()` consistently
- All queries filter by `household_id` derived from `HttpContext.Items["HouseholdMember"]` — never trust a household_id from the request body
- Use `PeriodHelper` for all period arithmetic — no ad-hoc string parsing
- EF Core queries use `.AsNoTracking()` for read-only endpoints
- Async throughout — `async Task<IResult>` handlers

### Angular
- Standalone components only — no NgModules
- Signals preferred over RxJS for local and shared state
- `inject()` function for dependency injection — not constructor injection
- `HttpClient` calls in dedicated API service classes under `core/api/`
- All currency display via the shared `CurrencyDisplayComponent` — never format inline
- All period display via `PeriodLabelPipe`
- ECharts options built in dedicated `*ChartOptions` functions — not inline in component templates

---

## Known constraints & decisions

- **No account numbers or institution names stored** — labels and values only. Reduces sensitivity of any data exposure.
- **Single household per installation** — the app is personal/family use, not multi-tenant.
- **SQLite not Postgres** — appropriate for Pi-hosted personal app. Litestream handles durability.
- **No in-app auth** — Cloudflare Access owns the full auth flow. Simplifies the codebase significantly.
- **Soft deletes only** — assets and liabilities use `is_active = 0`, never hard delete. Preserves snapshot history integrity.
- **Snapshot upsert** — `POST /api/snapshots` upserts on `(entity_id, period)` unique constraint. Simplifies the entry UI.
- **.NET 10 / Angular 21** — use current stable APIs. Do not suggest deprecated patterns from earlier versions.
- **ASX symbol lookup** — optional `symbol` field on assets, looked up via Yahoo Finance API (appended `.AX` suffix). Not stored as price data — live lookup only.
- **Bulk snapshot entry** — for backfilling historical data. Uses the same upsert endpoint, called in parallel via `forkJoin`.

---

## Git conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`, `build`, `ci`
- Scopes: `api`, `app`, `docker`, `ci`, `deps` or omit for cross-cutting changes
- Examples:
  - `feat(api): add dashboard summary endpoint`
  - `feat(app): add bulk snapshot entry UI`
  - `fix(app): guard chart rendering until data loads`
  - `chore(docker): add production compose for Pi`
  - `ci: add GitHub Actions workflow for ARM64 builds`
  - `docs: add Pi and Cloudflare setup instructions`

---

## Deployment

- **Local dev:** `just init` (Docker) or `just dev` (ng serve + Docker API)
- **CI/CD:** Push to `main` → GitHub Actions builds ARM64 images → pushes to GHCR
- **Production:** Pi runs `just deploy` to pull latest images from GHCR
- **Local Pi testing:** `just init` builds from source without GHCR