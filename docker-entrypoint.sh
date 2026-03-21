#!/bin/sh
set -e

# Start nginx in background
nginx -g 'daemon off;' &

# Run .NET API in foreground
cd /app
exec dotnet Clearfolio.Api.dll
