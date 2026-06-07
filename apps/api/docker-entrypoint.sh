#!/bin/sh
set -e

node "$(node -e "process.stdout.write(require.resolve('prisma/package.json').replace(/package\.json$/, 'build/index.js'))")" migrate deploy

exec node dist/index.js
