import type { Nullable } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SemaphoreWaitQueueFullError,
  SemaphoreWaitTimeoutError,
} from "../../../core/bounded-semaphore.js";
import { MediaAdmission } from "./media-admission.js";

type DecodeOutcome = "decoded" | "failed" | "queue-full" | "still-queued" | "timed-out";

type Gate = { open: () => void; opened: Promise<void> };

function createGate(): Gate {
  let openGate: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  return { open: () => openGate(), opened };
}

function outcomeOf(error: unknown): DecodeOutcome {
  if (error instanceof SemaphoreWaitQueueFullError) return "queue-full";
  if (error instanceof SemaphoreWaitTimeoutError) return "timed-out";
  return "failed";
}

function settle(decode: Promise<unknown>): Promise<DecodeOutcome> {
  return decode.then((): DecodeOutcome => "decoded", outcomeOf);
}

function stillQueuedAfter(ms: number): Promise<DecodeOutcome> {
  return new Promise((resolve) => setTimeout(() => resolve("still-queued"), ms));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("MediaAdmission decode waiting", () => {
  it("lets the background worker wait a full minute for a decode permit", async () => {
    vi.useFakeTimers();
    const admission = new MediaAdmission();
    const gate = createGate();
    const blocking = admission.runHttpDecode({ task: () => gate.opened });
    const settled: { outcome: Nullable<DecodeOutcome> } = { outcome: null };
    const worker = settle(admission.runWorkerDecode({ task: () => Promise.resolve() }));
    void worker.then((outcome) => {
      settled.outcome = outcome;
    });

    await vi.advanceTimersByTimeAsync(59_000);

    expect(settled.outcome).toBeNull();

    await vi.advanceTimersByTimeAsync(1_001);

    expect(await worker).toBe("timed-out");

    gate.open();
    await blocking;
  });

  it("queues at most one waiter per admitted upload plus the single worker", async () => {
    const admission = new MediaAdmission();
    const gate = createGate();
    const running = admission.runHttpDecode({ task: () => gate.opened });
    const queued = Array.from({ length: 4 }, () =>
      admission.runHttpDecode({ task: () => Promise.resolve() }),
    );

    const overflow = settle(admission.runHttpDecode({ task: () => Promise.resolve() }));

    expect(await Promise.race([overflow, stillQueuedAfter(50)])).toBe("queue-full");

    gate.open();
    await Promise.all([running, ...queued, overflow]);
  });
});
