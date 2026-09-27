import type { LibraryPublisherListItem, Nullable } from "@app/shared";

export type PublishersArchiveState =
  | { items: LibraryPublisherListItem[]; kind: "results"; totalCount: number }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "noFilteredResults" }
  | { kind: "noSearchResults" };

type ResolvePublishersArchiveStateInput = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  list: Nullable<{ items: LibraryPublisherListItem[]; totalCount: number }>;
  listFailed: boolean;
  summaryPending: boolean;
  summaryPublishersCount: Nullable<number>;
};

export function resolvePublishersArchiveState({
  hasActiveFilters,
  hasActiveSearch,
  list,
  listFailed,
  summaryPending,
  summaryPublishersCount,
}: ResolvePublishersArchiveStateInput): PublishersArchiveState {
  if (list === null) return listFailed ? { kind: "error" } : { kind: "loading" };
  if (list.items.length > 0) {
    return { items: list.items, kind: "results", totalCount: list.totalCount };
  }
  if (summaryPublishersCount === 0) return { kind: "empty" };
  if (summaryPending && (hasActiveFilters || hasActiveSearch)) return { kind: "loading" };
  if (hasActiveFilters) return { kind: "noFilteredResults" };
  if (hasActiveSearch) return { kind: "noSearchResults" };
  return { kind: "empty" };
}
