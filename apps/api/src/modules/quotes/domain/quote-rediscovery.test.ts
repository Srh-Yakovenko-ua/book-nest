import { describe, expect, it } from "vitest";

import type { QuoteRediscoveryCandidate } from "./quote-rediscovery.js";

import { addDaysToIsoDate } from "../../../core/iso-date.js";
import {
  ageScoreOf,
  engagementScoreOf,
  QUOTE_REDISCOVERY_POLICY,
  rankRediscoveryCandidates,
  rediscoveryCreationCutoff,
  rediscoveryScoreOf,
  resolveRediscoveryPool,
  selectRediscoveryQuoteId,
} from "./quote-rediscovery.js";

const TODAY = "2026-09-10";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function candidate(
  id: string,
  overrides: Partial<Omit<QuoteRediscoveryCandidate, "id">> = {},
): QuoteRediscoveryCandidate {
  return {
    createdOn: daysAgo(400),
    hasComment: false,
    id,
    isFavorite: false,
    lastShownOn: null,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return addDaysToIsoDate(TODAY, -days);
}

describe("engagementScoreOf", () => {
  it("scores a favorite carrying a comment as the single highest engagement", () => {
    expect(engagementScoreOf({ hasComment: true, isFavorite: true })).toBe(4);
  });

  it("scores a favorite without a comment", () => {
    expect(engagementScoreOf({ hasComment: false, isFavorite: true })).toBe(3);
  });

  it("scores a comment without a favorite", () => {
    expect(engagementScoreOf({ hasComment: true, isFavorite: false })).toBe(2);
  });

  it("scores an untouched quote as zero", () => {
    expect(engagementScoreOf({ hasComment: false, isFavorite: false })).toBe(0);
  });

  it("never sums the engagement tiers", () => {
    const favoriteAndComment = engagementScoreOf({ hasComment: true, isFavorite: true });
    const favoriteOnly = engagementScoreOf({ hasComment: false, isFavorite: true });
    const commentOnly = engagementScoreOf({ hasComment: true, isFavorite: false });

    expect(favoriteAndComment).toBeLessThan(favoriteOnly + commentOnly);
  });
});

describe("ageScoreOf", () => {
  it.each([
    [30, 0],
    [179, 0],
    [180, 2],
    [364, 2],
    [365, 3],
  ])("scores an age of %i days as %i", (ageDays, expected) => {
    expect(ageScoreOf(ageDays)).toBe(expected);
  });
});

describe("rediscoveryScoreOf", () => {
  it.each([
    [null, 3],
    [180, 2],
    [365, 2],
    [179, 1],
    [60, 1],
    [59, 0],
    [0, 0],
  ])("scores a last impression of %s days ago as %i", (daysSinceLastShown, expected) => {
    expect(rediscoveryScoreOf(daysSinceLastShown)).toBe(expected);
  });
});

describe("rediscoveryCreationCutoff", () => {
  it("excludes quotes younger than the minimum age in the reader's own zone", () => {
    const cutoff = rediscoveryCreationCutoff({ localDate: TODAY, timeZone: "Europe/Kyiv" });

    expect(cutoff.toISOString()).toBe("2026-08-11T21:00:00.000Z");
  });

  it("moves with the reader's zone", () => {
    const cutoff = rediscoveryCreationCutoff({ localDate: TODAY, timeZone: "UTC" });

    expect(cutoff.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });
});

describe("resolveRediscoveryPool", () => {
  it("keeps only quotes outside the primary cooldown while some qualify", () => {
    const pool = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(30) }),
        candidate("b", { lastShownOn: daysAgo(2) }),
      ],
      localDate: TODAY,
    });

    expect(pool.stage).toBe("cooldown_primary");
    expect(pool.candidates.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("falls back to the shorter cooldown when the primary pool is empty", () => {
    const pool = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(29) }),
        candidate("b", { lastShownOn: daysAgo(14) }),
        candidate("c", { lastShownOn: daysAgo(1) }),
      ],
      localDate: TODAY,
    });

    expect(pool.stage).toBe("cooldown_fallback");
    expect(pool.candidates.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("falls back to every candidate when both cooldowns are empty", () => {
    const pool = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(13) }),
        candidate("b", { lastShownOn: daysAgo(1) }),
      ],
      localDate: TODAY,
    });

    expect(pool.stage).toBe("least_recently_shown");
    expect(pool.candidates.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("treats a never shown quote as long overdue", () => {
    const pool = resolveRediscoveryPool({
      candidates: [candidate("a"), candidate("b", { lastShownOn: daysAgo(1) })],
      localDate: TODAY,
    });

    expect(pool.candidates.map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("rankRediscoveryCandidates", () => {
  it("ranks by total score and breaks ties on the quote id", () => {
    const ranked = rankRediscoveryCandidates({
      candidates: [
        candidate("c", { createdOn: daysAgo(40) }),
        candidate("b", { createdOn: daysAgo(40) }),
        candidate("a", { createdOn: daysAgo(40), isFavorite: true }),
      ],
      localDate: TODAY,
    });

    expect(ranked).toEqual(["a", "b", "c"]);
  });

  it("keeps ties stable regardless of the incoming order", () => {
    const candidates = [candidate("b"), candidate("a"), candidate("c")];

    expect(rankRediscoveryCandidates({ candidates, localDate: TODAY })).toEqual(
      rankRediscoveryCandidates({ candidates: [...candidates].reverse(), localDate: TODAY }),
    );
  });

  it("prioritises the least recently shown quote in the last fallback", () => {
    const ranked = rankRediscoveryCandidates({
      candidates: [
        candidate("recent", { isFavorite: true, lastShownOn: daysAgo(1) }),
        candidate("stale", { lastShownOn: daysAgo(13) }),
      ],
      localDate: TODAY,
    });

    expect(ranked).toEqual(["stale", "recent"]);
  });
});

describe("selectRediscoveryQuoteId", () => {
  it("returns null when the archive holds no rediscoverable quote", () => {
    expect(
      selectRediscoveryQuoteId({ candidates: [], localDate: TODAY, userId: USER_ID }),
    ).toBeNull();
  });

  it("returns null when a single quote would repeat forever", () => {
    expect(
      selectRediscoveryQuoteId({ candidates: [candidate("a")], localDate: TODAY, userId: USER_ID }),
    ).toBeNull();
  });

  it("still picks a quote when every candidate sits inside both cooldowns", () => {
    const picked = selectRediscoveryQuoteId({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(1) }),
        candidate("b", { lastShownOn: daysAgo(2) }),
      ],
      localDate: TODAY,
      userId: USER_ID,
    });

    expect(picked).not.toBeNull();
  });

  it("repeats the same choice for the same reader and day", () => {
    const candidates = Array.from({ length: 20 }, (_unused, index) => candidate(`quote-${index}`));

    const first = selectRediscoveryQuoteId({ candidates, localDate: TODAY, userId: USER_ID });
    const second = selectRediscoveryQuoteId({ candidates, localDate: TODAY, userId: USER_ID });

    expect(first).toBe(second);
  });

  it("picks from the top pool only", () => {
    const candidates = Array.from({ length: 30 }, (_unused, index) =>
      candidate(`quote-${String(index).padStart(2, "0")}`, {
        isFavorite: index < QUOTE_REDISCOVERY_POLICY.topPoolSize,
      }),
    );

    const picked = selectRediscoveryQuoteId({ candidates, localDate: TODAY, userId: USER_ID });
    const topPool = rankRediscoveryCandidates({ candidates, localDate: TODAY }).slice(
      0,
      QUOTE_REDISCOVERY_POLICY.topPoolSize,
    );

    expect(topPool).toContain(picked);
  });

  it("lets a different day reach a different quote", () => {
    const candidates = Array.from({ length: 20 }, (_unused, index) => candidate(`quote-${index}`));

    const picks = new Set(
      Array.from({ length: 30 }, (_unused, index) =>
        selectRediscoveryQuoteId({
          candidates,
          localDate: addDaysToIsoDate(TODAY, index),
          userId: USER_ID,
        }),
      ),
    );

    expect(picks.size).toBeGreaterThan(1);
  });

  it("lets two readers of the same archive see different quotes", () => {
    const candidates = Array.from({ length: 20 }, (_unused, index) => candidate(`quote-${index}`));

    const picks = new Set(
      [USER_ID, OTHER_USER_ID].map((userId) =>
        selectRediscoveryQuoteId({ candidates, localDate: TODAY, userId }),
      ),
    );

    expect(picks.size).toBe(2);
  });

  it("falls back to the whole pool size when fewer than ten candidates exist", () => {
    const candidates = [candidate("a"), candidate("b"), candidate("c")];

    const picked = selectRediscoveryQuoteId({ candidates, localDate: TODAY, userId: USER_ID });

    expect(["a", "b", "c"]).toContain(picked);
  });
});
