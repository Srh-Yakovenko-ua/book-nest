import "./core/tracing.js";
import { bootstrapNestApp } from "./bootstrap.js";
import { env } from "./config/env.js";
import { createLogger } from "./core/logger.js";
import { shutdownTracing } from "./core/tracing.js";

const log = createLogger("startup");
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  let app;
  try {
    app = await bootstrapNestApp();
  } catch (err) {
    log.error({ err }, "failed to bootstrap nest app");
    process.exit(1);
  }

  app.enableShutdownHooks();

  try {
    await app.listen(env.port);
    log.info({ port: env.port }, `api listening on http://localhost:${env.port}`);
  } catch (err) {
    log.error({ err }, "failed to listen, exiting");
    process.exit(1);
  }

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info({ signal }, "shutting down");

    const forceExit = setTimeout(() => {
      log.error("graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await app.close();
      await shutdownTracing();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      log.error({ err }, "error during shutdown");
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
