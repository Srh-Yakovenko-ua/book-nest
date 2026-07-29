import { describe, expect, it } from "vitest";

import type { ReleasePermit } from "./bounded-semaphore.js";

import {
  BoundedSemaphore,
  SemaphoreWaitQueueFullError,
  SemaphoreWaitTimeoutError,
} from "./bounded-semaphore.js";

type Gate = { open: () => void; opened: Promise<void> };

function createGate(): Gate {
  let openGate: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  return { open: () => openGate(), opened };
}

function flushPendingTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("BoundedSemaphore permits", () => {
  it("runs no more than the configured number of tasks at the same time", async () => {
    const semaphore = new BoundedSemaphore({ name: "test", permits: 2, waitQueueLimit: 10 });
    const gate = createGate();
    let runningTasks = 0;
    let peakRunningTasks = 0;

    const tasks = Array.from({ length: 5 }, () =>
      semaphore.run({
        task: async () => {
          runningTasks += 1;
          peakRunningTasks = Math.max(peakRunningTasks, runningTasks);
          await gate.opened;
          runningTasks -= 1;
        },
      }),
    );
    await flushPendingTasks();

    expect(runningTasks).toBe(2);

    gate.open();
    await Promise.all(tasks);

    expect(peakRunningTasks).toBe(2);
    expect(runningTasks).toBe(0);
  });

  it("hands a released permit to the queued waiters in first-in first-out order", async () => {
    const semaphore = new BoundedSemaphore({ name: "test", permits: 1, waitQueueLimit: 10 });
    const gate = createGate();
    const completionOrder: string[] = [];

    const blocker = semaphore.run({ task: () => gate.opened });
    await flushPendingTasks();

    const queued = ["first", "second", "third"].map((label) =>
      semaphore.run({
        task: () => {
          completionOrder.push(label);
          return Promise.resolve();
        },
      }),
    );

    gate.open();
    await Promise.all([blocker, ...queued]);

    expect(completionOrder).toEqual(["first", "second", "third"]);
  });

  it("releases the permit when the task throws", async () => {
    const semaphore = new BoundedSemaphore({ name: "test", permits: 1, waitQueueLimit: 10 });

    await expect(semaphore.run({ task: () => Promise.reject(new Error("boom")) })).rejects.toThrow(
      "boom",
    );

    const outcome = await Promise.race([
      semaphore.run({ task: () => Promise.resolve("acquired") }),
      new Promise((resolve) => setTimeout(() => resolve("still blocked"), 50)),
    ]);

    expect(outcome).toBe("acquired");
  });

  it("ignores repeated releases so a single permit stays single", async () => {
    const semaphore = new BoundedSemaphore({ name: "test", permits: 1, waitQueueLimit: 10 });
    const release = await semaphore.acquire();
    const gate = createGate();
    let runningTasks = 0;
    let peakRunningTasks = 0;

    const tasks = Array.from({ length: 3 }, () =>
      semaphore.run({
        task: async () => {
          runningTasks += 1;
          peakRunningTasks = Math.max(peakRunningTasks, runningTasks);
          await gate.opened;
          runningTasks -= 1;
        },
      }),
    );
    await flushPendingTasks();

    release();
    release();
    release();
    await flushPendingTasks();

    expect(runningTasks).toBe(1);

    gate.open();
    await Promise.all(tasks);

    expect(peakRunningTasks).toBe(1);
  });
});

describe("BoundedSemaphore wait queue", () => {
  it("rejects with SemaphoreWaitQueueFullError once the wait queue is full", async () => {
    const semaphore = new BoundedSemaphore({ name: "media-test", permits: 1, waitQueueLimit: 2 });
    const gate = createGate();
    const blocker = semaphore.run({ task: () => gate.opened });
    await flushPendingTasks();

    const queued: [Promise<ReleasePermit>, Promise<ReleasePermit>] = [
      semaphore.acquire(),
      semaphore.acquire(),
    ];
    const [firstWait, secondWait] = queued;

    const overflow = semaphore.acquire();

    await expect(overflow).rejects.toBeInstanceOf(SemaphoreWaitQueueFullError);
    await expect(overflow).rejects.toMatchObject({ semaphoreName: "media-test" });

    gate.open();
    await blocker;
    (await firstWait)();
    (await secondWait)();
  });

  it("rejects with SemaphoreWaitTimeoutError when the wait exceeds its timeout", async () => {
    const semaphore = new BoundedSemaphore({ name: "test", permits: 1, waitQueueLimit: 10 });
    const gate = createGate();
    const blocker = semaphore.run({ task: () => gate.opened });
    await flushPendingTasks();

    const timedOut = semaphore.acquire({ timeoutMs: 20 });
    const patient = semaphore.acquire();

    await expect(timedOut).rejects.toBeInstanceOf(SemaphoreWaitTimeoutError);

    gate.open();
    await blocker;

    const outcome = await Promise.race([
      patient.then(() => "acquired"),
      new Promise((resolve) => setTimeout(() => resolve("still blocked"), 50)),
    ]);

    expect(outcome).toBe("acquired");
    (await patient)();
  });
});
