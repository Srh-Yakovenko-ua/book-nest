#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

expected='DROP INDEX "authors_search_text_trgm_idx";
DROP INDEX "publishers_search_text_trgm_idx";'

actual="$(
	DOTENV_CONFIG_QUIET=true pnpm -s exec prisma migrate diff \
		--from-config-datasource \
		--to-schema prisma/schema.prisma \
		--script 2>/dev/null |
		grep -E '^[A-Z]' |
		sort
)"

if [ "$actual" = "$(printf '%s\n' "$expected" | sort)" ]; then
	echo "schema matches the applied migrations (only the two hand-written trigram indexes differ, as expected)"
	exit 0
fi

echo "schema.prisma and the applied migrations disagree. prisma migrate diff wants to run:" >&2
echo "$actual" >&2
echo "" >&2
echo "Expected exactly the two trigram DROP INDEX lines that Prisma cannot model. Anything else means a schema edit without a migration, or a migration that drifted from the schema." >&2
exit 1
