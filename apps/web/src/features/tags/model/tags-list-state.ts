import type { TagCatalogListItem, TagQuickFilter } from "@app/shared";

import { TAG_QUICK_FILTER_DEFAULT } from "@app/shared";

export type TagsCatalogSnapshot = {
  data: undefined | { pages: { items: TagCatalogListItem[]; totalCount: number }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
};

export type TagsCriteria = {
  filter: TagQuickFilter;
  hasContextualCriteria: boolean;
  hasSearch: boolean;
};

export type TagsGlobalCounts = {
  totalTagsCount: number;
  unusedCount: number;
};

export type TagsListState =
  | { hasSearch: boolean; kind: "contextual-empty" }
  | {
      isRefreshing: boolean;
      items: TagCatalogListItem[];
      kind: "list";
      nextPage: TagsNextPageState;
      total: number;
    }
  | { kind: "all-used" }
  | { kind: "error" }
  | { kind: "first-use" }
  | { kind: "loading" };

export type TagsNextPageState = "error" | "idle" | "loading" | "none";

type TagsListStateInput = {
  catalog: TagsCatalogSnapshot;
  criteria: TagsCriteria;
  globalCounts: TagsGlobalCounts | undefined;
};

export function tagsListState({
  catalog,
  criteria,
  globalCounts,
}: TagsListStateInput): TagsListState {
  if (catalog.data === undefined) {
    return catalog.isPending ? { kind: "loading" } : { kind: "error" };
  }

  const items = catalog.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    if (catalog.isPlaceholderData) return { kind: "loading" };
    return emptyState(criteria, globalCounts);
  }

  return {
    isRefreshing: catalog.isPlaceholderData,
    items,
    kind: "list",
    nextPage: catalog.isPlaceholderData ? "none" : nextPageState(catalog),
    total: catalog.data.pages.at(-1)?.totalCount ?? items.length,
  };
}

function emptyState(
  criteria: TagsCriteria,
  globalCounts: TagsGlobalCounts | undefined,
): TagsListState {
  const hasAnyCriteria =
    criteria.hasContextualCriteria || criteria.filter !== TAG_QUICK_FILTER_DEFAULT;

  if (!hasAnyCriteria || globalCounts?.totalTagsCount === 0) return { kind: "first-use" };

  if (
    criteria.filter === "unused" &&
    !criteria.hasContextualCriteria &&
    globalCounts?.unusedCount === 0
  ) {
    return { kind: "all-used" };
  }

  return { hasSearch: criteria.hasSearch, kind: "contextual-empty" };
}

function nextPageState(catalog: TagsCatalogSnapshot): TagsNextPageState {
  if (catalog.isFetchingNextPage) return "loading";
  if (catalog.isFetchNextPageError) return "error";
  if (catalog.hasNextPage) return "idle";
  return "none";
}
