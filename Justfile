container := "clearfolio"
image := "clearfolio-dev"

# Show available commands
[private]
default:
    @just --list --unsorted --list-heading $'\n  \033[1;36mclearfolio.net\033[0m\n\n'

# Tear down existing container, rebuild image, and start fresh
[group('dev')]
init:
    -docker stop {{container}}
    -docker rm {{container}}
    docker build -t {{image}} .
    docker run -d \
      --name {{container}} \
      -p 4200:80 \
      -e ASPNETCORE_ENVIRONMENT=Development \
      -e DB_PATH=/data/clearfolio.db \
      -v clearfolio-data:/data \
      {{image}}
    @echo "Waiting for services to start..."
    @sleep 5
    docker logs --tail 10 {{container}}

# Start the container
[group('dev')]
up:
    docker start {{container}}

# Stop the container
[group('dev')]
down:
    docker stop {{container}}

# Show container logs (follow)
[group('dev')]
logs *args='':
    docker logs -f {{args}} {{container}}

# Rebuild image and restart container
[group('dev')]
rebuild:
    -docker stop {{container}}
    -docker rm {{container}}
    docker build -t {{image}} .
    docker run -d \
      --name {{container}} \
      -p 4200:80 \
      -e ASPNETCORE_ENVIRONMENT=Development \
      -e DB_PATH=/data/clearfolio.db \
      -v clearfolio-data:/data \
      {{image}}

# Run Angular dev server locally (with API proxy)
[group('dev')]
dev:
    cd src/app && npx ng serve

# Generate changelog.json from conventional commits (feats and fixes)
[group('dev')]
changelog:
    #!/usr/bin/env bash
    set -euo pipefail
    out="src/app/public/changelog.json"
    feats=$(git log --pretty=format:'{"hash":"%h","date":"%cs","message":"%s"}' --grep="^feat[:(]" --no-merges)
    fixes=$(git log --pretty=format:'{"hash":"%h","date":"%cs","message":"%s"}' --grep="^fix[:(]" --no-merges)
    echo "{" > "$out"
    echo '  "features": [' >> "$out"
    first=true
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        $first && first=false || echo "," >> "$out"
        printf "    %s" "$line" >> "$out"
    done <<< "$feats"
    echo "" >> "$out"
    echo '  ],' >> "$out"
    echo '  "fixes": [' >> "$out"
    first=true
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        $first && first=false || echo "," >> "$out"
        printf "    %s" "$line" >> "$out"
    done <<< "$fixes"
    echo "" >> "$out"
    echo '  ]' >> "$out"
    echo "}" >> "$out"
    echo "Generated $out"

# Login to GHCR (run once on Pi)
[group('prod')]
ghcr-login:
    @echo "Create a PAT at https://github.com/settings/tokens with read:packages scope"
    @echo "Then run: echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin"
