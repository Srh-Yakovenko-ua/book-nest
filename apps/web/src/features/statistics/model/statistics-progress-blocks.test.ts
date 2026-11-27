import { describe, expect, it } from "vitest";

import { resolveStatisticsProgressBlocks } from "./statistics-progress-blocks";
import { overviewFixture } from "./statistics.fixtures";

const FULL = overviewFixture();

const NO_OWNED_BOOKS = { ...FULL.libraryBalance, currentOwnedTotal: 0 };

const NO_SERIES_READS = { ...FULL.series, completedReadsCount: 0 };

const UNAVAILABLE_SERIES = { ...FULL.series, availability: "unavailable" } as const;

const NO_RECORDS = { items: [] };

describe("resolveStatisticsProgressBlocks", () => {
  it("shows every block with data and explains nothing", () => {
    expect(resolveStatisticsProgressBlocks(FULL)).toEqual({
      explained: [],
      shown: { libraryBalance: true, records: true, series: true },
    });
  });

  it("hides a single block without data and still explains nothing", () => {
    expect(resolveStatisticsProgressBlocks({ ...FULL, records: NO_RECORDS })).toEqual({
      explained: [],
      shown: { libraryBalance: true, records: false, series: true },
    });
  });

  it("explains the two hidden blocks together", () => {
    expect(
      resolveStatisticsProgressBlocks({ ...FULL, records: NO_RECORDS, series: UNAVAILABLE_SERIES }),
    ).toEqual({
      explained: ["series", "records"],
      shown: { libraryBalance: true, records: false, series: false },
    });
  });

  it("explains all three blocks when none has data", () => {
    expect(
      resolveStatisticsProgressBlocks({
        libraryBalance: NO_OWNED_BOOKS,
        records: NO_RECORDS,
        series: NO_SERIES_READS,
      }),
    ).toEqual({
      explained: ["libraryBalance", "series", "records"],
      shown: { libraryBalance: false, records: false, series: false },
    });
  });

  it("hides the library balance without owned books even with books to read", () => {
    const blocks = resolveStatisticsProgressBlocks({ ...FULL, libraryBalance: NO_OWNED_BOOKS });

    expect(blocks.shown.libraryBalance).toBe(false);
  });

  it.each([
    ["unavailable", UNAVAILABLE_SERIES],
    ["without completed reads", NO_SERIES_READS],
  ])("hides series that are %s", (_label, series) => {
    expect(resolveStatisticsProgressBlocks({ ...FULL, series }).shown.series).toBe(false);
  });
});
