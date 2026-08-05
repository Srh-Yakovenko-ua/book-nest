import { describe, expect, it, vi } from "vitest";

import { createExclusiveTask } from "./exclusive-task.js";

describe("createExclusiveTask", () => {
  it("skips a tick that starts while the previous one is still running", async () => {
    let releaseFirstRun: () => void = () => undefined;
    const run = vi
      .fn()
      .mockResolvedValue(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstRun = resolve;
          }),
      );
    const task = createExclusiveTask({ run, scope: "test" });

    const firstTick = task();
    await task();

    expect(run).toHaveBeenCalledTimes(1);

    releaseFirstRun();
    await firstTick;

    await task();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("releases the guard when a tick throws", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const task = createExclusiveTask({ run, scope: "test" });

    await expect(task()).rejects.toThrow("boom");
    await task();

    expect(run).toHaveBeenCalledTimes(2);
  });
});
