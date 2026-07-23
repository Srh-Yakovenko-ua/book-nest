import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { LibraryStatsRow, PriceTotalRow } from "./publisher-library.mapper.js";

import {
  toLibraryPublisherDetailFromModel,
  toLibraryPublisherListItem,
  toLibraryPublishersSummary,
} from "./publisher-library.mapper.js";

const PUBLISHER_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function publisherModel(overrides: Partial<PublisherModel> = {}): PublisherModel {
  return {
    countryCode: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    foundedYear: null,
    id: PUBLISHER_ID,
    logoAttribution: null,
    logoLicense: null,
    logoLicenseUrl: null,
    logoUrl: null,
    name: "Penguin",
    normalizedName: "penguin",
    searchText: "penguin",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    websiteUrl: null,
    wikidataId: null,
    ...overrides,
  };
}

function statsRow(overrides: Partial<LibraryStatsRow> = {}): LibraryStatsRow {
  return {
    averageRating: null,
    booksCount: 0,
    countryCode: null,
    foundedYear: null,
    id: PUBLISHER_ID,
    isCustom: false,
    lastBookAddedAt: null,
    lastBookReadAt: null,
    name: "Penguin",
    queueCount: 0,
    ratedBooksCount: 0,
    readCount: 0,
    readingCount: 0,
    seriesCount: 0,
    wantToBuyCount: 0,
    wantToReadCount: 0,
    websiteUrl: null,
    ...overrides,
  };
}

describe("toLibraryPublisherListItem", () => {
  it("carries the identity fields onto the list item", () => {
    const item = toLibraryPublisherListItem(
      statsRow({
        countryCode: "UA",
        foundedYear: 2001,
        isCustom: true,
        name: "My Press",
        websiteUrl: "https://example.org",
      }),
    );

    expect(item).toMatchObject({
      countryCode: "UA",
      foundedYear: 2001,
      id: PUBLISHER_ID,
      isCustom: true,
      name: "My Press",
      websiteUrl: "https://example.org",
    });
  });

  it("passes every stat count through unchanged", () => {
    const item = toLibraryPublisherListItem(
      statsRow({
        booksCount: 9,
        queueCount: 3,
        ratedBooksCount: 2,
        readCount: 4,
        readingCount: 1,
        seriesCount: 2,
        wantToBuyCount: 5,
        wantToReadCount: 6,
      }),
    );

    expect(item.stats).toMatchObject({
      booksCount: 9,
      queueCount: 3,
      ratedBooksCount: 2,
      readCount: 4,
      readingCount: 1,
      seriesCount: 2,
      wantToBuyCount: 5,
      wantToReadCount: 6,
    });
  });

  it("keeps a null average rating as null", () => {
    const item = toLibraryPublisherListItem(statsRow({ averageRating: null }));

    expect(item.stats.averageRating).toBeNull();
  });

  it("rounds the average rating to two decimals", () => {
    const item = toLibraryPublisherListItem(statsRow({ averageRating: 4.333333333 }));

    expect(item.stats.averageRating).toBe(4.33);
  });

  it("keeps a two-rating average of 4.5 exact", () => {
    const item = toLibraryPublisherListItem(statsRow({ averageRating: 4.5 }));

    expect(item.stats.averageRating).toBe(4.5);
  });

  it("passes the last-added and last-read date strings through unchanged", () => {
    const item = toLibraryPublisherListItem(
      statsRow({
        lastBookAddedAt: "2026-03-01T10:00:00.000Z",
        lastBookReadAt: "2026-01-20T00:00:00.000Z",
      }),
    );

    expect(item.stats.lastBookAddedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(item.stats.lastBookReadAt).toBe("2026-01-20T00:00:00.000Z");
  });
});

describe("toLibraryPublisherDetailFromModel", () => {
  it("marks a model owned by a user as custom with zeroed stats", () => {
    const detail = toLibraryPublisherDetailFromModel(publisherModel({ userId: USER_ID }));

    expect(detail.isCustom).toBe(true);
    expect(detail.stats).toEqual({
      averageRating: null,
      booksCount: 0,
      lastBookAddedAt: null,
      lastBookReadAt: null,
      queueCount: 0,
      ratedBooksCount: 0,
      readCount: 0,
      readingCount: 0,
      seriesCount: 0,
      wantToBuyCount: 0,
      wantToReadCount: 0,
    });
  });

  it("marks a model without a user as not custom", () => {
    const detail = toLibraryPublisherDetailFromModel(publisherModel({ userId: null }));

    expect(detail.isCustom).toBe(false);
  });
});

describe("toLibraryPublishersSummary", () => {
  function priceTotal(overrides: Partial<PriceTotalRow> = {}): PriceTotalRow {
    return { amount: "0.00", currency: "UAH", pricedBooksCount: 0, ...overrides };
  }

  it("rounds the weighted average book rating to two decimals", () => {
    const summary = toLibraryPublishersSummary({
      counts: {
        averageBookRating: 4.25,
        booksWithoutPublisherCount: 0,
        booksWithPublisherCount: 4,
        publishersCount: 2,
        ratedBooksCount: 4,
        wantToBuyBooksCount: 0,
      },
      priceTotals: [],
    });

    expect(summary.averageBookRating).toBe(4.25);
  });

  it("keeps a null average book rating as null", () => {
    const summary = toLibraryPublishersSummary({
      counts: {
        averageBookRating: null,
        booksWithoutPublisherCount: 0,
        booksWithPublisherCount: 0,
        publishersCount: 0,
        ratedBooksCount: 0,
        wantToBuyBooksCount: 0,
      },
      priceTotals: [],
    });

    expect(summary.averageBookRating).toBeNull();
  });

  it("converts each price total amount from a string to a number and keeps its currency bucket", () => {
    const summary = toLibraryPublishersSummary({
      counts: {
        averageBookRating: null,
        booksWithoutPublisherCount: 0,
        booksWithPublisherCount: 0,
        publishersCount: 0,
        ratedBooksCount: 0,
        wantToBuyBooksCount: 0,
      },
      priceTotals: [
        priceTotal({ amount: "10.00", currency: "EUR", pricedBooksCount: 1 }),
        priceTotal({ amount: "500.00", currency: "UAH", pricedBooksCount: 2 }),
      ],
    });

    expect(summary.expectedPriceTotals).toEqual([
      { amount: 10, currency: "EUR", pricedBooksCount: 1 },
      { amount: 500, currency: "UAH", pricedBooksCount: 2 },
    ]);
  });

  it("passes the book counts through unchanged", () => {
    const summary = toLibraryPublishersSummary({
      counts: {
        averageBookRating: null,
        booksWithoutPublisherCount: 3,
        booksWithPublisherCount: 7,
        publishersCount: 4,
        ratedBooksCount: 5,
        wantToBuyBooksCount: 6,
      },
      priceTotals: [],
    });

    expect(summary).toMatchObject({
      booksWithoutPublisherCount: 3,
      booksWithPublisherCount: 7,
      publishersCount: 4,
      ratedBooksCount: 5,
      wantToBuyBooksCount: 6,
    });
  });

  it("returns an empty price totals array when there are no priced books", () => {
    const emptyTotals: Nullable<PriceTotalRow[]> = [];
    const summary = toLibraryPublishersSummary({
      counts: {
        averageBookRating: null,
        booksWithoutPublisherCount: 0,
        booksWithPublisherCount: 0,
        publishersCount: 0,
        ratedBooksCount: 0,
        wantToBuyBooksCount: 0,
      },
      priceTotals: emptyTotals,
    });

    expect(summary.expectedPriceTotals).toEqual([]);
  });
});
