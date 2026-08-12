import { ListDetailsControllerDetailTab } from "@/shared/api/generated/model";

import type { ListDetailQueryState } from "./list-detail-query";

import { LIST_BOOK_SORT_DEFAULT } from "./list-book-sort";
import { hasActiveListDetailFilters, hasActiveListDetailSearch } from "./list-detail-query";
import { activeListDetailTab } from "./list-detail-tabs";

export type ListBookReorder =
  { canMoveDown: boolean; canMoveUp: boolean; kind: "movable" } | { kind: "locked" };

export function canReorderListDetail({
  isFetching,
  state,
}: {
  isFetching: boolean;
  state: ListDetailQueryState;
}): boolean {
  return isListDetailOrderView(state) && !isFetching;
}

export function isListDetailOrderView(state: ListDetailQueryState): boolean {
  if (state.sort !== LIST_BOOK_SORT_DEFAULT) return false;
  if (hasActiveListDetailSearch(state)) return false;
  if (hasActiveListDetailFilters(state)) return false;
  return activeListDetailTab(state) === ListDetailsControllerDetailTab.all;
}

export function listBookReorder({
  bookCount,
  canReorder,
  position,
}: {
  bookCount: number;
  canReorder: boolean;
  position: number;
}): ListBookReorder {
  if (!canReorder) return { kind: "locked" };
  return {
    canMoveDown: position < bookCount,
    canMoveUp: position > 1,
    kind: "movable",
  };
}
