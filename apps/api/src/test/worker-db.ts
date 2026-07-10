import { Client } from "pg";
import { z } from "zod";

const databaseUrlSchema = z.string().url();
const poolIdSchema = z.coerce.number().int().positive().catch(1);
const safeIdentifier = /^[a-z0-9_]+$/i;
const CREATE_RETRY_ATTEMPTS = 10;
const CREATE_RETRY_DELAY_MS = 150;

export type WorkerDbConfig = {
  baseName: string;
  baseUrl: string;
  maintenanceUrl: string;
  templateName: string;
  templateUrl: string;
};

export async function ensureWorkerDatabase(
  config: WorkerDbConfig,
  workerUrl: string,
): Promise<void> {
  const workerName = databaseNameOf(workerUrl);
  const client = new Client({ connectionString: config.maintenanceUrl });
  await client.connect();
  try {
    if (await databaseExists(client, workerName)) return;
    await createFromTemplate(client, workerName, config.templateName);
  } finally {
    await client.end();
  }
}

export async function resetTemplateDatabase(config: WorkerDbConfig): Promise<void> {
  const client = new Client({ connectionString: config.maintenanceUrl });
  await client.connect();
  try {
    for (const leftover of await listWorkerDatabases(client, config.baseName)) {
      await dropDatabase(client, leftover);
    }
    await dropDatabase(client, config.templateName);
    await client.query(`CREATE DATABASE ${quoteIdentifier(config.templateName)}`);
  } finally {
    await client.end();
  }
}

export function resolveWorkerDbConfig(rawBaseUrl: string): WorkerDbConfig {
  const baseUrl = databaseUrlSchema.parse(rawBaseUrl);
  const baseName = databaseNameOf(baseUrl);
  const templateName = `${baseName}_template`;
  return {
    baseName,
    baseUrl,
    maintenanceUrl: withDatabaseName(baseUrl, baseName),
    templateName,
    templateUrl: withDatabaseName(baseUrl, templateName),
  };
}

export function workerDatabaseUrl(config: WorkerDbConfig, rawPoolId: string | undefined): string {
  const poolId = poolIdSchema.parse(rawPoolId);
  return withDatabaseName(config.baseUrl, `${config.baseName}_${poolId}`);
}

async function createFromTemplate(
  client: Client,
  databaseName: string,
  templateName: string,
): Promise<void> {
  const statement = `CREATE DATABASE ${quoteIdentifier(databaseName)} TEMPLATE ${quoteIdentifier(templateName)}`;
  for (let attempt = 1; attempt <= CREATE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await client.query(statement);
      return;
    } catch (error) {
      if (!isTemplateBusyError(error) || attempt === CREATE_RETRY_ATTEMPTS) throw error;
      await delay(CREATE_RETRY_DELAY_MS);
    }
  }
}

async function databaseExists(client: Client, databaseName: string): Promise<boolean> {
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
  return (result.rowCount ?? 0) > 0;
}

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dropDatabase(client: Client, databaseName: string): Promise<void> {
  await client.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName],
  );
  await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTemplateBusyError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "55006";
}

async function listWorkerDatabases(client: Client, baseName: string): Promise<string[]> {
  const pattern = `^${escapeRegExp(baseName)}_[0-9]+$`;
  const result = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE datname ~ $1",
    [pattern],
  );
  return result.rows.map((row) => row.datname);
}

function quoteIdentifier(name: string): string {
  if (!safeIdentifier.test(name)) throw new Error(`Unsafe database identifier: ${name}`);
  return `"${name}"`;
}

function withDatabaseName(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}
