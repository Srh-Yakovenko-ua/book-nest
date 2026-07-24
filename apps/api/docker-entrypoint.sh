#!/bin/sh
set -e

node "$(node -e "process.stdout.write(require.resolve('prisma/package.json').replace(/package\.json$/, 'build/index.js'))")" migrate deploy

run_seed() {
  if ! node "$1"; then
    echo "[entrypoint] seed failed, continuing: $1" >&2
  fi
}

run_seed dist/scripts/seed-genres.js
run_seed dist/scripts/seed-delivery-services.js
run_seed dist/scripts/seed-changelog.js

exec node dist/index.js
