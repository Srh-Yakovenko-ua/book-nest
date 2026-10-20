import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import {
  StatisticsCountDelta,
  StatisticsRateDelta,
  StatisticsScoreDelta,
} from "./statistics-delta";

const deltaText = messages.statistics.delta;

const DELTA_UNDER_TEST = "delta-under-test";

const LETTER_RUN = /\p{L}+/gu;

const DELTAS = {
  flat: {
    count: (
      <StatisticsCountDelta
        comparison={{ absoluteDelta: 0, percentDelta: 0, previous: 100 }}
        current={100}
        formatValue={String}
      />
    ),
    rate: <StatisticsRateDelta comparison={{ percentagePointDelta: 0, previousRate: 0.352 }} />,
    score: <StatisticsScoreDelta comparison={{ absoluteDelta: 0, previous: 8.2 }} />,
  },
  mirrored: {
    count: {
      drop: (
        <StatisticsCountDelta
          comparison={{ absoluteDelta: -10, percentDelta: -10, previous: 100 }}
          current={90}
          formatValue={String}
        />
      ),
      rise: (
        <StatisticsCountDelta
          comparison={{ absoluteDelta: 10, percentDelta: 10, previous: 100 }}
          current={110}
          formatValue={String}
        />
      ),
    },
    rate: {
      drop: (
        <StatisticsRateDelta comparison={{ percentagePointDelta: -6.4, previousRate: 0.352 }} />
      ),
      rise: <StatisticsRateDelta comparison={{ percentagePointDelta: 6.4, previousRate: 0.352 }} />,
    },
    score: {
      drop: <StatisticsScoreDelta comparison={{ absoluteDelta: -0.4, previous: 8.2 }} />,
      rise: <StatisticsScoreDelta comparison={{ absoluteDelta: 0.4, previous: 8.2 }} />,
    },
  },
  negligiblePercentCount: {
    drop: (
      <StatisticsCountDelta
        comparison={{ absoluteDelta: -1, percentDelta: -0.004, previous: 25000 }}
        current={24999}
        formatValue={String}
      />
    ),
    rise: (
      <StatisticsCountDelta
        comparison={{ absoluteDelta: 1, percentDelta: 0.004, previous: 25000 }}
        current={25001}
        formatValue={String}
      />
    ),
  },
  roundsToZero: {
    rate: <StatisticsRateDelta comparison={{ percentagePointDelta: 0.03, previousRate: 0.352 }} />,
    score: <StatisticsScoreDelta comparison={{ absoluteDelta: -0.04, previous: 6.58 }} />,
  },
  smallestVisibleScore: {
    drop: <StatisticsScoreDelta comparison={{ absoluteDelta: -0.06, previous: 6.58 }} />,
    rise: <StatisticsScoreDelta comparison={{ absoluteDelta: 0.06, previous: 6.58 }} />,
  },
} as const;

function spokenText(ui: ReactElement): string {
  const { unmount } = renderWithProviders(
    <div aria-labelledby={DELTA_UNDER_TEST} role="group">
      <span id={DELTA_UNDER_TEST}>{ui}</span>
    </div>,
  );
  let spoken = "";
  screen.getByRole("group", {
    name: (accessibleName) => {
      spoken = accessibleName;
      return true;
    },
  });
  unmount();
  return spoken;
}

function wordsOnlyIn(text: string, other: string): string[] {
  const otherWords = new Set(other.match(LETTER_RUN) ?? []);
  return (text.match(LETTER_RUN) ?? []).filter((word) => !otherWords.has(word));
}

describe("statistics deltas", () => {
  it.each(Object.entries(DELTAS.mirrored))(
    "tells a %s rise from a drop of the same size in words a screen reader hears",
    (_kind, { drop, rise }) => {
      const riseText = spokenText(rise);
      const dropText = spokenText(drop);

      expect(wordsOnlyIn(riseText, dropText)).not.toEqual([]);
      expect(wordsOnlyIn(dropText, riseText)).not.toEqual([]);
    },
  );

  it.each(Object.entries(DELTAS.flat))(
    "speaks a flat %s delta as unchanged and nothing more",
    (_kind, flat) => {
      expect(spokenText(flat)).toBe(deltaText.unchanged);
    },
  );

  it.each(Object.entries(DELTAS.roundsToZero))(
    "speaks a %s delta that rounds to zero at its shown precision as unchanged and nothing more",
    (_kind, negligible) => {
      expect(spokenText(negligible)).toBe(deltaText.unchanged);
    },
  );

  it("still names the direction of a score delta just large enough to show as 0,1", () => {
    const riseText = spokenText(DELTAS.smallestVisibleScore.rise);
    const dropText = spokenText(DELTAS.smallestVisibleScore.drop);

    expect(dropText).toContain("0,1");
    expect(wordsOnlyIn(riseText, dropText)).not.toEqual([]);
    expect(wordsOnlyIn(dropText, riseText)).not.toEqual([]);
  });

  it("still names the direction of a count change whose percent rounds to zero", () => {
    const riseText = spokenText(DELTAS.negligiblePercentCount.rise);
    const dropText = spokenText(DELTAS.negligiblePercentCount.drop);

    expect(wordsOnlyIn(riseText, dropText)).not.toEqual([]);
    expect(wordsOnlyIn(dropText, riseText)).not.toEqual([]);
  });
});
