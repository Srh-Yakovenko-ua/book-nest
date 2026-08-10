import type { BookStoreLinkView, WishlistBookView, WishlistSummaryView } from "@app/shared";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

export function makeStoreLink(overrides: Partial<BookStoreLinkView> = {}): BookStoreLinkView {
  return {
    bookId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: "2026-03-01T10:00:00.000Z",
    currency: "UAH",
    id: "link-1",
    price: 450,
    storeName: "Yakaboo",
    updatedAt: "2026-03-01T10:00:00.000Z",
    url: "https://yakaboo.ua/last-wish",
    ...overrides,
  };
}

export function makeWishlistBook(overrides: Partial<WishlistBookView> = {}): WishlistBookView {
  const { bestOffer, storeLinks, ...bookOverrides } = overrides;

  return {
    ...makeBookView({ ownershipStatus: "want_to_buy", ...bookOverrides }),
    bestOffer: bestOffer ?? null,
    storeLinks: storeLinks ?? [],
  };
}

export function makeWishlistSummary(
  overrides: Partial<WishlistSummaryView> = {},
): WishlistSummaryView {
  return {
    booksCount: 1,
    counts: {
      addedLast30Days: 0,
      missingFromSeries: { booksCount: 0, seriesCount: 0 },
      nextInSeries: { booksCount: 0, seriesCount: 0 },
      waitingOverSixMonths: 0,
    },
    estimates: [],
    trackedStoresCount: 0,
    ...overrides,
  };
}
