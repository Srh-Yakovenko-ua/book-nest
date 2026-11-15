import { describe, expect, it, vi } from "vitest";

import type { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { pinProcessTimezone } from "../../../test/process-timezone.js";
import { ReadingGoalExpirationReconciler } from "./reading-goal-expiration.reconciler.js";

function buildReconciler() {
  const goalsRepository = { findExpirationCandidates: vi.fn().mockResolvedValue([]) };
  const reconciler = new ReadingGoalExpirationReconciler(
    fakeOf<ReadingGoalActivityRepository>(),
    fakeOf<ReadingGoalBooksRepository>(),
    fakeOf<ReadingGoalsRepository>(goalsRepository),
  );
  return { goalsRepository, reconciler };
}

describe("ReadingGoalExpirationReconciler.run deadline cutoff", () => {
  describe("Europe/Kyiv", () => {
    pinProcessTimezone("Europe/Kyiv");

    it("queries candidates with a deadline cutoff on 00:00 UTC across the spring clock change", async () => {
      const { goalsRepository, reconciler } = buildReconciler();

      await reconciler.run({ now: new Date("2026-03-29T10:00:00.000Z") });

      expect(goalsRepository.findExpirationCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ deadlineBefore: new Date("2026-03-30T00:00:00.000Z") }),
      );
    });
  });
});
