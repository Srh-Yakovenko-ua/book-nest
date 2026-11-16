import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { matchesBookKey, matchesPublisherScopedBookKey } from "@/features/books/api/book-keys";
import { matchesSeriesKey } from "@/features/series/api/series-keys";
import { matchesStatisticsKey } from "@/features/statistics/api/statistics-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";

import { matchesPublisherCatalogKey, publisherKeys } from "./publisher-keys";

const PUBLISHER_KEY_FAMILIES = {
  books: matchesBookKey,
  catalog: matchesPublisherCatalogKey,
  picker: matchesAnyKeyPrefix(publisherKeys.picker.all),
  series: matchesSeriesKey,
  statistics: matchesStatisticsKey,
} as const satisfies Record<string, QueryKeyMatcher>;

type PublisherKeyFamily = keyof typeof PUBLISHER_KEY_FAMILIES;

const PUBLISHER_CHANGE_EFFECTS = {
  deleted: ["catalog", "picker", "books"],
  merged: ["catalog", "picker", "books", "series", "statistics"],
  updated: ["catalog", "picker", "books", "series", "statistics"],
} as const satisfies Record<string, readonly PublisherKeyFamily[]>;

type PublisherChange = keyof typeof PUBLISHER_CHANGE_EFFECTS;

function publisherRemoved(
  queryClient: QueryClient,
  { change, publisherId }: { change: "deleted" | "merged"; publisherId: string },
): Promise<void> {
  const removedViews = matchesAnyKeyPrefix(
    publisherKeys.detail(publisherId),
    publisherKeys.overview(publisherId),
  );
  const removedBooks = matchesPublisherScopedBookKey(publisherId);
  retireQueries(queryClient, removedViews);
  retireQueries(queryClient, removedBooks);

  return publishersChanged(queryClient, { change, keep: [removedViews, removedBooks] });
}

function publishersChanged(
  queryClient: QueryClient,
  { change, keep = [] }: { change: PublisherChange; keep?: readonly QueryKeyMatcher[] },
): Promise<void> {
  const families: readonly PublisherKeyFamily[] = PUBLISHER_CHANGE_EFFECTS[change];
  const matchers: QueryKeyMatcher[] = families.map((family) => PUBLISHER_KEY_FAMILIES[family]);

  return queryClient.invalidateQueries({
    predicate: (query) =>
      matchers.some((matches) => matches(query)) && !keep.some((kept) => kept(query)),
  });
}

export const publisherChangeEffects = { publisherRemoved, publishersChanged };
