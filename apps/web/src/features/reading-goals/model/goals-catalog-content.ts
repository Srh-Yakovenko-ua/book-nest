import type { ReadingGoalListItem } from "@app/shared";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { resolveGoalCursorContent } from "./goal-cursor-content";

export type GoalsCatalogContent =
  | { footer: InfiniteScrollState; goals: ReadingGoalListItem[]; kind: "goals" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filtered-empty" }
  | { kind: "loading" };

type GoalsCatalogSnapshot = {
  goals: ReadingGoalListItem[];
  hasNextPage: boolean;
  hasStatusFilter: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
};

export function resolveGoalsCatalogContent({
  goals,
  hasStatusFilter,
  ...cursor
}: GoalsCatalogSnapshot): GoalsCatalogContent {
  const content = resolveGoalCursorContent({ ...cursor, items: goals });

  if (content.kind === "items") {
    return { footer: content.footer, goals: content.items, kind: "goals" };
  }
  if (content.kind === "empty") {
    return hasStatusFilter ? { kind: "filtered-empty" } : { kind: "empty" };
  }
  return content;
}
