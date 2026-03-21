# clearfolio.net

Self-hosted household net worth tracker. Record periodic snapshots of assets and liabilities, track growth over time, and compare positions across household members.

## Quick Start

```bash
docker run -d -p 8080:80 -v clearfolio-data:/data ghcr.io/gcaton/clearfolio
```

Then open http://localhost:8080 and complete the first-run setup wizard (household name, display name, currency, period type).

## Tech Stack

| Layer | Technology |
|---|---|
| API | .NET 10, minimal APIs, EF Core 10, SQLite |
| Frontend | Angular 21, PrimeNG, Apache ECharts |
| Hosting | Docker (amd64 + arm64) |
| CI/CD | GitHub Actions → GHCR |

## Features

- **Dashboard** — net worth stat cards, trend line chart, asset composition donut, liquidity/growth/debt quality breakdowns, member comparison, super gap analysis
- **Assets & Liabilities** — CRUD with type classification, sole/joint ownership with configurable split, optional ASX symbol with live price lookup
- **Snapshots** — per-entity quarterly value recording with upsert semantics, bulk entry mode for backfilling historical data
- **View Toggle** — switch between household, P1, and P2 views; joint assets split by configured ratio
- **Period System** — supports both Australian Financial Year (FY) and Calendar Year (CY) conventions with quarter granularity
- **Seed Data** — 13 asset types and 9 liability types pre-loaded with Australian financial categories

## Local Development

**Prerequisites:** .NET 10 SDK, Node.js 24+, Docker

```bash
# Clone and start
git clone https://github.com/<you>/clearfolio.net.git
cd clearfolio.net

# Start API + app containers (builds from source)
just init

# Or run Angular dev server with hot reload (proxies /api to Docker API)
just dev
```

The API runs on `localhost:5000`, the app on `localhost:4200`.

### Available Commands

```
just              # Show all commands
just init         # Tear down containers, rebuild from scratch
just up           # Start local services
just down         # Stop local services
just logs         # Follow service logs
just rebuild api  # Rebuild a single service
just dev          # Angular dev server with API proxy
```

## Project Structure

```
clearfolio.net/
├── .docker/
│   └── docker-compose.yml          # Local dev
├── .github/workflows/
│   └── build.yml                   # CI: build multi-arch images → GHCR
├── src/
│   ├── api/                        # .NET 10 solution
│   │   ├── Clearfolio.sln
│   │   └── Clearfolio.Api/
│   │       ├── Data/               # DbContext, migrations
│   │       ├── Models/             # EF Core entities
│   │       ├── DTOs/               # Request/response shapes
│   │       ├── Endpoints/          # Minimal API route handlers (incl. AuthEndpoints)
│   │       ├── Helpers/            # PeriodHelper
│   │       └── Middleware/         # LocalAuthMiddleware
│   └── app/                        # Angular 21
│       └── src/app/
│           ├── core/               # API service, auth, view state
│           ├── shared/             # Currency display, period selector
│           └── features/           # Dashboard, assets, liabilities,
│                                   # snapshots, settings
├── Dockerfile                      # Single multi-stage build (API + frontend + nginx)
├── Justfile                        # Task runner
└── claude.md                       # AI assistant context
```

## API Endpoints

All endpoints except `/api/auth/*` require setup to be complete. All data queries are scoped to the single household.

| Group | Endpoints |
|---|---|
| Auth | `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`, `PUT /api/auth/passphrase`, `DELETE /api/auth/passphrase` |
| Reference | `GET /api/asset-types`, `GET /api/liability-types` |
| Household | `GET /api/household`, `PUT /api/household` |
| Members | `GET /api/members`, `GET /api/members/me`, `POST /api/members`, `PUT /api/members/{id}` |
| Assets | `GET /api/assets`, `POST`, `PUT /api/assets/{id}`, `DELETE` |
| Liabilities | `GET /api/liabilities`, `POST`, `PUT /api/liabilities/{id}`, `DELETE` |
| Snapshots | `GET /api/snapshots`, `POST` (upsert), `PUT /api/snapshots/{id}`, `DELETE`, `GET /api/periods` |
| Dashboard | `GET /api/dashboard/summary`, `/trend`, `/composition`, `/members`, `/super-gap` |
| Quotes | `GET /api/quote/{symbol}` (ASX live price lookup) |

## Self-Hosting

### Prerequisites

- Any machine running Docker (amd64 or arm64)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Run Clearfolio

```bash
docker run -d \
  --name clearfolio \
  --restart unless-stopped \
  -p 8080:80 \
  -v clearfolio-data:/data \
  ghcr.io/gcaton/clearfolio
```

### 3. Open your browser

Navigate to http://localhost:8080 (or your server's IP/hostname on port 8080) and complete the first-run setup wizard.

### Optional: passphrase protection

Add a passphrase from **Settings → Security**. Once set, all sessions will require it to log in.

### Environment variables

| Variable | Description |
|---|---|
| `CLEARFOLIO_RESET_PASSPHRASE` | Set to `true` to clear the passphrase on next startup |
| `CLEARFOLIO_SESSION_DAYS` | Session lifetime in days (default: 30) |

To reset a forgotten passphrase:

```bash
docker run --rm \
  -v clearfolio-data:/data \
  -e CLEARFOLIO_RESET_PASSPHRASE=true \
  ghcr.io/gcaton/clearfolio
```

### Updating

Pull the latest image and recreate the container:

```bash
docker pull ghcr.io/gcaton/clearfolio
docker stop clearfolio && docker rm clearfolio
docker run -d \
  --name clearfolio \
  --restart unless-stopped \
  -p 8080:80 \
  -v clearfolio-data:/data \
  ghcr.io/gcaton/clearfolio
```

The database is stored in the `clearfolio-data` volume and persists across updates.
