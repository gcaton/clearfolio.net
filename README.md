# clearfolio.net
[![Build and Push](https://github.com/gcaton/clearfolio.net/actions/workflows/build.yml/badge.svg)](https://github.com/gcaton/clearfolio.net/actions/workflows/build.yml)

> **Disclaimer:** This is a personal hobby project, not production-grade financial software. It is not intended for professional use, financial advice, or any scenario where data accuracy or availability is critical. Use at your own risk — no warranties, no guarantees, no support obligations.

Self-hosted household net worth tracker. Record periodic snapshots of assets and liabilities, track growth over time, and compare positions across household members.

> **Breaking change in v2.0:** Clearfolio has been rewritten on Next.js. The database schema is not compatible with v1.x — v1 data cannot be read by v2, and there is no conversion path. v2 therefore uses a new Docker volume name, `clearfolio-data-v2`, instead of v1's `clearfolio-data`. This is deliberate: the old `clearfolio-data` volume is never touched by v2 and is left exactly as it was, so if you need your v1 data back you can still start the old (v1) image against it. Just don't point a v2 container at a `clearfolio-data` volume that has v1 data in it — migrations will run against it and it will not go well.

## Quick Start

```bash
docker run -d -p 8080:3000 -v clearfolio-data-v2:/data ghcr.io/gcaton/clearfolio
```

Then open http://localhost:8080 and complete the first-run setup wizard (household name, display name, currency, period type).

## Tech Stack

| Layer | Technology |
|---|---|
| App | Next.js 16, React 19, Drizzle ORM, SQLite |
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

**Prerequisites:** Node.js 24+, Docker

```bash
# Clone and set up the Next.js app
git clone https://github.com/<you>/clearfolio.net.git
cd clearfolio.net
just init

# Run the dev server (http://localhost:3000)
just web-dev

# Or build and run the container instead
just docker-init
```

### Available Commands

```
just                     # Show all commands
just init                # Set up the Next.js app from a clean checkout, then verify it
just web-install         # Install Next.js app dependencies
just web-migrate-generate # Generate a Drizzle migration from schema changes
just web-migrate         # Apply pending migrations
just web-dev             # Run the Next.js dev server, migrating first
just web-test            # Run unit tests
just web-typecheck       # Type-check the Next.js app
just web-build           # Build the Next.js app for production
just web-check           # Type-check and run unit tests
just test-e2e            # Run the end-to-end tests (Playwright)
just docker-init         # Tear down existing container, rebuild image, and start fresh
just up                  # Start the container
just down                # Stop the container
just logs                # Follow container logs
just rebuild             # Rebuild image and restart container
```

## Project Structure

```
clearfolio.net/
├── .github/workflows/
│   └── build.yml                   # CI: unit tests + build multi-arch images → GHCR
├── src/
│   ├── web/                        # Next.js 16 app (the shipping app)
│   │   ├── app/                    # Routes (App Router)
│   │   ├── src/
│   │   │   ├── db/                 # Drizzle schema, client, migrations, seed
│   │   │   ├── domain/             # Domain logic
│   │   │   └── server/             # Auth, sessions
│   │   └── scripts/start.sh        # Container entrypoint: migrate, then serve
│   ├── api/                        # .NET 10 API — porting reference only, not built
│   └── app/                        # Angular 21 frontend — porting reference only, not built
├── Dockerfile                      # Single-stage Next.js build (standalone output)
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
  -p 8080:3000 \
  -v clearfolio-data-v2:/data \
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
  - "traefik.http.services.clearfolio.loadbalancer.server.port=3000"
```

### Optional: passphrase protection

Set a passphrase during the first-run setup wizard. Once set, all sessions will require it to log in. (A way to add or change a passphrase after setup, from a Settings screen, is planned for a later release — for now, the passphrase can only be set during initial setup.)

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
  -v clearfolio-data-v2:/data \
  -e CLEARFOLIO_RESET_PASSPHRASE=true \
  ghcr.io/gcaton/clearfolio

# 3. Start the original container (passphrase is now cleared)
docker start clearfolio
```

Once cleared, the app runs unauthenticated again (as it did before you first set a passphrase). A way to set a new passphrase after this point, from a Settings screen, is planned for a later release.

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
  -p 8080:3000 \
  -v clearfolio-data-v2:/data \
  ghcr.io/gcaton/clearfolio

# 3. Verify
docker logs clearfolio
```

The database is stored in the `clearfolio-data-v2` volume and persists across updates. If a migration fails, the container will fail to start — check `docker logs clearfolio` for details, restore your backup, and report the issue.

To roll back to a previous version:

```bash
docker stop clearfolio && docker rm clearfolio
docker cp ./clearfolio-backup-2026-03-21.db clearfolio:/data/clearfolio.db
docker run -d \
  --name clearfolio \
  --restart unless-stopped \
  -p 8080:3000 \
  -v clearfolio-data-v2:/data \
  ghcr.io/gcaton/clearfolio:<previous-version>
```
