import type { BookDetailsView, BookView, ReadingQueueView } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { wishlistKeys } from "@/features/books-to-buy/api/wishlist-keys";
import { characterKeys } from "@/features/characters/api/character-keys";
import { matchesDeliveryKey } from "@/features/delivery/api/delivery-keys";
import { genresKeys, matchesGenreDerivedKey } from "@/features/genres/api/genres-keys";
import { listKeys } from "@/features/lists/api/list-keys";
import { matchesLoans } from "@/features/loans/api/loan-keys";
import {
  matchesPublisherCatalogKey,
  publisherKeys,
} from "@/features/publishers/api/publisher-keys";
import { goalKeys } from "@/features/reading-goals/api/goal-keys";
import { matchesSeriesKey } from "@/features/series/api/series-keys";
import { matchesStatisticsKey } from "@/features/statistics/api/statistics-keys";
import { matchesTagAggregateKey, matchesTagPickerKey } from "@/features/tags/api/tags-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";

import { bookKeys, matchesBookDetail, matchesBookKey } from "./book-keys";
import {
  matchesReadingQueueKey,
  matchesUnfilteredReadingQueueKey,
  readingQueueKeys,
} from "./reading-queue-keys";

const BOOK_KEY_FAMILIES = {
  books: matchesBookKey,
  characters: matchesAnyKeyPrefix(characterKeys.all),
  delivery: matchesDeliveryKey,
  genreDerived: matchesGenreDerivedKey,
  goals: matchesAnyKeyPrefix(goalKeys.root),
  lists: matchesAnyKeyPrefix(listKeys.root),
  loans: matchesLoans,
  publisherCatalog: matchesPublisherCatalogKey,
  publisherPicker: matchesAnyKeyPrefix(publisherKeys.picker.all),
  readingQueue: matchesReadingQueueKey,
  recentGenres: matchesAnyKeyPrefix(genresKeys.recent),
  series: matchesSeriesKey,
  statistics: matchesStatisticsKey,
  tagAggregates: matchesTagAggregateKey,
  tagPickers: matchesTagPickerKey,
  wishlist: matchesAnyKeyPrefix(wishlistKeys.root),
} as const satisfies Record<string, QueryKeyMatcher>;

type BookKeyFamily = keyof typeof BOOK_KEY_FAMILIES;

const BOOK_CHANGE_EFFECTS = {
  created: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "goals",
    "publisherCatalog",
    "publisherPicker",
    "genreDerived",
    "recentGenres",
    "tagAggregates",
    "tagPickers",
    "delivery",
    "loans",
  ],
  dedicationFavorited: ["books"],
  edited: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "goals",
    "publisherCatalog",
    "publisherPicker",
    "genreDerived",
    "recentGenres",
    "characters",
    "delivery",
  ],
  favorited: ["books", "lists", "series"],
  listed: ["books", "lists", "statistics", "goals"],
  listEdited: ["books"],
  loanChanged: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "publisherCatalog",
    "genreDerived",
    "loans",
  ],
  pagesCounted: ["books", "readingQueue", "lists", "series", "statistics"],
  queueChanged: ["books", "readingQueue", "lists", "series", "publisherCatalog", "genreDerived"],
  queueReordered: ["books", "readingQueue"],
  removed: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "goals",
    "publisherCatalog",
    "genreDerived",
    "recentGenres",
    "tagAggregates",
    "characters",
    "delivery",
    "loans",
  ],
  seriesChanged: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "publisherCatalog",
    "characters",
  ],
  seriesCreated: ["series", "statistics"],
  statusChanged: [
    "books",
    "readingQueue",
    "lists",
    "series",
    "statistics",
    "goals",
    "publisherCatalog",
    "genreDerived",
    "delivery",
  ],
  tagged: ["books", "lists", "tagAggregates", "tagPickers"],
  thumbnailReady: ["books"],
  wishlistOutdated: ["wishlist"],
} as const satisfies Record<string, readonly BookKeyFamily[]>;

type BookChange = keyof typeof BOOK_CHANGE_EFFECTS;

function bookSaved(
  queryClient: QueryClient,
  { book, change }: { book: BookView; change: BookChange },
): Promise<void> {
  const detailKey = bookKeys.detail(book.id);
  const cachedDetail = queryClient.getQueryData<BookDetailsView>(detailKey);
  if (cachedDetail === undefined) return booksChanged(queryClient, { changes: [change] });

  queryClient.setQueryData<BookDetailsView>(detailKey, {
    ...book,
    notesCount: cachedDetail.notesCount,
    quotesCount: cachedDetail.quotesCount,
  });

  return booksChanged(queryClient, { changes: [change], keep: [matchesBookDetail(book.id)] });
}

function booksChanged(
  queryClient: QueryClient,
  { changes, keep = [] }: { changes: readonly BookChange[]; keep?: readonly QueryKeyMatcher[] },
): Promise<void> {
  const families = new Set(changes.flatMap((change) => BOOK_CHANGE_EFFECTS[change]));
  const matchers: QueryKeyMatcher[] = [...families].map((family) => BOOK_KEY_FAMILIES[family]);

  return queryClient.invalidateQueries({
    predicate: (query) =>
      matchers.some((matches) => matches(query)) && !keep.some((kept) => kept(query)),
  });
}

function booksRemoved(queryClient: QueryClient, ids: readonly string[]): Promise<void> {
  const removedBookViews = matchesAnyKeyPrefix(
    ...ids.flatMap((id) => [
      bookKeys.detail(id),
      bookKeys.readingHistoryScope(id),
      characterKeys.bookRosterScope(id),
      characterKeys.bookSummaryScope(id),
      characterKeys.suggestionsScope(id),
    ]),
  );
  retireQueries(queryClient, removedBookViews);

  return booksChanged(queryClient, { changes: ["removed"], keep: [removedBookViews] });
}

function readingQueueChanged(
  queryClient: QueryClient,
  { change, view }: { change: BookChange; view?: ReadingQueueView },
): Promise<void> {
  if (view === undefined) return booksChanged(queryClient, { changes: [change] });

  queryClient.setQueryData<ReadingQueueView>(readingQueueKeys.queue(), view);
  queryClient.setQueriesData<ReadingQueueView>(
    { predicate: matchesUnfilteredReadingQueueKey },
    view,
  );

  return booksChanged(queryClient, {
    changes: [change],
    keep: [matchesUnfilteredReadingQueueKey],
  });
}

export const bookChangeEffects = { bookSaved, booksChanged, booksRemoved, readingQueueChanged };
