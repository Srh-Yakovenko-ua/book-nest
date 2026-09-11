import type { ActiveMoneyAgeBucketRow, ActiveMoneyAgeResponse } from "@app/shared";

import { describe, expect, it } from "vitest";

import { activeAgeBreakdown } from "./statistics-active-age";

function bucket(
  key: ActiveMoneyAgeBucketRow["key"],
  ordersCount: number,
  extra: Partial<ActiveMoneyAgeBucketRow> = {},
): ActiveMoneyAgeBucketRow {
  return {
    booksCount: ordersCount * 2,
    key,
    ordersCount,
    shipmentsCount: 0,
    totalsByCurrency: [],
    ...extra,
  };
}

function response(buckets: ActiveMoneyAgeBucketRow[]): ActiveMoneyAgeResponse {
  return {
    asOf: "2026-09-09T12:00:00.000Z",
    buckets,
    source: { isTruncated: false, loadedOrdersCount: 41, maxOrders: 5000 },
  };
}

describe("activeAgeBreakdown", () => {
  it("measures a bucket against every active order, not against the largest bucket", () => {
    const breakdown = activeAgeBreakdown(
      response([bucket("15_30", 9), bucket("31_plus", 26), bucket("unknown_date", 6)]),
    );

    expect(breakdown.total).toBe(41);
    expect(breakdown.dated.map((row) => row.share)).toEqual([0, 0, 9 / 41, 26 / 41]);
    expect(breakdown.unknown?.share).toBe(6 / 41);
  });

  it("never lets the fullest bucket claim the whole bar", () => {
    const breakdown = activeAgeBreakdown(response([bucket("0_7", 3), bucket("31_plus", 9)]));

    const fullest = breakdown.dated.find((row) => row.key === "31_plus");
    expect(fullest?.share).toBe(0.75);
  });

  it("keeps the four dated buckets in age order however the api sends them", () => {
    const breakdown = activeAgeBreakdown(
      response([bucket("31_plus", 4), bucket("8_14", 1), bucket("0_7", 2), bucket("15_30", 3)]),
    );

    expect(breakdown.dated.map((row) => row.key)).toEqual(["0_7", "8_14", "15_30", "31_plus"]);
  });

  it("fills in a dated bucket the api left out so the age scale stays whole", () => {
    const breakdown = activeAgeBreakdown(response([bucket("31_plus", 5)]));

    expect(breakdown.dated).toHaveLength(4);
    expect(breakdown.dated[0]).toMatchObject({
      booksCount: 0,
      isEmpty: true,
      key: "0_7",
      ordersCount: 0,
      share: 0,
      shipmentsCount: 0,
    });
  });

  it("drops the undated group when nothing lands in it", () => {
    const breakdown = activeAgeBreakdown(response([bucket("0_7", 2), bucket("unknown_date", 0)]));

    expect(breakdown.unknown).toBeNull();
  });

  it("keeps the undated group when it holds orders", () => {
    const breakdown = activeAgeBreakdown(response([bucket("unknown_date", 6)]));

    expect(breakdown.unknown).toMatchObject({ isEmpty: false, key: "unknown_date", share: 1 });
  });

  it("reports zero shares rather than dividing by an empty snapshot", () => {
    const breakdown = activeAgeBreakdown(response([]));

    expect(breakdown.total).toBe(0);
    expect(breakdown.dated.every((row) => row.share === 0 && row.isEmpty)).toBe(true);
    expect(breakdown.unknown).toBeNull();
  });
});
