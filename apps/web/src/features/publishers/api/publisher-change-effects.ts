import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { invalidateBookQueries } from "@/features/books/api/book-keys";
import { invalidateSeriesQueries } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";

import { matchesPublisherCatalogKey, publisherKeys } from "./publisher-keys";

export function invalidatePublisherIdentityViews(
  queryClient: QueryClient,
  { keep = [] }: { keep?: readonly QueryKeyMatcher[] } = {},
): void {
  void queryClient.invalidateQueries({
    predicate: (query) => matchesPublisherCatalogKey(query) && !keep.some((kept) => kept(query)),
  });
  void queryClient.invalidateQueries({ queryKey: publisherKeys.picker.all });
  void invalidateBookQueries(queryClient, { keep });
  void invalidateSeriesQueries(queryClient);
  void invalidateStatisticsQueries(queryClient);
}
