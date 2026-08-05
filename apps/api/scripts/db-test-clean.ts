import { Client } from "pg";
import { z } from "zod";

const testDatabaseRules = {
  baseName: /(^|_)test$/,
  defaultUrl: "postgresql://booknest:booknest_dev_2026@localhost:5432/booknest_test",
  safeIdentifier: /^[a-z0-9_]+$/i,
  url: z.string().url(),
};

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function quoteIdentifier(name: string): string {
  if (!testDatabaseRules.safeIdentifier.test(name)) {
    throw new Error(`Unsafe database identifier: ${name}`);
  }
  return `"${name}"`;
}

const baseUrl = testDatabaseRules.url.parse(
  process.env.DATABASE_URL ?? testDatabaseRules.defaultUrl,
);
const baseName = databaseNameOf(baseUrl);

if (!testDatabaseRules.baseName.test(baseName)) {
  console.error(
    [
      `Refusing to clean: "${baseName}" is not a test database.`,
      "DATABASE_URL must point at a database whose name ends with _test.",
    ].join("\n"),
  );
  process.exit(1);
}

const client = new Client({ connectionString: baseUrl });
await client.connect();

try {
  const leftovers = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE starts_with(datname, $1) ORDER BY datname",
    [`${baseName}_`],
  );

  if (leftovers.rowCount === 0) console.log(`No leftover ${baseName}_* databases.`);

  for (const { datname } of leftovers.rows) {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [datname],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(datname)}`);
    console.log(`Dropped ${datname}`);
  }
} finally {
  await client.end();
}
