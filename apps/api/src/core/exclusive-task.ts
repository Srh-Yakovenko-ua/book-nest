import { createLogger } from "./logger.js";

export type ExclusiveTask = () => Promise<void>;

export function createExclusiveTask({
  run,
  scope,
}: {
  run: () => Promise<void>;
  scope: string;
}): ExclusiveTask {
  const log = createLogger(scope);
  let isRunning = false;

  return async () => {
    if (isRunning) {
      log.warn("previous run is still in flight, skipping this tick");
      return;
    }
    isRunning = true;
    try {
      await run();
    } finally {
      isRunning = false;
    }
  };
}
