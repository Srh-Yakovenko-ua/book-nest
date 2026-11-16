import type { ReadingQueueView } from "@app/shared";
import type { QueryKey } from "@tanstack/react-query";

import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { wishlistKeys } from "@/features/books-to-buy/api/wishlist-keys";
import { relationshipKeys } from "@/features/character-relationships/api/relationship-keys";
import { characterKeys } from "@/features/characters/api/character-keys";
import { deliveryKeys } from "@/features/delivery/api/delivery-keys";
import { loanKeys } from "@/features/loans/api/loan-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { statisticsKeys } from "@/features/statistics/api/statistics-keys";

import { makeBookDetailsView, makeBookView } from "../components/book-details.fixtures";
import { bookChangeEffects } from "./book-change-effects";
import { bookKeys, matchesBookDetail } from "./book-keys";

const KEYS = {
  bookDetail: ["/api/books", "detail", "book-1"],
  bookList: ["/api/books", "list", { page: 1 }],
  characterSuggestions: characterKeys.suggestions("book-1", { q: "" }),
  deliverySummary: deliveryKeys.inTransit.summary,
  filteredQueue: ["/api/reading-queue", { author: ["author-1"] }],
  listDetail: ["/api/lists", "detail", "list-1"],
  listIndex: ["/api/lists", "list", { page: 1 }],
  loansSummary: loanKeys.summary,
  queue: ["/api/reading-queue"],
  queueSummary: ["/api/reading-queue/summary"],
  readingHistory: bookKeys.readingHistory("book-1", { page: 1 }),
  relationshipRoster: relationshipKeys.roster({ bookId: "book-1", sort: "name", term: "" }),
  seriesSearch: seriesKeys.search({ authorIds: [], search: "x" }),
  statisticsOverview: statisticsKeys.overview({ year: 2026 }),
  unrelated: ["/api/notes", "x"],
  wishlist: wishlistKeys.root,
} as const satisfies Record<string, QueryKey>;

const DEDICATION_SAVE = {
  book: makeBookView({ isFavoriteDedication: true }),
  cachedDetail: makeBookDetailsView({ notesCount: 3, quotesCount: 2 }),
};

const STALE_QUEUE: ReadingQueueView = { count: 3, items: [], totalCount: 3, totalPagesCount: 1 };

const FRESH_QUEUE: ReadingQueueView = { count: 2, items: [], totalCount: 2, totalPagesCount: 1 };

function seededClient(keys: readonly QueryKey[]): QueryClient {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, {});
  return client;
}

function staleFlags(client: QueryClient, keys: readonly QueryKey[]): boolean[] {
  return keys.map((key) => client.getQueryState(key)?.isInvalidated ?? false);
}

async function watchedQuery(client: QueryClient, queryKey: QueryKey) {
  const queryFn = vi.fn(() => Promise.resolve({}));
  await client.prefetchQuery({ queryFn, queryKey });
  const observer = new QueryObserver(client, { queryFn, queryKey, staleTime: Infinity });
  return { queryFn, unsubscribe: observer.subscribe(() => undefined) };
}

describe("bookChangeEffects", () => {
  it("refreshes the queue summary and the custom lists after books join the queue", async () => {
    const keys = [KEYS.queueSummary, KEYS.listDetail, KEYS.unrelated];
    const client = seededClient(keys);

    await bookChangeEffects.readingQueueChanged(client, { change: "queueChanged" });

    expect(staleFlags(client, keys)).toEqual([true, true, false]);
  });

  it("refreshes the custom lists after books are deleted", async () => {
    const keys = [KEYS.listDetail, KEYS.listIndex, KEYS.unrelated];
    const client = seededClient(keys);

    await bookChangeEffects.booksRemoved(client, ["book-1"]);

    expect(staleFlags(client, keys)).toEqual([true, true, false]);
  });

  it("writes the returned queue to the unfiltered queue and keeps it fresh", async () => {
    const client = new QueryClient();
    client.setQueryData(KEYS.queue, STALE_QUEUE);

    await bookChangeEffects.readingQueueChanged(client, {
      change: "queueChanged",
      view: FRESH_QUEUE,
    });

    expect(client.getQueryData(KEYS.queue)).toEqual(FRESH_QUEUE);
    expect(staleFlags(client, [KEYS.queue])).toEqual([false]);
  });

  it("refreshes a filtered queue instead of overwriting it with the unfiltered one", async () => {
    const client = new QueryClient();
    client.setQueryData(KEYS.filteredQueue, STALE_QUEUE);

    await bookChangeEffects.readingQueueChanged(client, {
      change: "queueChanged",
      view: FRESH_QUEUE,
    });

    expect(client.getQueryData(KEYS.filteredQueue)).toEqual(STALE_QUEUE);
    expect(staleFlags(client, [KEYS.filteredQueue])).toEqual([true]);
  });

  it("leaves a kept key fresh while the rest of its family goes stale", async () => {
    const keys = [KEYS.bookDetail, KEYS.bookList];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, {
      changes: ["statusChanged"],
      keep: [matchesBookDetail("book-1")],
    });

    expect(staleFlags(client, keys)).toEqual([false, true]);
  });

  it("refetches a watched book once for a change that touches it through several events", async () => {
    const fetchDetail = vi.fn(() => Promise.resolve({ id: "book-1" }));
    const client = new QueryClient();
    await client.prefetchQuery({ queryFn: fetchDetail, queryKey: KEYS.bookDetail });
    const observer = new QueryObserver(client, {
      queryFn: fetchDetail,
      queryKey: KEYS.bookDetail,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    fetchDetail.mockClear();

    await bookChangeEffects.booksChanged(client, {
      changes: ["statusChanged", "listed", "favorited"],
    });
    unsubscribe();

    expect(fetchDetail).toHaveBeenCalledTimes(1);
  });

  it.each([
    { key: KEYS.readingHistory, view: "reading history" },
    { key: KEYS.characterSuggestions, view: "character suggestions" },
    { key: KEYS.relationshipRoster, view: "relationship roster" },
  ])("retires the watched $view of a deleted book without refetching it", async ({ key }) => {
    const client = new QueryClient();
    const watched = await watchedQuery(client, key);

    await bookChangeEffects.booksRemoved(client, ["book-1"]);
    watched.unsubscribe();

    expect(watched.queryFn).toHaveBeenCalledTimes(1);
    expect(staleFlags(client, [key])).toEqual([true]);
  });

  it("refreshes the series search after a series change", async () => {
    const keys = [KEYS.seriesSearch, KEYS.unrelated];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["seriesChanged"] });

    expect(staleFlags(client, keys)).toEqual([true, false]);
  });

  it("refreshes loans and deliveries after a book is created", async () => {
    const keys = [KEYS.loansSummary, KEYS.deliverySummary, KEYS.unrelated];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["created"] });

    expect(staleFlags(client, keys)).toEqual([true, true, false]);
  });

  it("refreshes loans after a book is removed", async () => {
    const keys = [KEYS.loansSummary, KEYS.unrelated];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["removed"] });

    expect(staleFlags(client, keys)).toEqual([true, false]);
  });

  it("listEdited refreshes book queries and leaves lists and statistics alone", async () => {
    const keys = [KEYS.bookList, KEYS.listDetail, KEYS.statisticsOverview];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["listEdited"] });

    expect(staleFlags(client, keys)).toEqual([true, false, false]);
  });

  it("seriesCreated refreshes series and statistics and nothing a new series cannot affect", async () => {
    const keys = [
      KEYS.seriesSearch,
      KEYS.statisticsOverview,
      KEYS.bookList,
      KEYS.queue,
      KEYS.listDetail,
      KEYS.relationshipRoster,
      KEYS.unrelated,
    ];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["seriesCreated"] });

    expect(staleFlags(client, keys)).toEqual([true, true, false, false, false, false, false]);
  });

  it("writes a saved book into its cached detail and keeps the note and quote counts", async () => {
    const { book, cachedDetail } = DEDICATION_SAVE;
    const client = new QueryClient();
    client.setQueryData(bookKeys.detail(book.id), cachedDetail);

    await bookChangeEffects.bookSaved(client, { book, change: "dedicationFavorited" });

    expect(client.getQueryData(bookKeys.detail(book.id))).toEqual(
      makeBookDetailsView({ isFavoriteDedication: true, notesCount: 3, quotesCount: 2 }),
    );
  });

  it("refreshes book lists but not the written detail after a dedication is favorited", async () => {
    const { book, cachedDetail } = DEDICATION_SAVE;
    const client = seededClient([KEYS.bookList]);
    client.setQueryData(bookKeys.detail(book.id), cachedDetail);

    await bookChangeEffects.bookSaved(client, { book, change: "dedicationFavorited" });

    expect(staleFlags(client, [bookKeys.detail(book.id), KEYS.bookList])).toEqual([false, true]);
  });

  it("does not write a partial detail for a book with no cached detail", async () => {
    const { book } = DEDICATION_SAVE;
    const client = seededClient([KEYS.bookList]);

    await bookChangeEffects.bookSaved(client, { book, change: "dedicationFavorited" });

    expect(client.getQueryData(bookKeys.detail(book.id))).toBeUndefined();
    expect(staleFlags(client, [KEYS.bookList])).toEqual([true]);
  });

  it("refreshes the wishlist but not book lists when the wishlist is outdated", async () => {
    const keys = [KEYS.wishlist, KEYS.bookList];
    const client = seededClient(keys);

    await bookChangeEffects.booksChanged(client, { changes: ["wishlistOutdated"] });

    expect(staleFlags(client, keys)).toEqual([true, false]);
  });
});
