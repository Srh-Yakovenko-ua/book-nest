import type { Nullable, ReadingGoalListItem } from "@app/shared";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import type { GoalsStatus } from "./goals-query";

import { resolveGoalCursorContent } from "./goal-cursor-content";

export type GoalsCatalogContent =
  | { footer: InfiniteScrollState; goals: ReadingGoalListItem[]; kind: "goals" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filtered-empty"; status: GoalsStatus }
  | { kind: "loading" };

type GoalsCatalogSnapshot = {
  goals: ReadingGoalListItem[];
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  status: Nullable<GoalsStatus>;
};

export function resolveGoalsCatalogContent({
  goals,
  status,
  ...cursor
}: GoalsCatalogSnapshot): GoalsCatalogContent {
  const content = resolveGoalCursorContent({ ...cursor, items: goals });

  if (content.kind === "items") {
    return { footer: content.footer, goals: content.items, kind: "goals" };
  }
  if (content.kind === "empty") {
    return status === null ? { kind: "empty" } : { kind: "filtered-empty", status };
  }
  return content;
}
