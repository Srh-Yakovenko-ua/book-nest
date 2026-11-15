import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { hashKey } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";
import type {
  BookReadingControllerGetReadingHistoryParams,
  BooksControllerFacetsParams,
  BooksControllerListParams,
  BooksControllerQuickCountsParams,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

import type {
  LibraryListParams,
  LibraryPublisherContext,
  LibraryScope,
} from "../model/library-query";
import type { LibraryBooksRetention } from "./use-books";

export const BOOKS_ROOT = "/api/books";

export const bookKeys = {
  chapters: (id: string) => [...bookKeys.detail(id), "chapters"] as const,
  characterFilterOptions: (params: BooksControllerListParams) =>
    [BOOKS_ROOT, "character-filter-options", params] as const,
  deliveryHistory: (id: string) => [...bookKeys.detail(id), "deliveries"] as const,
  detail: (id: string) => [BOOKS_ROOT, "detail", id] as const,
  facets: (params: BooksControllerFacetsParams) => [`${BOOKS_ROOT}/facets`, params] as const,
  favoritesSummary: [BOOKS_ROOT, "favorites-summary"] as const,
  list: (params: LibraryListParams, retention: LibraryBooksRetention) =>
    [BOOKS_ROOT, "list", params, retention] as const,
  lists: [BOOKS_ROOT, "list"] as const,
  overview: (scope: LibraryScope, context: LibraryPublisherContext | undefined) =>
    context === undefined
      ? ([BOOKS_ROOT, "overview", scope] as const)
      : ([BOOKS_ROOT, "overview", scope, context] as const),
  purchaseStores: [BOOKS_ROOT, "purchase-stores"] as const,
  quickCounts: (params: BooksControllerQuickCountsParams) =>
    [BOOKS_ROOT, "quick-counts", params] as const,
  readingHistory: (id: string, params: BookReadingControllerGetReadingHistoryParams) =>
    [...bookKeys.readingHistoryScope(id), params] as const,
  readingHistoryScope: (id: string) => [`${BOOKS_ROOT}/${id}/reading-history`] as const,
  root: [BOOKS_ROOT] as const,
  soloSearch: (search: string) => [BOOKS_ROOT, "solo-search", search] as const,
  unratedFavorites: [BOOKS_ROOT, "favorites-unrated-preview"] as const,
};

export const matchesBookKey = matchesApiRoot(BOOKS_ROOT);

export function invalidateBookQueries(
  queryClient: QueryClient,
  { keep = [] }: { keep?: readonly QueryKeyMatcher[] } = {},
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => matchesBookKey(query) && !keep.some((kept) => kept(query)),
  });
}

export function matchesAnyBookChapters({ queryKey }: { queryKey: QueryKey }): boolean {
  const [, , bookId] = queryKey;
  return typeof bookId === "string" && hashKey(queryKey) === hashKey(bookKeys.chapters(bookId));
}

export function matchesBookDetail(id: string): QueryKeyMatcher {
  return ({ queryKey }) => isBookDetailKey(queryKey, id);
}

export function matchesBooksExceptDetail(id: string): QueryKeyMatcher {
  const matchesDetail = matchesBookDetail(id);
  return (query) => matchesBookKey(query) && !matchesDetail(query);
}

export function matchesPublisherScopedBookKey(publisherId: string): QueryKeyMatcher {
  return (query) =>
    matchesBookKey(query) &&
    query.queryKey.some((part) => carriesPublisherScope({ part, publisherId }));
}

function carriesPublisherScope({ part, publisherId }: { part: unknown; publisherId: string }) {
  if (typeof part !== "object" || part === null) return false;
  if ("publisherId" in part && part.publisherId === publisherId) return true;
  if (!("publisher" in part)) return false;
  const { publisher } = part;
  return publisher === publisherId || (Array.isArray(publisher) && publisher.includes(publisherId));
}

function isBookDetailKey(key: QueryKey, id: string): boolean {
  return (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === BOOKS_ROOT &&
    key[1] === "detail" &&
    key[2] === id
  );
}
