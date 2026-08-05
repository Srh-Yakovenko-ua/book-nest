import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

const workerLimits = { max: 6, min: 2 };

const requestedWorkers = Number.parseInt(process.env.VITEST_MAX_WORKERS ?? "", 10);
const maxWorkers =
  Number.isInteger(requestedWorkers) && requestedWorkers > 0
    ? requestedWorkers
    : Math.min(workerLimits.max, Math.max(workerLimits.min, availableParallelism()));

const testDefaults = {
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL: "postgresql://booknest:booknest_dev_2026@localhost:5432/booknest_test",
  JWT_ACCESS_SECRET: "test-access-secret-0000000000000000000000",
  JWT_REFRESH_SECRET: "test-refresh-secret-000000000000000000000",
  LOG_LEVEL: "error",
  NODE_ENV: "test",
  PORT: "4001",
};

const testEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(testDefaults)) {
  const resolved = process.env[key] ?? value;
  process.env[key] = resolved;
  testEnv[key] = resolved;
}

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  test: {
    clearMocks: true,
    env: testEnv,
    environment: "node",
    fileParallelism: true,
    globals: false,
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.{test,spec,e2e-spec}.ts"],
    maxWorkers,
    minWorkers: 1,
    pool: "forks",
    restoreMocks: true,
    retry: 2,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15000,
  },
});
