import { describe, expect, it } from "vitest";

import { goalDisplayPercent } from "./goal-display-percent";

describe("goalDisplayPercent", () => {
  it.each([
    {
      behavior: "holds at 99 while a book remains even when the share rounds up to 100",
      expected: 99,
      progressPercent: 99.5,
      remainingCount: 1,
    },
    {
      behavior: "shows 100 once no book remains",
      expected: 100,
      progressPercent: 100,
      remainingCount: 0,
    },
    {
      behavior: "rounds a half share up",
      expected: 63,
      progressPercent: 62.5,
      remainingCount: 3,
    },
    {
      behavior: "keeps an untouched goal at 0",
      expected: 0,
      progressPercent: 0,
      remainingCount: 5,
    },
    {
      behavior: "clamps an overshoot to 100",
      expected: 100,
      progressPercent: 120,
      remainingCount: 0,
    },
  ])("$behavior", ({ expected, progressPercent, remainingCount }) => {
    expect(goalDisplayPercent({ progressPercent, remainingCount })).toBe(expected);
  });
});
