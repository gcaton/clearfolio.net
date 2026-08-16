# Next.js Rewrite — Slice 1: Foundation

**Date:** 2026-08-16
**Status:** Draft
**Branch:** `nextjs-rewrite`

## Problem

Clearfolio runs two stacks for a single-user, self-hosted app: a .NET 10 minimal API (~5.5k lines C#) and an Angular 21 SPA (~6.5k lines TypeScript), joined over HTTP and packaged together behind nginx in a three-stage Docker build. Two languages, two dependency trees, two test frameworks, two dev servers.

Neither stack is stale — Angular 21, ECharts 6 and .NET 10 are all current. The motivation is not escape from legacy; it is **consolidation onto one toolchain**, and this spec should be judged on that.

The rewrite is also the only practical opportunity to fix five schema decisions that are cheap now and unfixable later, and to close two product gaps in what is meant to be a net worth *tracker and projection* tool.

## Decomposition

The full rewrite is a greenfield product build, not a port. It is split into four slices, each independently runnable, each getting its own spec → plan → implementation cycle.

| Slice | Contents |
|---|---|
| **1. Foundation** (this spec) | App shell, full database schema + migrations + seed, passphrase auth, setup wizard, design system, test harness, Docker + CI |
| 2. Core CRUD | Assets, liabilities, snapshots, members, reference types; ownership and period logic |
| 3. Analytics | Dashboard, cashflow, projections, scenarios UI, ECharts |
| 4. Periphery | Settings, help, PDF export, onboarding, import/export, keyboard shortcuts, changelog |

Slice 1 defines the **complete** schema, including tables whose UI arrives in later slices. That is deliberate: schema is the thing that cannot be revised after release, so it is decided once, up front.

## Decisions Taken

### Data continuity: clean break

No migration path from existing databases. Anyone running the current image — including the author — starts fresh or hand-migrates.

This is cheaper than it appears: the current app has **no EF Core migrations at all**. `Program.cs` calls `EnsureCreated()` and patches the schema with hand-written `ALTER TABLE` statements. Nothing owns the schema today, so nothing is being discarded.

The rewrite uses **real migrations** (Drizzle Kit) from the first commit.

### Hosting: self-hosted Docker, unchanged

Single container on GHCR, SQLite file on a mounted `/data` volume. Not Vercel, not serverless. No database abstraction layer for hypothetical future hosts.

### API surface: collapsed

The current API has 63 endpoints. They exist because Angular needed HTTP to reach the server. In Next, reads happen in server components and mutations in server actions, so most of them stop existing.

Six route handlers are retained — **only** where a real HTTP surface is required:

| Route | Why it must be HTTP |
|---|---|
| `GET /api/health` | Docker `HEALTHCHECK` |
| `GET /api/quote/{symbol}` | External proxy; wants independent rate limiting |
| `GET /api/historical-returns/{symbol}` | External proxy; wants independent rate limiting |
| `GET /api/export` | File download |
| `POST /api/import` | File upload |
| `POST /api/logout` | Must clear a cookie and redirect from a plain `<form>` in the shell |

Everything else becomes a server action or a server-component query.

**Accepted cost:** no OpenAPI document, and no third party can drive the app over HTTP. Nothing does today. If an external consumer is ever needed, endpoints can be reintroduced over the same service layer.

## Architecture

The C# codebase already separates pure logic (`Helpers/`, `Services/`) from I/O (`Endpoints/`), which is why its tests exist at all. That shape is preserved exactly.

```
src/
  domain/            pure functions, zero I/O — the whole test surface
    money.ts         Cents branded type, arithmetic, formatting
    period.ts        FY/CY period arithmetic
    ownership.ts     share resolution and view filtering
    frequency.ts     frequency → annual multipliers
    projection.ts    compound / scenario / Monte Carlo engine
  db/
    schema.ts        Drizzle table definitions
    migrations/      Drizzle Kit output, committed
    seed.ts          asset types, liability types, baseline scenario
    client.ts        better-sqlite3 connection
  server/
    auth.ts          passphrase hashing, session create/validate/destroy
    session.ts       requireSession(), getHousehold()
    services/        db queries composed with domain functions
app/
  (setup)/           first-run wizard
  (auth)/            login
  (app)/             authenticated shell + feature pages
  api/               the five route handlers above
```

**Rule:** `src/domain/` imports nothing from `src/db/` or `src/server/`. Every value it needs is passed in. This is what makes the ported test suites meaningful.

## Stack

| Concern | Choice | Version at time of writing |
|---|---|---|
| Framework | Next.js, App Router | 16.3 |
| UI | React | 19.2 |
| Language | TypeScript, `strict: true` | 7.0 |
| Database | SQLite via `better-sqlite3` | — |
| ORM / migrations | Drizzle ORM + Drizzle Kit | 0.45 |
| Styling | Tailwind CSS | 4.3 |
| Components | shadcn/ui (Radix primitives) | — |
| Charts | ECharts | 6.1 |
| Validation | Zod | 4.x |
| Logging | Pino | — |
| Unit tests | Vitest | — |
| E2E tests | Playwright | — |
| Runtime | Node | 24 |

**Drizzle over Prisma:** Prisma ships a query-engine binary and requires a codegen step; Drizzle is types-only and pairs directly with the synchronous `better-sqlite3` driver, which suits a single-container deployment. Smaller image, no generate step in CI.

**`better-sqlite3` is synchronous**, which is correct here — one container, one user, no connection pool. It also means it cannot run on the edge runtime, which constrains middleware (see Auth).

## Schema

15 tables. Conventions applied throughout:

- **Money is integer cents.** Column suffix `_cents`, TypeScript branded type `Cents` so a bare `number` cannot be assigned by accident.
- **Rates and ratios stay REAL** — return rate, volatility, interest rate, inflation are not money.
- **Ownership shares are integer basis points** summing to 10000.
- **Timestamps are integer unix seconds**, not ISO-8601 strings. *Calendar dates* — `contribution_end_date`, `repayment_end_date` — remain ISO `YYYY-MM-DD` text, because they denote a day rather than an instant and are compared lexically against period boundaries.
- **Soft delete is preserved** (`is_active`), because historical trends depend on deleted entities remaining resolvable.
- IDs are UUID strings, as today.

### New and changed tables

**`ownership`** — new. Replaces `ownership_type`, `owner_member_id` and `joint_split` on `assets` and `liabilities`.

```
ownership(
  id            text primary key,
  entity_id     text not null,
  entity_type   text not null,          -- 'asset' | 'liability'
  member_id     text not null references household_members(id) on delete cascade,
  share_bp      integer not null        -- basis points; rows per entity sum to 10000
)
unique index on (entity_id, member_id)
index on (entity_id)
```

Sole ownership is one row at `share_bp = 10000`. A 60/40 joint asset is two rows.

**"Sums to 10000" is application-enforced, not a database constraint** — SQLite cannot express a cross-row sum check. It is asserted on every ownership write and covered by unit tests. Deleting a member cascades their ownership rows away, which can leave an entity under-allocated; the write path re-normalises remaining shares rather than leaving an inconsistent total.

This removes the two-person ceiling — the current `ApplyViewFilter` hardcodes the member tags `p1` and `p2` and computes joint ownership as "p1 receives the split, the other member receives the remainder". It also **deletes** that special-casing rather than porting it: the household view sums all shares, a member view sums that member's shares. Less code, not more.

**`snapshots`** — gains unit-based valuation and a real uniqueness constraint.

```
snapshots(
  id                    text primary key,
  household_id          text not null references households(id),
  entity_id             text not null,
  entity_type           text not null,          -- 'asset' | 'liability'
  period                text not null,          -- FY2026-Q1 etc.
  value_cents           integer not null,       -- authoritative
  units                 real,                   -- nullable; fractional allowed
  price_per_unit        real,                   -- nullable; NOT cents (see below)
  notes                 text,
  recorded_by           text not null references household_members(id),
  recorded_at           integer not null
)
unique index on (entity_id, period)
index on (household_id, period)
```

`value_cents` remains the stored source of truth. When `units` and `price_per_unit` are present they record *how* that figure was derived; they never recompute it. A "refresh from quote" action writes a **new** snapshot rather than mutating an existing one, so history never changes retroactively because a market moved.

**`price_per_unit` is REAL and deliberately not cents.** Integer cents cannot represent the prices this feature exists for: sub-dollar ASX stocks quote in tenths of a cent, and crypto prices run to many more decimal places. Yahoo returns `regularMarketPrice` as a float. Precision discipline still holds where it matters — `value_cents` is integer and authoritative, and `units × price_per_unit` is rounded to cents once, at write time, never recomputed on read.

The unique index makes the upsert invariant a database guarantee. Today `(entity_id, period)` is indexed but not unique, and uniqueness is enforced only by a read-then-write in `UpsertSnapshot`.

### CHECK constraints

**SQLite column types are affinities, not types.** An `integer` column happily
stores `1.5` as a REAL and `'hello'` as TEXT. So the "money is integer cents"
rule above is not self-enforcing — without explicit CHECKs it is a naming
convention, nothing more.

Every constraint SQLite *can* express is therefore declared:

- `typeof(<col>) = 'integer'` on every `_cents` column, tolerating NULL where
  the column is nullable
- `entity_type IN ('asset','liability')` on `snapshots`, `ownership` and
  `scenario_assumptions`
- `share_bp BETWEEN 0 AND 10000` on `ownership`

Only the cross-row ownership sum is left to application code, because SQLite
genuinely cannot express it.

This matters more than it looks: a nullable column can be added later with one
`ALTER TABLE ADD COLUMN`, but changing a CHECK makes the migration tool rebuild
the whole table and copy the data — against live user databases. Under a clean
break with no migration path, CHECKs are the one class of decision that must be
right on the first release.

### Polymorphic entity references

`entity_id` on `snapshots`, `ownership` and `scenario_assumptions` points at either an asset or a liability, discriminated by `entity_type`. **No foreign key is possible on a polymorphic column**, so referential integrity for these three columns is application-enforced, not database-enforced.

The alternative — splitting each into per-type tables (`asset_snapshots` / `liability_snapshots` and so on) — would buy real FKs at the cost of six tables instead of three and a union in every query that spans both types, which the latest-snapshot lookup and the projection input builder both do on every call. The polymorphic model is retained.

What this obliges:

- Every write path validates that `entity_id` resolves to a live entity of the declared `entity_type`, in the same transaction as the write.
- Soft delete means entities are never actually removed, so the common orphaning case does not arise. Hard deletes exist only in import/replace, which rebuilds all dependent rows.
- Service-layer tests cover the orphan cases directly, since the database will not.

**`scenarios` / `scenario_assumptions`** — new.

```
scenarios(
  id             text primary key,
  household_id   text not null references households(id),
  name           text not null,
  horizon_years  integer not null,
  inflation_rate real not null default 0,
  is_baseline    integer not null default 0,
  created_at     integer not null
)

scenario_assumptions(
  id                        text primary key,
  scenario_id               text not null references scenarios(id) on delete cascade,
  entity_id                 text not null,
  entity_type               text not null,          -- 'asset' | 'liability'
  return_rate               real,
  volatility                real,
  contribution_amount_cents integer,
  contribution_frequency    text,
  contribution_end_date     text,
  interest_rate             real,                   -- liability-side override
  repayment_amount_cents    integer,
  repayment_frequency       text,
  repayment_end_date        text
)
unique index on (scenario_id, entity_id)
```

The liability-side override columns matter because every `ProjectionEntity` in the domain layer carries an `interestRate`. Without them a scenario could only vary asset assumptions, which would leave debt paydown unmodellable — a hole in exactly the feature scenarios exist for.

Today, projection inputs live on the asset row and `BuildEntityInputs` reads them directly, so **an optimistic-versus-pessimistic comparison requires editing your actual holdings**. For an app whose stated second purpose is projection, that is the central design flaw.

Assets keep their contribution fields as the baseline plan of record. Assumption resolution order is **scenario override → asset baseline → asset-type default**. A seeded "Baseline" scenario with no overrides reproduces today's behaviour exactly.

This also gives `HistoricalReturnsService` output somewhere to land: the real CAGR and volatility it computes per symbol can populate a scenario's assumptions instead of being displayed as advice the user retypes.

**`sessions`** — new, extracted from the `app_settings` key-value bag.

```
sessions(
  token       text primary key,     -- 32 random bytes, hex
  created_at  integer not null,
  expires_at  integer not null
)
index on (expires_at)
```

Today sessions are rows keyed `session:<token>` in `app_settings`, and expiry cleanup scans every row whose key starts with `session:`. An indexed `expires_at` makes cleanup a single ranged delete.

**`app_settings`** is retained for the passphrase hash and miscellaneous key-value settings.

### Carried over with convention changes

`households`, `household_members`, `asset_types`, `liability_types`, `assets`, `liabilities`, `expense_categories`, `income_streams`, `expenses` keep their current fields, with:

- money columns renamed to `*_cents` and typed integer
- timestamp columns to integer unix seconds
- `currency` **dropped** from `assets`, `liabilities` and `snapshots`

The currency columns are decorative today — `base_currency` is stored on the household and per-row `currency` is written, but nothing anywhere converts between currencies. `households.base_currency` is retained and drives formatting; the per-row columns are removed rather than left as a false promise. Multi-currency support, if ever wanted, is a feature with an FX rate source, not a column.

### Seed data

The 15 asset types and 9 liability types carry over unchanged, including their AU-specific flags (`is_super`, `is_cgt_exempt`, `is_hecs`) and default return/volatility rates. A "Baseline" scenario is seeded per household at setup.

## Authentication

The current model is sound and is kept: a single household passphrase, an opaque session token, and an HttpOnly cookie. Two changes.

**Hashing: scrypt from `node:crypto`** instead of BCrypt — no native dependency, no extra package, and the clean break means no existing hashes need verifying.

The stored format **records the cost parameters**: `scrypt$<N>$<r>$<p>$<salt>$<hash>`, and verification derives using the values parsed from the stored string rather than the current constants. Without this, raising the cost later would require a permanent dual-path branch in verification to handle hashes written under the old defaults. Recording them costs one line while zero hashes exist in the world; it cannot be added for free afterwards. The cost stays at Node's defaults (N=16384, r=8, p=1) for now — recording the parameters buys the option to raise it, and exercising that option is a separate decision.

**Changing the passphrase revokes all existing sessions**, as removing it does. The realistic trigger for a rotation is suspected compromise, and a user who rotates reasonably believes access is revoked; without this a stolen cookie survives for the full session lifetime. The C# did not do this — it is a deliberate departure, not a port gap. Both the settings write and the session delete run in one transaction, so a partial failure cannot pair a new passphrase with old sessions.

**Sessions: the new table**, described above.

Flow:

1. `POST` login server action verifies the passphrase against the `app_settings` hash.
2. On success, generate 32 random bytes (`crypto.randomBytes`), store hex token with `expires_at = now + CLEARFOLIO_SESSION_DAYS` (default 30), delete expired rows.
3. Set cookie `clearfolio_session`: `HttpOnly`, `SameSite=Strict`, `Secure` when the request arrived over HTTPS (honouring `X-Forwarded-Proto`), `Path=/`.
4. Logout deletes the row and clears the cookie.

**Completing setup with a passphrase mints a session**, so the user lands on the dashboard rather than being asked to retype the passphrase they chose seconds earlier. This does not weaken the "no session without proof of passphrase" invariant: *choosing* a passphrase is proof of knowledge, strictly stronger than verifying one, and the invariant exists to stop an attacker minting a session — not the person who just chose the secret. Setup with **no** passphrase mints nothing; the app is open by design in that case.

Both session-minting call sites live in the action layer (`app/setup/actions.ts` and `app/login/actions.ts`), never in the service layer. `completeSetup` stays free of cookie and framework concerns, and the two places that can create a session sit side by side where they can be audited together.

**Passphrase is optional**, as today: if no hash is set, the app is unauthenticated. `CLEARFOLIO_RESET_PASSPHRASE=true` remains as the escape hatch, clearing the hash and all sessions at startup.

### No auth middleware

**There is no `middleware.ts` doing authentication.** Auth is resolved in the authenticated layout and in route handlers, both of which call `resolveAuthState(db, token)`.

Middleware defaults to the edge runtime, where `better-sqlite3` cannot load, so middleware could only check whether the session *cookie is present* — not whether it is valid. That check is actively wrong here: **when no passphrase is set the app is unauthenticated by design and no cookie exists**, so cookie-presence middleware would redirect a legitimately-authorised user to a login page that has no passphrase to accept. Next 16 does allow opting middleware into the Node runtime, but that only reintroduces a database read on every matched request to duplicate a decision the layout already makes correctly.

The layout is the single enforcement point. It handles all three auth states, including the passphrase-disabled case.

### Rate limiting

The two external-proxy route handlers keep fixed-window rate limiting (30 requests/minute per IP), implemented in-process. In-memory counters are acceptable for a single-container, single-user deployment.

Login rate limiting is **not implemented in this slice** — see the deferred list below.

## Visual Direction

Recorded here as text; the `frontend-design` skill is invoked at implementation time, not during design.

**Direction: quiet, dense, typographic** — an instrument panel, not a fintech landing page. The current app's PrimeNG look is not carried over.

- **Numerals are tabular** everywhere figures appear, so columns align and digits do not jitter as values update.
- **Restrained neutral palette with a single accent.** Colour carries meaning, not decoration.
- **Gain and loss are encoded by sign and position as well as colour**, so the reading survives dark mode and colour vision deficiency. Red/green alone is never the only signal.
- **Light and dark are both first-class**, defined as tokens, neither an afterthought.
- **Density over whitespace.** This is a tool for looking at numbers, and the current dashboard already fights for vertical space on mobile.

Chart styling follows the `dataviz` skill at implementation; ECharts is retained because it already does the work well.

## Testing

Test-driven. The ported C# suites are the acceptance criteria for the domain layer and are **written before** the code they cover.

| Layer | Tool | Content |
|---|---|---|
| Domain | Vitest | `PeriodHelperTests` (130 lines) and `ProjectionEngineTests` (305 lines) ported first. Then `money`, `ownership`, `frequency`. |
| Services | Vitest + in-memory SQLite | Query composition, session lifecycle, seed correctness |
| E2E | Playwright | Setup wizard → passphrase set → login → logout → session expiry |

The ownership rewrite needs tests the C# never had, because the behaviour is new: shares summing to 10000, household view equals the sum of member views, and a member with no share sees zero.

## Packaging

**Removed:** nginx, `src/app/nginx.conf`, `src/app/security-headers.conf`, `docker-entrypoint.sh`, and the three-stage build. Next serves both static and dynamic content, so the reverse proxy has no job.

**Image:** `node:24-alpine` builder → `node:24-alpine` runtime, using `output: 'standalone'`.

**Startup:** run Drizzle migrations to completion, then start the server. The container must not accept traffic against an unmigrated database.

**Unchanged:** `/data` volume, `DB_PATH` environment variable, `CLEARFOLIO_SESSION_DAYS`, `CLEARFOLIO_RESET_PASSPHRASE`, multiarch (amd64 + arm64) publishing to GHCR.

**Changed:** the container listens on **3000** rather than 80. README `docker run` examples updated accordingly.

**Security headers** previously set by nginx move to `next.config.ts` `headers()`.

**`just dev`** becomes a single `next dev` process rather than a three-pane tmux session coordinating `dotnet watch`, `ng serve` and a health-check wait loop. `just test` runs Vitest. `just migrate` runs Drizzle Kit.

**CI:** `.github/workflows/build.yml` replaces the .NET and Angular build steps with a Node build; GHCR publishing and multiarch matrix are retained.

## Branch Sequencing

Slice 1 rewrites the Dockerfile and CI but delivers only an empty shell, so **merging it to `main` on its own would ship a broken release**. Sequencing:

- Slices 1–3 accumulate on `nextjs-rewrite`. Nothing merges to `main` until feature parity.
- `src/api` and `src/app` remain on the branch throughout as the porting reference — the projection engine, dashboard aggregations and period logic are all read from the C# while being ported. They are deleted in the final parity commit, not before.
- The old stack stops being *built* in slice 1 (the Dockerfile and CI target Next only); it merely stops being deleted.
- One merge to `main`, one major version bump, one breaking-change release note covering the clean break.

This means `nextjs-rewrite` is a long-lived branch. Acceptable here: it is a single-author hobby repo with no concurrent feature work on `main`.

## Acceptance Criteria

Slice 1 is done when:

1. `docker build` produces an image that runs on amd64 and arm64.
2. Starting the container with an empty `/data` volume runs all migrations and serves the setup wizard.
3. The setup wizard captures household name, display name, currency, locale and period type, and creates the household, its members, the default expense categories and the seeded Baseline scenario. (Ownership rows are not created here — ownership attaches to assets and liabilities, which arrive in slice 2.)
4. A passphrase can be set during setup, and login/logout work with the session cookie surviving a container restart.
5. Visiting an authenticated route without a valid session redirects to login.
6. The full 15-table schema exists with all constraints, indexes and seed data.
7. `just test` passes, including the ported `period` and `projection` suites.
8. Playwright covers setup → login → logout.
9. The authenticated shell renders navigation, light/dark toggle and an empty state in the new visual direction.

## Out of Scope

Deferred to slices 2–4, and explicitly **not** built here despite their tables existing: assets, liabilities and snapshots CRUD; the dashboard and all charts; cashflow; the projections UI; settings; help; PDF export; onboarding checklist; keyboard shortcuts; import/export; changelog generation.

**Login rate limiting is also deferred**, to the slice that introduces the external quote proxies — the fixed-window in-process limiter is built once, for both the proxy routes and the login route, rather than twice. In the interim, `scrypt`-based passphrase verification (~24ms per attempt) imposes a meaningful floor on brute-force attempt rate even without an explicit limiter.

Also out of scope permanently for this slice: currency conversion, an OpenAPI document, and any migration path from existing databases.

## Risks

**Yahoo Finance is an undocumented, unauthenticated endpoint** powering both `/api/quote` and historical returns. It can break or rate-limit without notice. This is a pre-existing fragility carried over deliberately, not introduced here. The 24-hour cache on historical returns is retained. No fix is proposed; it is noted so it is not mistaken for a regression when it eventually breaks.

**The clean break is a breaking change to a published image.** `ghcr.io/gcaton/clearfolio` is public and the README documents `docker run` against it. The rewrite needs a major version bump and a release note stating that existing volumes are not readable. This is an artifact to produce, not a decision to revisit.

**Slice 1 is larger than a foundation slice normally is**, because items 6 and 7 (unit-based valuation and scenarios) pull data-model work forward from slice 3. This is deliberate — schema cannot be revised after a clean-break release — but it means slice 1 carries design weight that its name understates.

**Rewriting a working application is a real risk in itself.** The current app is functional and its stack is current. The justification is toolchain consolidation and a fixable set of schema decisions, and that justification should be revisited if slice 1 substantially overruns.
