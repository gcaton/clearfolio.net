# clearfolio.net

> **Disclaimer:** This is a personal hobby project, not production-grade financial software. It is not intended for professional use, financial advice, or any scenario where data accuracy or availability is critical. Use at your own risk — no warranties, no guarantees, no support obligations.

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

# Build image and start container
just init

# Or run Angular dev server with hot reload (proxies /api to Docker container)
just dev
```

The app runs on `localhost:4200`.

### Available Commands

```
just              # Show all commands
just init         # Tear down container, rebuild image from scratch
just up           # Start the container
just down         # Stop the container
just logs         # Follow container logs
just rebuild      # Rebuild image and restart container
just dev          # Angular dev server with API proxy
```

## Project Structure

```
clearfolio.net/
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

### Optional: HTTPS with a reverse proxy

Clearfolio serves HTTP internally. For HTTPS, place a reverse proxy in front — this is the standard approach for self-hosted apps.

**Caddy** (automatic Let's Encrypt):

```Caddyfile
clearfolio.example.com {
    reverse_proxy localhost:8080
}
```

**Traefik** (Docker labels):

```yaml
labels:
  - "traefik.http.routers.clearfolio.rule=Host(`clearfolio.example.com`)"
  - "traefik.http.routers.clearfolio.tls.certresolver=letsencrypt"
  - "traefik.http.services.clearfolio.loadbalancer.server.port=80"
```

### Optional: passphrase protection

Add a passphrase from **Settings → Security**. Once set, all sessions will require it to log in.

There is no email or account recovery — if you forget your passphrase, see [Forgot your passphrase?](#forgot-your-passphrase) below.

### Environment variables

| Variable | Description |
|---|---|
| `CLEARFOLIO_RESET_PASSPHRASE` | Set to `true` to clear the passphrase on next startup |
| `CLEARFOLIO_SESSION_DAYS` | Session lifetime in days (default: 30) |

### Forgot your passphrase?

Since Clearfolio is self-hosted with no email or external auth, the only recovery method is to reset the passphrase using a one-time environment variable. This clears the passphrase and all sessions — your data is not affected.

```bash
# 1. Stop the running container
docker stop clearfolio

# 2. Run a temporary container that resets the passphrase
docker run --rm \
  -v clearfolio-data:/data \
  -e CLEARFOLIO_RESET_PASSPHRASE=true \
  ghcr.io/gcaton/clearfolio

# 3. Start the original container (passphrase is now cleared)
docker start clearfolio
```

You can then set a new passphrase from **Settings → Security**.

### Backups

All data lives in a single SQLite file inside the Docker volume. Back it up by copying it out:

```bash
# One-off backup
docker cp clearfolio:/data/clearfolio.db ./clearfolio-backup-$(date +%F).db
```

To automate daily backups with cron:

```bash
# Add to crontab -e
0 3 * * * docker cp clearfolio:/data/clearfolio.db /path/to/backups/clearfolio-$(date +\%F).db
```

To restore from a backup:

```bash
docker stop clearfolio
docker cp ./clearfolio-backup-2026-03-21.db clearfolio:/data/clearfolio.db
docker start clearfolio
```

Clearfolio also has built-in JSON export/import via **Settings → Data**. The JSON export is portable and human-readable — useful for migrating between installations or inspecting your data outside the app.

### Updating

Database migrations run automatically on startup — your schema is always brought up to date when a new version starts. Your existing data is preserved.

**Before updating**, back up your database (see above). If anything goes wrong, you can restore the backup and revert to the previous image.

```bash
# 1. Back up
docker cp clearfolio:/data/clearfolio.db ./clearfolio-backup-$(date +%F).db

# 2. Pull and recreate
docker pull ghcr.io/gcaton/clearfolio
docker stop clearfolio && docker rm clearfolio
docker run -d \
  --name clearfolio \
  --restart unless-stopped \
  -p 8080:80 \
  -v clearfolio-data:/data \
  ghcr.io/gcaton/clearfolio

# 3. Verify
docker logs clearfolio
```

The database is stored in the `clearfolio-data` volume and persists across updates. If a migration fails, the container will fail to start — check `docker logs clearfolio` for details, restore your backup, and report the issue.

To roll back to a previous version:

```bash
docker stop clearfolio && docker rm clearfolio
docker cp ./clearfolio-backup-2026-03-21.db clearfolio:/data/clearfolio.db
docker run -d \
  --name clearfolio \
  --restart unless-stopped \
  -p 8080:80 \
  -v clearfolio-data:/data \
  ghcr.io/gcaton/clearfolio:<previous-version>
```
