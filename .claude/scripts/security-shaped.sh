#!/usr/bin/env bash
set -u

SECURITY_SHAPED='^(deploy/|\.github/workflows/|\.gitleaks\.toml$|pnpm-(lock|workspace)\.yaml$|apps/api/src/(bootstrap\.ts$|config/|core/(middleware|exceptions|pipes)/|core/(throttle|body-parsers)\.ts$|modules/(auth|realtime|media|mail)/)|apps/web/(next\.config\.ts$|src/proxy\.ts$|src/lib/(env|http)\.ts$|src/features/auth/)|packages/shared/src/auth\.ts$)|(^|/)(Dockerfile[^/]*|\.dockerignore|docker-entrypoint\.sh)$|\.(controller|guard|gateway)\.ts$|/input-dto/'
NOT_SHIPPED='\.(test|spec)\.tsx?$|\.stories\.tsx$|/test/|\.md$'

grep -E "$SECURITY_SHAPED" | grep -vE "$NOT_SHIPPED"
exit 0
