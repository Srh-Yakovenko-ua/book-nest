import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { RediscoveryCandidate, RediscoveryDiversity } from "./rediscovery.js";

import { addDaysToIsoDate } from "./iso-date.js";
import {
  ageScoreOf,
  engagementScoreOf,
  rankRediscoveryCandidates,
  REDISCOVERY_POLICY,
  rediscoveryScoreOf,
  resolveRediscoveryPool,
  selectRediscoveryCandidateId,
} from "./rediscovery.js";

const TODAY = "2026-09-10";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SEED_CONTEXT = ["notes", "books"] as const;

function candidate(
  id: string,
  overrides: Partial<Omit<RediscoveryCandidate, "id">> = {},
): RediscoveryCandidate {
  return {
    createdOn: daysAgo(400),
    engagementScore: 0,
    id,
    lastShownOn: null,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return addDaysToIsoDate(TODAY, -days);
}

function select({
  candidates,
  diversity = null,
  localDate = TODAY,
  seedParts = [USER_ID, ...SEED_CONTEXT, localDate],
}: {
  candidates: RediscoveryCandidate[];
  diversity?: Nullable<RediscoveryDiversity>;
  localDate?: string;
  seedParts?: readonly string[];
}): Nullable<string> {
  return selectRediscoveryCandidateId({ candidates, diversity, localDate, seedParts });
}

describe("engagementScoreOf", () => {
  it.each([
    [true, true, 4],
    [true, false, 3],
    [false, true, 2],
    [false, false, 0],
  ])(
    "scores favorite=%s with the secondary signal=%s as %i",
    (isFavorite, hasSecondarySignal, expected) => {
      expect(engagementScoreOf({ hasSecondarySignal, isFavorite })).toBe(expected);
    },
  );
});

describe("ageScoreOf and rediscoveryScoreOf", () => {
  it.each([
    [30, 0],
    [179, 0],
    [180, 2],
    [364, 2],
    [365, 3],
  ])("scores an age of %i days as %i", (ageDays, expected) => {
    expect(ageScoreOf(ageDays)).toBe(expected);
  });

  it.each([
    [null, 3],
    [180, 2],
    [179, 1],
    [60, 1],
    [59, 0],
  ])("scores a last impression %s days ago as %i", (daysSinceLastShown, expected) => {
    expect(rediscoveryScoreOf(daysSinceLastShown)).toBe(expected);
  });
});

describe("resolveRediscoveryPool", () => {
  it("walks the primary cooldown, then the fallback, then the least recently shown", () => {
    const primary = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(30) }),
        candidate("b", { lastShownOn: daysAgo(1) }),
      ],
      localDate: TODAY,
    });
    const fallback = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(14) }),
        candidate("b", { lastShownOn: daysAgo(1) }),
      ],
      localDate: TODAY,
    });
    const lastResort = resolveRediscoveryPool({
      candidates: [
        candidate("a", { lastShownOn: daysAgo(13) }),
        candidate("b", { lastShownOn: daysAgo(1) }),
      ],
      localDate: TODAY,
    });

    expect(primary.stage).toBe("cooldown_primary");
    expect(fallback.stage).toBe("cooldown_fallback");
    expect(lastResort.stage).toBe("least_recently_shown");
    expect(
      rankRediscoveryCandidates({ candidates: lastResort.candidates, localDate: TODAY }),
    ).toEqual(["a", "b"]);
  });
});

describe("selectRediscoveryCandidateId", () => {
  it("returns null below two eligible candidates, before any cooldown filtering", () => {
    expect(select({ candidates: [] })).toBeNull();
    expect(select({ candidates: [candidate("a")] })).toBeNull();
    expect(
      select({
        candidates: [
          candidate("a", { lastShownOn: daysAgo(1) }),
          candidate("b", { lastShownOn: daysAgo(2) }),
        ],
      }),
    ).not.toBeNull();
  });

  it("picks from the ten best ranked candidates only", () => {
    const candidates = Array.from({ length: 30 }, (_unused, index) =>
      candidate(`note-${String(index).padStart(2, "0")}`, {
        engagementScore: index < REDISCOVERY_POLICY.topPoolSize ? 4 : 0,
      }),
    );
    const topPool = rankRediscoveryCandidates({ candidates, localDate: TODAY }).slice(
      0,
      REDISCOVERY_POLICY.topPoolSize,
    );

    for (let offset = 0; offset < 30; offset += 1) {
      const localDate = addDaysToIsoDate(TODAY, offset);
      expect(topPool).toContain(select({ candidates, localDate }));
    }
  });

  it("repeats the same pick for the same seed and lets the seed context move it", () => {
    const candidates = Array.from({ length: 10 }, (_unused, index) => candidate(`note-${index}`));

    expect(select({ candidates })).toBe(select({ candidates }));

    const contexts = new Set(
      Array.from({ length: 20 }, (_unused, index) =>
        select({ candidates, seedParts: [USER_ID, "series", `series-${index}`, TODAY] }),
      ),
    );
    expect(contexts.size).toBeGreaterThan(1);
  });

  it("joins the seed parts exactly as the historical quote seed", () => {
    const candidates = Array.from({ length: 10 }, (_unused, index) => candidate(`note-${index}`));

    expect(select({ candidates, seedParts: [USER_ID, TODAY] })).toBe(
      select({ candidates, seedParts: [`${USER_ID}:${TODAY}`] }),
    );
  });
});

describe("selectRediscoveryCandidateId diversity", () => {
  const LAST_SOURCE = "book:last";

  it("moves the pick off the last source when the best cohort offers another one", () => {
    const candidates = [
      candidate("repeat", { engagementScore: 4 }),
      candidate("fresh", { engagementScore: 4 }),
    ];
    const diversity: RediscoveryDiversity = {
      lastSourceKey: LAST_SOURCE,
      sourceKeyById: new Map([
        ["fresh", "series:other"],
        ["repeat", LAST_SOURCE],
      ]),
    };

    for (let offset = 0; offset < 30; offset += 1) {
      const localDate = addDaysToIsoDate(TODAY, offset);
      expect(select({ candidates, diversity, localDate })).toBe("fresh");
    }
  });

  it("never lets a weaker candidate win because of its source", () => {
    const candidates = [
      candidate("best-a", { engagementScore: 4 }),
      candidate("best-b", { engagementScore: 4 }),
      candidate("weaker", { engagementScore: 0 }),
    ];
    const diversity: RediscoveryDiversity = {
      lastSourceKey: LAST_SOURCE,
      sourceKeyById: new Map([
        ["best-a", LAST_SOURCE],
        ["best-b", LAST_SOURCE],
        ["weaker", "series:other"],
      ]),
    };
    const scoreOf = new Map([
      ["best-a", 4],
      ["best-b", 4],
      ["weaker", 0],
    ]);

    for (let offset = 0; offset < 60; offset += 1) {
      const localDate = addDaysToIsoDate(TODAY, offset);
      const plain = select({ candidates, localDate });
      const diversified = select({ candidates, diversity, localDate });
      expect(scoreOf.get(diversified ?? "")).toBe(scoreOf.get(plain ?? ""));
    }
  });

  it("leaves the pick untouched when every best candidate shares the last source", () => {
    const candidates = Array.from({ length: 6 }, (_unused, index) =>
      candidate(`note-${index}`, { engagementScore: 4 }),
    );
    const diversity: RediscoveryDiversity = {
      lastSourceKey: LAST_SOURCE,
      sourceKeyById: new Map(candidates.map((entry) => [entry.id, LAST_SOURCE])),
    };

    expect(select({ candidates, diversity })).toBe(select({ candidates }));
  });
});
