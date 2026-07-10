import { ensureWorkerDatabase, resolveWorkerDbConfig, workerDatabaseUrl } from "./worker-db.js";

const baseUrl = process.env.TEST_BASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (baseUrl === undefined) throw new Error("DATABASE_URL is not set for the test run");
process.env.TEST_BASE_DATABASE_URL = baseUrl;

const config = resolveWorkerDbConfig(baseUrl);
const workerUrl = workerDatabaseUrl(config, process.env.VITEST_POOL_ID);

await ensureWorkerDatabase(config, workerUrl);

process.env.DATABASE_URL = workerUrl;
