import { describe, expect, it, vi } from "vitest";

import type { CharactersRepository } from "../infrastructure/characters.repository.js";
import type { CharactersService } from "./characters.service.js";

import { CHARACTER_PURGE_RECONCILE_BATCH } from "../domain/character-purge.js";
import { CharacterPurgeReconciler } from "./character-purge.reconciler.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID_A = "22222222-2222-4222-8222-222222222222";
const CHARACTER_ID_B = "33333333-3333-4333-8333-333333333333";

function buildReconciler(candidates: { id: string; userId: string }[]): {
  findPurgeCandidates: ReturnType<typeof vi.fn>;
  purge: ReturnType<typeof vi.fn>;
  reconciler: CharacterPurgeReconciler;
} {
  const findPurgeCandidates = vi.fn().mockResolvedValue(candidates);
  const purge = vi.fn().mockResolvedValue(undefined);
  const reconciler = new CharacterPurgeReconciler(
    { findPurgeCandidates } as unknown as CharactersRepository,
    { purge } as unknown as CharactersService,
  );
  return { findPurgeCandidates, purge, reconciler };
}

describe("CharacterPurgeReconciler.sweep", () => {
  it("purges every overdue candidate through the shared purge path", async () => {
    const { findPurgeCandidates, purge, reconciler } = buildReconciler([
      { id: CHARACTER_ID_A, userId: USER_ID },
      { id: CHARACTER_ID_B, userId: USER_ID },
    ]);

    await reconciler.sweep();

    expect(findPurgeCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ limit: CHARACTER_PURGE_RECONCILE_BATCH }),
    );
    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenCalledWith({ characterId: CHARACTER_ID_A, userId: USER_ID });
    expect(purge).toHaveBeenCalledWith({ characterId: CHARACTER_ID_B, userId: USER_ID });
  });

  it("does nothing when there are no overdue candidates", async () => {
    const { purge, reconciler } = buildReconciler([]);

    await reconciler.sweep();

    expect(purge).not.toHaveBeenCalled();
  });

  it("isolates a failing candidate and still purges the rest", async () => {
    const { purge, reconciler } = buildReconciler([
      { id: CHARACTER_ID_A, userId: USER_ID },
      { id: CHARACTER_ID_B, userId: USER_ID },
    ]);
    purge.mockRejectedValueOnce(new Error("boom"));

    await expect(reconciler.sweep()).resolves.toBeUndefined();

    expect(purge).toHaveBeenCalledTimes(2);
  });

  it("swallows a candidate-load failure without throwing", async () => {
    const findPurgeCandidates = vi.fn().mockRejectedValue(new Error("db down"));
    const purge = vi.fn();
    const reconciler = new CharacterPurgeReconciler(
      { findPurgeCandidates } as unknown as CharactersRepository,
      { purge } as unknown as CharactersService,
    );

    await expect(reconciler.sweep()).resolves.toBeUndefined();

    expect(purge).not.toHaveBeenCalled();
  });
});
