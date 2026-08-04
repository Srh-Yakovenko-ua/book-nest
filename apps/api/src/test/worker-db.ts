import { Client } from "pg";
import { z } from "zod";

const testDbSchemas = {
  databaseUrl: z.string().url(),
  poolId: z.coerce.number().int().positive().catch(1),
  runId: z.coerce.number().int().positive(),
};

const testDbSettings = {
  createRetryAttempts: 10,
  createRetryDelayMs: 150,
  safeIdentifier: /^[a-z0-9_]+$/i,
  templateSuffix: "template",
} as const;

export type WorkerDbConfig = {
  baseUrl: string;
  maintenanceUrl: string;
  runPrefix: string;
  templateName: string;
  templateUrl: string;
};

export async function dropRunDatabases(config: WorkerDbConfig): Promise<void> {
  await withMaintenanceClient({
    maintenanceUrl: config.maintenanceUrl,
    run: (client) => dropDatabasesOfRun({ client, runPrefix: config.runPrefix }),
  });
}

export async function ensureWorkerDatabase({
  config,
  workerUrl,
}: {
  config: WorkerDbConfig;
  workerUrl: string;
}): Promise<void> {
  const databaseName = databaseNameOf(workerUrl);
  await withMaintenanceClient({
    maintenanceUrl: config.maintenanceUrl,
    run: async (client) => {
      if (await databaseExists({ client, databaseName })) return;
      await createFromTemplate({ client, databaseName, templateName: config.templateName });
    },
  });
}

export async function resetTemplateDatabase(config: WorkerDbConfig): Promise<void> {
  await withMaintenanceClient({
    maintenanceUrl: config.maintenanceUrl,
    run: async (client) => {
      await dropDatabasesOfRun({ client, runPrefix: config.runPrefix });
      await client.query(`CREATE DATABASE ${quoteIdentifier(config.templateName)}`);
    },
  });
}

export function resolveWorkerDbConfig({
  rawBaseUrl,
  rawRunId,
}: {
  rawBaseUrl: string;
  rawRunId: string;
}): WorkerDbConfig {
  const baseUrl = testDbSchemas.databaseUrl.parse(rawBaseUrl);
  const baseName = databaseNameOf(baseUrl);
  const runId = testDbSchemas.runId.parse(rawRunId);
  const runPrefix = `${baseName}_${runId}`;
  const templateName = `${runPrefix}_${testDbSettings.templateSuffix}`;
  return {
    baseUrl,
    maintenanceUrl: withDatabaseName({ baseUrl, databaseName: baseName }),
    runPrefix,
    templateName,
    templateUrl: withDatabaseName({ baseUrl, databaseName: templateName }),
  };
}

export function workerDatabaseUrl({
  config,
  rawPoolId,
}: {
  config: WorkerDbConfig;
  rawPoolId: string | undefined;
}): string {
  const poolId = testDbSchemas.poolId.parse(rawPoolId);
  return withDatabaseName({
    baseUrl: config.baseUrl,
    databaseName: `${config.runPrefix}_${poolId}`,
  });
}

async function createFromTemplate({
  client,
  databaseName,
  templateName,
}: {
  client: Client;
  databaseName: string;
  templateName: string;
}): Promise<void> {
  const statement = `CREATE DATABASE ${quoteIdentifier(databaseName)} TEMPLATE ${quoteIdentifier(templateName)}`;
  for (let attempt = 1; attempt <= testDbSettings.createRetryAttempts; attempt += 1) {
    try {
      await client.query(statement);
      return;
    } catch (error) {
      const isLastAttempt = attempt === testDbSettings.createRetryAttempts;
      if (isLastAttempt || !isTemplateBusyError(error)) throw error;
      await delay(testDbSettings.createRetryDelayMs);
    }
  }
}

async function databaseExists({
  client,
  databaseName,
}: {
  client: Client;
  databaseName: string;
}): Promise<boolean> {
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
  return (result.rowCount ?? 0) > 0;
}

function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dropDatabase({
  client,
  databaseName,
}: {
  client: Client;
  databaseName: string;
}): Promise<void> {
  await client.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName],
  );
  await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
}

async function dropDatabasesOfRun({
  client,
  runPrefix,
}: {
  client: Client;
  runPrefix: string;
}): Promise<void> {
  for (const databaseName of await listRunDatabases({ client, runPrefix })) {
    await dropDatabase({ client, databaseName });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTemplateBusyError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "55006";
}

async function listRunDatabases({
  client,
  runPrefix,
}: {
  client: Client;
  runPrefix: string;
}): Promise<string[]> {
  const pattern = `^${escapeRegExp(runPrefix)}_([0-9]+|${testDbSettings.templateSuffix})$`;
  const result = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE datname ~ $1",
    [pattern],
  );
  return result.rows.map((row) => row.datname);
}

function quoteIdentifier(name: string): string {
  if (!testDbSettings.safeIdentifier.test(name)) {
    throw new Error(`Unsafe database identifier: ${name}`);
  }
  return `"${name}"`;
}

function withDatabaseName({
  baseUrl,
  databaseName,
}: {
  baseUrl: string;
  databaseName: string;
}): string {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function withMaintenanceClient<T>({
  maintenanceUrl,
  run,
}: {
  maintenanceUrl: string;
  run: (client: Client) => Promise<T>;
}): Promise<T> {
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
