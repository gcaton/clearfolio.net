compose := ".docker/docker-compose.yml"
compose_prod := ".docker/docker-compose.prod.yml"

# Show available commands
[private]
default:
    @just --list --unsorted --list-heading $'\n  \033[1;36mclearfolio.net\033[0m\n\n'

# Tear down all containers, volumes, and rebuild from scratch
[group('dev')]
init:
    docker compose -f {{compose}} down -v
    docker compose -f {{compose}} up -d --build
    @echo "Waiting for services to start..."
    @sleep 5
    docker compose -f {{compose}} logs --tail 5

# Start all local services
[group('dev')]
up:
    docker compose -f {{compose}} up -d

# Stop all local services
[group('dev')]
down:
    docker compose -f {{compose}} down

# Show service logs (follow)
[group('dev')]
logs *args='':
    docker compose -f {{compose}} logs -f {{args}}

# Rebuild and restart a single service
[group('dev')]
rebuild service:
    docker compose -f {{compose}} up -d --build {{service}}

# Run Angular dev server locally (with API proxy)
[group('dev')]
dev:
    cd src/app && npx ng serve

# Pull latest images and restart (run on Pi)
[group('prod')]
deploy:
    docker compose -f {{compose_prod}} pull
    docker compose -f {{compose_prod}} up -d
    @echo "Deployed. Waiting for services..."
    @sleep 3
    docker compose -f {{compose_prod}} logs --tail 5

# Stop production services (run on Pi)
[group('prod')]
prod-down:
    docker compose -f {{compose_prod}} down

# Show production logs (run on Pi)
[group('prod')]
prod-logs *args='':
    docker compose -f {{compose_prod}} logs -f {{args}}

# Login to GHCR (run once on Pi)
[group('prod')]
ghcr-login:
    @echo "Create a PAT at https://github.com/settings/tokens with read:packages scope"
    @echo "Then run: echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin"
