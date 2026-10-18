import type { CustomListCard } from "@app/shared";

import type { ListsListParams } from "@/features/lists/model/lists-query";
import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { LIST_SORT_DEFAULT, LISTS_PAGE_SIZE } from "@/features/lists/model/lists-query";
import { ListsControllerSearchFillItem } from "@/shared/api/generated/model";

import { resolveGoalCursorContent } from "./goal-cursor-content";

export type GoalListPickerContent =
  | { footer: InfiniteScrollState; kind: "lists"; lists: CustomListCard[] }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "no-lists" }
  | { kind: "no-matches" };

type GoalListPickerSnapshot = {
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  lists: CustomListCard[];
  search: string;
};

export function goalListPickerParams(search: string): ListsListParams {
  return {
    fill: [ListsControllerSearchFillItem.with_books],
    pageSize: LISTS_PAGE_SIZE,
    sort: LIST_SORT_DEFAULT,
    ...(search === "" ? {} : { search }),
  };
}

export function resolveGoalListPickerContent({
  lists,
  search,
  ...cursor
}: GoalListPickerSnapshot): GoalListPickerContent {
  const content = resolveGoalCursorContent({ ...cursor, items: lists });

  if (content.kind === "items") {
    return { footer: content.footer, kind: "lists", lists: content.items };
  }
  if (content.kind === "empty") {
    return search === "" ? { kind: "no-lists" } : { kind: "no-matches" };
  }
  return content;
}
