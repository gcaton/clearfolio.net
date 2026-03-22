# Clearfolio — Household Net Worth Tracker

## Project overview

Self-hosted household net worth tracker running in a single Docker image. Local auth with optional passphrase. No external auth dependencies. Users record periodic snapshots of assets and liabilities across defined categories, with analytical views tracking growth, composition, and household vs individual positions over time.

Domain: `clearfolio.net`

---

## Tech stack

| Layer | Technology |
|---|---|
| API | .NET 10 — minimal API style (not controller-based) |
| ORM | EF Core 10 with SQLite provider |
| Database | SQLite (single file) |
| Frontend | Angular 21 (standalone components, signals-based state) |
| UI components | PrimeNG (latest compatible with Angular 21) |
| Charting | Apache ECharts via ngx-echarts |
| Auth | Local auth with optional passphrase (no external auth dependencies) |
| Hosting | Docker (amd64 + arm64), single image |
| Task runner | Justfile |

---

## Repository structure

```
clearfolio/
├── CLAUDE.md                        ← this file
├── Justfile                         ← build, deploy, migrate recipes
├── README.md
├── Dockerfile                       ← single multi-stage build (API + frontend + nginx)
├── api/                             ← .NET 10 solution
│   ├── Clearfolio.sln
│   └── Clearfolio.Api/
│       ├── Program.cs
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── Middleware/
│       │   └── LocalAuthMiddleware.cs
│       ├── Data/
│       │   ├── ClearfolioDbContext.cs
│       │   └── Migrations/
│       ├── Models/                  ← EF Core entities
│       ├── DTOs/                    ← Request/response shapes
│       ├── Endpoints/
│       │   ├── AuthEndpoints.cs
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
            │   ├── auth/            ← auth status, current user signal
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
/data/clearfolio.db   (inside the container, mounted from the clearfolio-data volume)
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
| email | TEXT | Nullable. Not from JWT. Not unique. |
| display_name | TEXT | e.g. "Greg" |
| member_tag | TEXT | `p1`, `p2` etc. |
| is_primary | INTEGER | First to set up household = 1 |
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
1. Angular app calls `GET /api/auth/status` on startup
2. Response indicates one of: `setup_required`, `login_required`, `authenticated`
3. App routes accordingly: setup wizard, login page, or dashboard
4. `LocalAuthMiddleware` enforces auth on all non-`/api/auth/*` endpoints — returns 401 if session is absent or invalid
5. Optional passphrase: if configured, `POST /api/auth/login` requires it. If not configured, login is passwordless.
6. Sessions are cookie-based with configurable lifetime (`CLEARFOLIO_SESSION_DAYS`, default 30)

### LocalAuthMiddleware responsibilities
- Skip auth check for `/api/auth/*` routes
- Validate session cookie on all other API routes — return 401 if absent or expired
- Set `HttpContext.Items["HouseholdMember"]` for use by endpoint handlers

### Auth endpoints
```
GET    /api/auth/status        ← setup_required | login_required | authenticated
POST   /api/auth/login         ← submit passphrase (if configured), start session
POST   /api/auth/logout        ← clear session
PUT    /api/auth/passphrase    ← set or change passphrase
DELETE /api/auth/passphrase    ← remove passphrase (open access)
```

### Environment variables
```
CLEARFOLIO_RESET_PASSPHRASE=true   # clear passphrase on next startup
CLEARFOLIO_SESSION_DAYS=30         # session lifetime in days
```

---

## API endpoints

All endpoints are prefixed `/api`. All except `/api/auth/*` require a valid session (enforced by `LocalAuthMiddleware`). All data queries are scoped to the single household.

### Auth
```
GET    /api/auth/status
POST   /api/auth/login
POST   /api/auth/logout
PUT    /api/auth/passphrase
DELETE /api/auth/passphrase
```

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
- **Auth-aware routing** — app calls `GET /api/auth/status` on startup. Routes to setup wizard, login page, or dashboard based on response.

### Routing structure
```
/                  → redirect to /dashboard
/setup             → SetupComponent (first-run wizard)
/login             → LoginComponent (passphrase entry)
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
just init          # tear down containers, rebuild image, start fresh
just up            # start the container
just down          # stop the container
just rebuild       # rebuild image and restart container
just logs          # follow container logs
just dev           # start API + Angular dev servers in tmux panes (requires tmux)
just dev-api       # run API dev server (dotnet watch)
just dev-app       # run Angular dev server with API proxy
just test          # run .NET tests
just migrate <Name>  # add a new EF Core migration
just migrate-apply   # apply pending migrations (local dev only)
just changelog     # generate changelog.json from conventional commits
```

### Docker image
Single multi-stage `Dockerfile` at repo root builds the API, Angular app, and bundles both behind nginx. Published to GHCR as `ghcr.io/gcaton/clearfolio` for amd64 and arm64.

### Environment variables (production container)
```
ASPNETCORE_ENVIRONMENT=Production
CLEARFOLIO_RESET_PASSPHRASE=true   # optional — clears passphrase on startup then exits
CLEARFOLIO_SESSION_DAYS=30         # optional — session cookie lifetime
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
- **SQLite not Postgres** — appropriate for a single-household personal app. Back up the volume to protect your data.
- **Optional passphrase only** — no user accounts, no OAuth. The app is single-household; auth is a simple session gate.
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

- **Local dev:** `just init` (Docker) or `just dev` (API + Angular in tmux panes)
- **CI/CD:** Push to `main` → GitHub Actions builds multi-arch (amd64 + arm64) image → pushes to GHCR
- **Production:** `docker pull ghcr.io/gcaton/clearfolio && docker run ...` on any Docker host