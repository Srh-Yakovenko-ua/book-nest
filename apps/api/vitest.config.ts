import { defineConfig } from "vitest/config";

const testDefaults = {
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL: "postgresql://booknest:booknest_dev_2026@localhost:5432/booknest_test",
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
    fileParallelism: false,
    globals: false,
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.{test,spec,e2e-spec}.ts"],
    pool: "forks",
    restoreMocks: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15000,
  },
});
