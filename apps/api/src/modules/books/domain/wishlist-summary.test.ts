import type { BestOfferView, Nullable, WishlistCountsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { computeWishlistSummary } from "./wishlist-summary.js";

const ZERO_COUNTS: WishlistCountsView = {
  addedLast30Days: 0,
  missingFromSeries: { booksCount: 0, seriesCount: 0 },
  nextInSeries: { booksCount: 0, seriesCount: 0 },
  waitingOverSixMonths: 0,
};

function offer(currency: BestOfferView["currency"], price: number): BestOfferView {
  return { currency, price };
}

describe("computeWishlistSummary", () => {
  it("returns zeros for an empty wishlist", () => {
    expect(computeWishlistSummary({ bestOffers: [], counts: ZERO_COUNTS, storeNames: [] })).toEqual(
      {
        booksCount: 0,
        counts: {
          addedLast30Days: 0,
          missingFromSeries: { booksCount: 0, seriesCount: 0 },
          nextInSeries: { booksCount: 0, seriesCount: 0 },
          waitingOverSixMonths: 0,
        },
        estimates: [],
        trackedStoresCount: 0,
      },
    );
  });

  it("carries the precomputed counts through without recomputing them from the offers", () => {
    const counts: WishlistCountsView = {
      addedLast30Days: 3,
      missingFromSeries: { booksCount: 4, seriesCount: 2 },
      nextInSeries: { booksCount: 1, seriesCount: 1 },
      waitingOverSixMonths: 2,
    };

    const result = computeWishlistSummary({
      bestOffers: [offer("UAH", 100)],
      counts,
      storeNames: [],
    });

    expect(result.counts).toEqual({
      addedLast30Days: 3,
      missingFromSeries: { booksCount: 4, seriesCount: 2 },
      nextInSeries: { booksCount: 1, seriesCount: 1 },
      waitingOverSixMonths: 2,
    });
  });

  it("aggregates total, average and best for a single currency", () => {
    const result = computeWishlistSummary({
      bestOffers: [offer("UAH", 349), offer("UAH", 199.5)],
      counts: ZERO_COUNTS,
      storeNames: ["Yakaboo", "Book24"],
    });

    expect(result.booksCount).toBe(2);
    expect(result.estimates).toEqual([
      { average: 274.25, best: 199.5, booksCount: 2, currency: "UAH", total: 548.5 },
    ]);
  });

  it("groups estimates by currency without conversion and sorts by currency", () => {
    const result = computeWishlistSummary({
      bestOffers: [offer("USD", 20), offer("EUR", 5), offer("UAH", 100), offer("UAH", 200)],
      counts: ZERO_COUNTS,
      storeNames: [],
    });

    expect(result.estimates).toEqual([
      { average: 5, best: 5, booksCount: 1, currency: "EUR", total: 5 },
      { average: 150, best: 100, booksCount: 2, currency: "UAH", total: 300 },
      { average: 20, best: 20, booksCount: 1, currency: "USD", total: 20 },
    ]);
  });

  it("counts distinct store names across all books", () => {
    const result = computeWishlistSummary({
      bestOffers: [offer("UAH", 100)],
      counts: ZERO_COUNTS,
      storeNames: ["Yakaboo", "Book24", "Yakaboo"],
    });

    expect(result.trackedStoresCount).toBe(2);
  });

  it("excludes books without a best offer from the estimates but counts them in booksCount", () => {
    const bestOffers: Nullable<BestOfferView>[] = [offer("UAH", 100), null, null];

    const result = computeWishlistSummary({
      bestOffers,
      counts: ZERO_COUNTS,
      storeNames: ["Yakaboo"],
    });

    expect(result.booksCount).toBe(3);
    expect(result.estimates).toEqual([
      { average: 100, best: 100, booksCount: 1, currency: "UAH", total: 100 },
    ]);
  });
});
