import type { LibraryPublisherListItem, LibraryPublishersSummary, Nullable } from "@app/shared";

export type PublishersArchiveState =
  | {
      isRefreshing: boolean;
      items: LibraryPublisherListItem[];
      kind: "results";
      totalCount: number;
    }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "noFilteredResults" }
  | { kind: "noSearchResults" };

export type PublishersEmptyEntry =
  "addBook" | "addFirstBook" | "error" | "fillMissingPublishers" | "pending";

type ResolvePublishersArchiveStateInput = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  list: Nullable<{ items: LibraryPublisherListItem[]; totalCount: number }>;
  listFailed: boolean;
  listIsPlaceholder: boolean;
  summaryPending: boolean;
  summaryPublishersCount: Nullable<number>;
};

type ResolvePublishersEmptyEntryInput = {
  summary: Nullable<
    Pick<LibraryPublishersSummary, "booksWithoutPublisherCount" | "booksWithPublisherCount">
  >;
  summaryFailed: boolean;
};

export function resolvePublishersArchiveState({
  hasActiveFilters,
  hasActiveSearch,
  list,
  listFailed,
  listIsPlaceholder,
  summaryPending,
  summaryPublishersCount,
}: ResolvePublishersArchiveStateInput): PublishersArchiveState {
  if (list === null) return listFailed ? { kind: "error" } : { kind: "loading" };
  if (list.items.length > 0) {
    return {
      isRefreshing: listIsPlaceholder,
      items: list.items,
      kind: "results",
      totalCount: list.totalCount,
    };
  }
  if (summaryPublishersCount === 0) return { kind: "empty" };
  if (listIsPlaceholder) return { kind: "loading" };
  if (summaryPending && (hasActiveFilters || hasActiveSearch)) return { kind: "loading" };
  if (hasActiveFilters) return { kind: "noFilteredResults" };
  if (hasActiveSearch) return { kind: "noSearchResults" };
  return { kind: "empty" };
}

export function resolvePublishersEmptyEntry({
  summary,
  summaryFailed,
}: ResolvePublishersEmptyEntryInput): PublishersEmptyEntry {
  if (summary === null) return summaryFailed ? "error" : "pending";
  if (summary.booksWithoutPublisherCount + summary.booksWithPublisherCount === 0) {
    return "addFirstBook";
  }
  if (summary.booksWithoutPublisherCount > 0) return "fillMissingPublishers";
  return "addBook";
}
