import { describe, expect, it, vi } from "vitest";

import type { PurgeCandidate, PurgeReconciler } from "./purge-reconciler.js";

import { createPurgeReconciler } from "./purge-reconciler.js";
import { TRASH_RETENTION } from "./trash-retention.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ENTITY_ID_A = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID_B = "33333333-3333-4333-8333-333333333333";

type ReconcilerHarness = {
  findCandidates: ReturnType<typeof vi.fn>;
  purge: ReturnType<typeof vi.fn>;
  reconciler: PurgeReconciler;
};

function buildHarness(candidates: PurgeCandidate[]): ReconcilerHarness {
  const findCandidates = vi.fn().mockResolvedValue(candidates);
  const purge = vi.fn().mockResolvedValue(undefined);
  const reconciler = createPurgeReconciler({
    batchSize: TRASH_RETENTION.reconcileBatchSize,
    findCandidates,
    purge,
    scope: "test",
  });
  return { findCandidates, purge, reconciler };
}

describe("createPurgeReconciler", () => {
  it("purges every overdue candidate with the batch size it was given", async () => {
    const { findCandidates, purge, reconciler } = buildHarness([
      { id: ENTITY_ID_A, userId: USER_ID },
      { id: ENTITY_ID_B, userId: USER_ID },
    ]);

    await reconciler.sweep();

    expect(findCandidates).toHaveBeenCalledWith({
      limit: TRASH_RETENTION.reconcileBatchSize,
      now: expect.any(Date),
    });
    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenNthCalledWith(1, { id: ENTITY_ID_A, userId: USER_ID });
    expect(purge).toHaveBeenNthCalledWith(2, { id: ENTITY_ID_B, userId: USER_ID });
  });

  it("does nothing when there are no overdue candidates", async () => {
    const { purge, reconciler } = buildHarness([]);

    await expect(reconciler.sweep()).resolves.toBeUndefined();

    expect(purge).not.toHaveBeenCalled();
  });

  it("swallows a candidate-load failure and never purges", async () => {
    const findCandidates = vi.fn().mockRejectedValue(new Error("db down"));
    const purge = vi.fn();
    const reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates,
      purge,
      scope: "test",
    });

    await expect(reconciler.sweep()).resolves.toBeUndefined();

    expect(purge).not.toHaveBeenCalled();
  });

  it("isolates a failing candidate and still purges the rest", async () => {
    const { purge, reconciler } = buildHarness([
      { id: ENTITY_ID_A, userId: USER_ID },
      { id: ENTITY_ID_B, userId: USER_ID },
    ]);
    purge.mockRejectedValueOnce(new Error("boom"));

    await expect(reconciler.sweep()).resolves.toBeUndefined();

    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenLastCalledWith({ id: ENTITY_ID_B, userId: USER_ID });
  });

  it("skips a concurrent sweep while a previous one is still running", async () => {
    let releaseFirstLoad: (candidates: PurgeCandidate[]) => void = () => undefined;
    const findCandidates = vi
      .fn()
      .mockResolvedValue([])
      .mockImplementationOnce(
        () =>
          new Promise<PurgeCandidate[]>((resolve) => {
            releaseFirstLoad = resolve;
          }),
      );
    const purge = vi.fn().mockResolvedValue(undefined);
    const reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates,
      purge,
      scope: "test",
    });

    const firstSweep = reconciler.sweep();
    await reconciler.sweep();

    expect(findCandidates).toHaveBeenCalledTimes(1);

    releaseFirstLoad([{ id: ENTITY_ID_A, userId: USER_ID }]);
    await firstSweep;

    expect(findCandidates).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledTimes(1);

    await reconciler.sweep();

    expect(findCandidates).toHaveBeenCalledTimes(2);
  });
});
