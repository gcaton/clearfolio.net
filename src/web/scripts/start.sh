#!/bin/sh
set -e

# Migrations must complete before the server accepts traffic.
node ./scripts/migrate.js

exec node server.js
