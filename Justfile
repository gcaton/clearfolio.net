container := "clearfolio"
image := "clearfolio-dev"
web_dir := "src/web"

# Show available commands
[private]
default:
    @just --list --unsorted --list-heading $'\n  \033[1;36mclearfolio.net\033[0m\n\n'

# --- Next.js app (src/web) ------------------------------------------------
# The single Next.js app that clearfolio.net now ships as. src/api and
# src/app remain in the tree as porting reference until parity, but are no
# longer built or run by these recipes.

# Install dependencies for the Next.js app
[group('web')]
web-install:
    cd {{web_dir}} && npm install

# Generate a migration from schema changes
[group('web')]
web-migrate-generate:
    cd {{web_dir}} && npm run db:generate

# Apply pending migrations and seed reference data
[group('web')]
web-migrate:
    cd {{web_dir}} && npm run db:migrate

# Run the Next.js dev server (http://localhost:3000), migrating first
[group('web')]
web-dev: web-migrate
    cd {{web_dir}} && npm run dev

# Run the domain unit tests (Vitest)
[group('web')]
web-test *args='':
    cd {{web_dir}} && npx vitest run {{args}}

# Run the unit tests in watch mode
[group('web')]
web-test-watch:
    cd {{web_dir}} && npx vitest

# Run the end-to-end tests (Playwright)
[group('web')]
test-e2e:
    cd {{web_dir}} && npm run test:e2e

# Type-check without emitting
[group('web')]
web-typecheck:
    cd {{web_dir}} && npx tsc --noEmit

# Production build (standalone output)
[group('web')]
web-build:
    cd {{web_dir}} && npm run build

# Everything CI will check, in one go
[group('web')]
web-check: web-typecheck web-test
    @echo "typecheck + tests OK"

# Set up the Next.js app from a clean checkout, then verify it
[group('web')]
init:
    cd {{web_dir}} && npm install
    just web-check
    just web-migrate
    @echo ""
    @echo "  Ready. Next:  just web-dev   →  http://localhost:3000"
    @echo ""

# Tear down existing container, rebuild the Next.js image, and start fresh
[group('docker')]
docker-init:
    -docker stop {{container}}
    -docker rm {{container}}
    docker build -t {{image}} .
    just _run
    @echo "Waiting for services to start..."
    @sleep 5
    docker logs --tail 10 {{container}}

# Start the container
[group('docker')]
up:
    docker start {{container}}

# Stop the container
[group('docker')]
down:
    docker stop {{container}}

# Show container logs (follow)
[group('docker')]
logs *args='':
    docker logs -f {{args}} {{container}}

# Rebuild image and restart container
[group('docker')]
rebuild:
    -docker stop {{container}}
    -docker rm {{container}}
    docker build -t {{image}} .
    just _run

# Generate changelog.json from conventional commits (feats and fixes)
[group('dev')]
changelog:
    #!/usr/bin/env bash
    set -euo pipefail
    out="src/app/public/changelog.json"
    feats=$(git log --pretty=format:'%h%x09%cs%x09%s' --grep="^feat[:(]" --no-merges \
        | jq -R -s 'split("\n")[:-1] | map(select(length > 0) | split("\t") | {hash: .[0], date: .[1], message: .[2]})')
    fixes=$(git log --pretty=format:'%h%x09%cs%x09%s' --grep="^fix[:(]" --no-merges \
        | jq -R -s 'split("\n")[:-1] | map(select(length > 0) | split("\t") | {hash: .[0], date: .[1], message: .[2]})')
    jq -n --argjson feats "$feats" --argjson fixes "$fixes" '{features: $feats, fixes: $fixes}' > "$out"
    echo "Generated $out"

[private]
_run:
    # Volume name intentionally differs from the v1 (.NET/Angular) image's
    # "clearfolio-data". v2's schema cannot read v1 data, and this container
    # runs migrations on start — mounting the old volume here would run those
    # migrations against a v1 database. Do not "tidy" this back to
    # clearfolio-data; the old volume is meant to stay untouched so v1 can
    # still be started against it if needed.
    docker run -d \
      --name {{container}} \
      -p 4200:3000 \
      -e DB_PATH=/data/clearfolio.db \
      -v clearfolio-data-v2:/data \
      {{image}}
