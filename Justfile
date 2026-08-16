container := "clearfolio"
image := "clearfolio-dev"
api_dir := "src/api/Clearfolio.Api"
web_dir := "src/web"

# Show available commands
[private]
default:
    @just --list --unsorted --list-heading $'\n  \033[1;36mclearfolio.net\033[0m\n\n'

# --- Next.js rewrite (src/web) -------------------------------------------
# The rewrite is in progress on branch nextjs-rewrite. These recipes run the
# new app; the docker/dev recipes below still run the current .NET + Angular
# stack. Task 16 of the plan replaces the old ones with these.

# Install dependencies for the Next.js app
[group('web')]
web-install:
    cd {{web_dir}} && npm install

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

# Tear down existing container, rebuild image, and start fresh (LEGACY:
# builds the .NET + Angular stack — the Next.js container arrives in Task 16)
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

# Open dev environment in tmux (shell | API + App)
[group('dev')]
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v tmux >/dev/null 2>&1 || { echo "Error: tmux is required for 'just dev'. Install it or use 'just dev-api' and 'just dev-app' separately."; exit 1; }
    root="{{justfile_directory()}}"
    session="clearfolio"
    if tmux has-session -t "$session" 2>/dev/null; then
      tmux attach -t "$session"
      exit 0
    fi
    tmux new-session -d -s "$session" -c "$root"
    tmux split-window -h -t "$session" -c "$root/{{api_dir}}"
    tmux send-keys -t "$session:0.1" "dotnet watch" Enter
    tmux split-window -v -t "$session:0.1" -c "$root/src/app"
    # Wait for API to start before launching Angular
    tmux send-keys -t "$session:0.2" "echo 'Waiting for API...'; until curl -sf http://localhost:5240/api/health > /dev/null 2>&1; do sleep 1; done; echo 'API ready'; npx ng serve --proxy-config proxy.conf.dev.json & sleep 5 && xdg-open http://localhost:4200 2>/dev/null; wait" Enter
    tmux split-window -v -t "$session:0.0" -c "$root" \; \
      send-keys "claude" Enter
    tmux select-pane -t "$session:0.0"
    tmux attach -t "$session"

# Stop dev session and exit tmux
[group('dev')]
dev-stop:
    #!/usr/bin/env bash
    set -euo pipefail
    session="clearfolio"
    if ! tmux has-session -t "$session" 2>/dev/null; then
      echo "No clearfolio session running"
      exit 0
    fi
    tmux kill-session -t "$session"
    echo "Dev session stopped"

# Run API dev server
[group('dev')]
dev-api:
    cd {{api_dir}} && dotnet watch

# Run Angular dev server
[group('dev')]
dev-app:
    cd src/app && npx ng serve --proxy-config proxy.conf.dev.json

# Run .NET tests
[group('dev')]
test *args='':
    dotnet test src/api/Clearfolio.Tests {{args}}

# Add a new EF Core migration
[group('dev')]
migrate name:
    cd {{api_dir}} && dotnet ef migrations add {{name}}

# Apply pending EF Core migrations (local dev only)
[group('dev')]
migrate-apply:
    cd {{api_dir}} && dotnet ef database update

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
    docker run -d \
      --name {{container}} \
      -p 4200:80 \
      -e ASPNETCORE_ENVIRONMENT=Development \
      -e DB_PATH=/data/clearfolio.db \
      -v clearfolio-data:/data \
      {{image}}
