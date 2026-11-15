import type { CatalogLocale } from "@app/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { partialMatchKey } from "@tanstack/react-query";

import type {
  PublishersControllerDuplicateCandidatesParams,
  PublishersControllerLibraryListParams,
  PublishersControllerLibraryQuickCountsParams,
  PublishersControllerLibrarySummaryLocale,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

const PUBLISHERS_ROOT = "/api/publishers";

export const publisherKeys = {
  detail: (id: string) => [PUBLISHERS_ROOT, "detail", id] as const,
  list: (params: PublishersControllerLibraryListParams) =>
    [PUBLISHERS_ROOT, "list", params] as const,
  overview: (id: string) => [PUBLISHERS_ROOT, "overview", id] as const,
  picker: {
    all: [PUBLISHERS_ROOT, "picker"] as const,
    duplicates: (params: PublishersControllerDuplicateCandidatesParams) =>
      [...publisherKeys.picker.all, "duplicates", params] as const,
    recent: (locale: CatalogLocale) => [...publisherKeys.picker.all, "recent", locale] as const,
    search: (search: string, locale: CatalogLocale) =>
      [...publisherKeys.picker.all, "search", search, locale] as const,
  },
  quickCounts: (params: PublishersControllerLibraryQuickCountsParams) =>
    [PUBLISHERS_ROOT, "quick-counts", params] as const,
  root: [PUBLISHERS_ROOT] as const,
  summary: (locale: PublishersControllerLibrarySummaryLocale) =>
    [PUBLISHERS_ROOT, "summary", locale] as const,
};

const matchesPublishersRoot = matchesApiRoot(PUBLISHERS_ROOT);

export function invalidatePublisherQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: matchesPublisherCatalogKey });
}

export function matchesPublisherCatalogKey(query: { queryKey: QueryKey }): boolean {
  return matchesPublishersRoot(query) && !partialMatchKey(query.queryKey, publisherKeys.picker.all);
}
