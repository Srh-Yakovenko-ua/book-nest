import { execFileSync } from "node:child_process";

import { resetTemplateDatabase, resolveWorkerDbConfig } from "./worker-db.js";

export default async function globalSetup(): Promise<void> {
  const baseUrl = process.env.DATABASE_URL;
  if (baseUrl === undefined) throw new Error("DATABASE_URL is not set for the test run");

  const config = resolveWorkerDbConfig(baseUrl);
  await resetTemplateDatabase(config);

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: config.templateUrl },
    stdio: "inherit",
  });
}
