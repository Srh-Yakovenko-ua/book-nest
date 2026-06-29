import { spawnSync } from "node:child_process";

const NAME_FLAGS = ["--name", "-n"];

function readMigrationName(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (NAME_FLAGS.includes(arg)) return argv[index + 1];
    for (const flag of NAME_FLAGS) {
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

const migrationName = readMigrationName(process.argv.slice(2))?.trim();

if (!migrationName) {
  console.error(
    [
      "A migration name is required.",
      "  pnpm --filter @app/api db:migrate --name <snake_case_name>",
      "",
      "This creates a review-only migration (it does NOT apply it).",
      "Review the generated SQL — strip any spurious DROP INDEX *_search_text_trgm_idx lines —",
      "then apply with: pnpm --filter @app/api db:migrate:deploy",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "dev", "--create-only", "--name", migrationName],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
