compose := ".docker/docker-compose.yml"
compose_prod := ".docker/docker-compose.prod.yml"

# Show available commands
default:
    @echo ""
    @echo "  ┌─────────────────────────────┐"
    @echo "  │       clearfolio.net        │"
    @echo "  └─────────────────────────────┘"
    @echo ""
    @just --list --unsorted
    @echo ""

# ── Local Development ──────────────────────────

# Tear down all containers, volumes, and rebuild from scratch
init:
    docker compose -f {{compose}} down -v
    docker compose -f {{compose}} up -d --build
    @echo "Waiting for services to start..."
    @sleep 5
    docker compose -f {{compose}} logs --tail 5

# Start all local services
up:
    docker compose -f {{compose}} up -d

# Stop all local services
down:
    docker compose -f {{compose}} down

# Show service logs (follow)
logs *args='':
    docker compose -f {{compose}} logs -f {{args}}

# Rebuild and restart a single service
rebuild service:
    docker compose -f {{compose}} up -d --build {{service}}

# Run Angular dev server locally (with API proxy)
dev:
    cd src/app && npx ng serve

# ── Production (Pi) ───────────────────────────

# Pull latest images and restart (run on Pi)
deploy:
    docker compose -f {{compose_prod}} pull
    docker compose -f {{compose_prod}} up -d
    @echo "Deployed. Waiting for services..."
    @sleep 3
    docker compose -f {{compose_prod}} logs --tail 5

# Stop production services (run on Pi)
prod-down:
    docker compose -f {{compose_prod}} down

# Show production logs (run on Pi)
prod-logs *args='':
    docker compose -f {{compose_prod}} logs -f {{args}}

# Login to GHCR (run once on Pi)
ghcr-login:
    @echo "Create a PAT at https://github.com/settings/tokens with read:packages scope"
    @echo "Then run: echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin"
