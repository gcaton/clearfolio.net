# clearfolio.net

Self-hosted household net worth tracker. Record periodic snapshots of assets and liabilities, track growth over time, and compare positions across household members.

Built to run on a Raspberry Pi 5 behind Cloudflare Tunnel.

## Tech Stack

| Layer | Technology |
|---|---|
| API | .NET 10, minimal APIs, EF Core 10, SQLite |
| Frontend | Angular 21, PrimeNG, Apache ECharts |
| Auth | Cloudflare Access (Google OAuth) |
| Hosting | Raspberry Pi 5, Docker, Cloudflare Tunnel |
| Backups | Litestream → Cloudflare R2 |
| CI/CD | GitHub Actions → GHCR → Pi pull-based deploy |

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
│   ├── docker-compose.yml          # Local dev
│   └── docker-compose.prod.yml     # Production (Pi)
├── .github/workflows/
│   └── build.yml                   # CI: build ARM64 images → GHCR
├── src/
│   ├── api/                        # .NET 10 solution
│   │   ├── Clearfolio.sln
│   │   └── Clearfolio.Api/
│   │       ├── Data/               # DbContext, migrations
│   │       ├── Models/             # EF Core entities
│   │       ├── DTOs/               # Request/response shapes
│   │       ├── Endpoints/          # Minimal API route handlers
│   │       ├── Helpers/            # PeriodHelper
│   │       └── Middleware/         # Cloudflare JWT auth
│   └── app/                        # Angular 21
│       └── src/app/
│           ├── core/               # API service, auth, view state
│           ├── shared/             # Currency display, period selector
│           └── features/           # Dashboard, assets, liabilities,
│                                   # snapshots, settings
├── Justfile                        # Task runner
└── claude.md                       # AI assistant context
```

## API Endpoints

All endpoints require Cloudflare Access JWT (bypassed in dev mode with a mock user).

| Group | Endpoints |
|---|---|
| Reference | `GET /api/asset-types`, `GET /api/liability-types` |
| Household | `GET /api/household`, `PUT /api/household` |
| Members | `GET /api/members`, `GET /api/members/me`, `POST /api/members`, `PUT /api/members/{id}` |
| Assets | `GET /api/assets`, `POST`, `PUT /api/assets/{id}`, `DELETE` |
| Liabilities | `GET /api/liabilities`, `POST`, `PUT /api/liabilities/{id}`, `DELETE` |
| Snapshots | `GET /api/snapshots`, `POST` (upsert), `PUT /api/snapshots/{id}`, `DELETE`, `GET /api/periods` |
| Dashboard | `GET /api/dashboard/summary`, `/trend`, `/composition`, `/members`, `/super-gap` |
| Quotes | `GET /api/quote/{symbol}` (ASX live price lookup) |

## Features

- **Dashboard** — net worth stat cards, trend line chart, asset composition donut, liquidity/growth/debt quality breakdowns, member comparison, super gap analysis
- **Assets & Liabilities** — CRUD with type classification, sole/joint ownership with configurable split, optional ASX symbol with live price lookup
- **Snapshots** — per-entity quarterly value recording with upsert semantics, bulk entry mode for backfilling historical data
- **View Toggle** — switch between household, P1, and P2 views; joint assets split by configured ratio
- **Period System** — supports both Australian Financial Year (FY) and Calendar Year (CY) conventions with quarter granularity
- **Seed Data** — 13 asset types and 9 liability types pre-loaded with Australian financial categories

## Raspberry Pi Setup

### Prerequisites

- Raspberry Pi 5 running Raspberry Pi OS (64-bit / aarch64)
- Docker and Docker Compose installed
- A domain name (e.g. `clearfolio.net`) with DNS managed by Cloudflare
- A GitHub account with the repo pushed (for GHCR image pulls)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

### 2. Install Just

```bash
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
```

### 3. Create data directory

```bash
sudo mkdir -p /var/data/clearfolio
sudo chown $USER:$USER /var/data/clearfolio
```

### 4. Clone and configure

```bash
git clone https://github.com/<you>/clearfolio.net.git
cd clearfolio.net

# Create production env file
cat > .docker/.env << 'EOF'
GITHUB_OWNER=<your-github-username>
CF_TEAM_NAME=<your-cloudflare-team>
CF_ACCESS_AUD=<your-access-app-aud>
EOF
```

### 5. Authenticate to GHCR

Create a GitHub Personal Access Token at https://github.com/settings/tokens with `read:packages` scope, then:

```bash
echo <YOUR_PAT> | docker login ghcr.io -u <your-github-username> --password-stdin
```

### 6. Deploy

```bash
just deploy
```

The API will auto-migrate the database and seed reference data on first start.

### Production commands

```
just deploy         # Pull latest images and restart
just prod-down      # Stop production services
just prod-logs      # Follow production logs
```

### Updating

Push to `main` → GitHub Actions builds ARM64 images → pushes to GHCR. Then on the Pi:

```bash
just deploy
```

---

## Cloudflare Setup

Clearfolio uses Cloudflare for DNS, tunnelling, and authentication. No ports are exposed on the Pi — all traffic flows through the tunnel.

### 1. Add your domain to Cloudflare

If not already done, add your domain (e.g. `clearfolio.net`) to Cloudflare and update your registrar's nameservers to Cloudflare's.

### 2. Install cloudflared on the Pi

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate (opens a browser URL to copy)
cloudflared tunnel login
```

### 3. Create a tunnel

```bash
cloudflared tunnel create clearfolio
```

Note the tunnel ID and credentials file path from the output.

### 4. Configure the tunnel

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: clearfolio.net
    service: http://localhost:4200
  - hostname: api.clearfolio.net
    service: http://localhost:5000
  - service: http_status:404
```

Or if you want the app to handle API proxying (single hostname):

```yaml
ingress:
  - hostname: clearfolio.net
    service: http://localhost:4200
  - service: http_status:404
```

The nginx container already proxies `/api/*` to the API container internally.

### 5. Create DNS records

```bash
cloudflared tunnel route dns clearfolio clearfolio.net
```

### 6. Run cloudflared as a service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### 7. Set up Cloudflare Access (authentication)

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Access** → **Applications**
2. Click **Add an application** → **Self-hosted**
3. Configure:
   - **Application name:** Clearfolio
   - **Session duration:** 24 hours (or your preference)
   - **Application domain:** `clearfolio.net`
4. Add a policy:
   - **Policy name:** Allowed Users
   - **Action:** Allow
   - **Include:** Emails — add the email addresses of household members
   - **Identity providers:** Google (or your preferred provider)
5. After saving, note the **Application Audience (AUD) tag** — you need this for the API config

### 8. Configure Google OAuth (if not already set up)

1. In Zero Trust dashboard → **Settings** → **Authentication** → **Login methods**
2. Click **Add new** → **Google**
3. Follow the prompts to create OAuth credentials in Google Cloud Console:
   - Create a project at https://console.cloud.google.com/
   - Go to **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
   - Set authorized redirect URI to `https://<your-team>.cloudflareaccess.com/cdn-cgi/access/callback`
4. Enter the Client ID and Secret in Cloudflare

### 9. Update the Pi environment

Add the Cloudflare values to your `.docker/.env`:

```bash
CF_TEAM_NAME=<your-team-name>       # From Zero Trust dashboard URL
CF_ACCESS_AUD=<application-aud>     # From the Access application you created
```

Then redeploy:

```bash
just deploy
```

### How authentication works

1. User visits `clearfolio.net`
2. Cloudflare Access intercepts the request — if not authenticated, redirects to Google OAuth
3. After login, Cloudflare injects a `Cf-Access-Jwt-Assertion` header on every request
4. The API middleware validates this JWT and extracts the user's email
5. First-time users are auto-provisioned as household members

---

## Litestream Backup (Optional)

Litestream continuously replicates the SQLite database to Cloudflare R2 for disaster recovery.

### 1. Create an R2 bucket

In Cloudflare dashboard → **R2** → **Create bucket** (e.g. `clearfolio-backup`). Create an API token with read/write access.

### 2. Install Litestream on the Pi

```bash
wget https://github.com/benbjohnson/litestream/releases/latest/download/litestream-*-linux-arm64.deb
sudo dpkg -i litestream-*-linux-arm64.deb
```

### 3. Configure

Create `/etc/litestream.yml`:

```yaml
dbs:
  - path: /var/data/clearfolio/clearfolio.db
    replicas:
      - type: s3
        endpoint: https://<account-id>.r2.cloudflarestorage.com
        bucket: clearfolio-backup
        path: replica
        access-key-id: <R2_ACCESS_KEY>
        secret-access-key: <R2_SECRET_KEY>
```

### 4. Run as a service

```bash
sudo systemctl enable litestream
sudo systemctl start litestream
```

Litestream will continuously replicate WAL changes. To restore from backup:

```bash
sudo systemctl stop clearfolio  # stop the API first
litestream restore -o /var/data/clearfolio/clearfolio.db /var/data/clearfolio/clearfolio.db
```
