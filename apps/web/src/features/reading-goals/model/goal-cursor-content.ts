import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

export type GoalCursorContent<Item> =
  | { footer: InfiniteScrollState; items: Item[]; kind: "items" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" };

type GoalCursorSnapshot<Item> = {
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  items: Item[];
};

export function resolveGoalCursorContent<Item>(
  snapshot: GoalCursorSnapshot<Item>,
): GoalCursorContent<Item> {
  if (snapshot.isError && snapshot.items.length === 0) return { kind: "error" };
  if (snapshot.isPending) return { kind: "loading" };
  if (snapshot.items.length === 0) return { kind: "empty" };
  return { footer: nextPageState(snapshot), items: snapshot.items, kind: "items" };
}

function nextPageState<Item>(snapshot: GoalCursorSnapshot<Item>): InfiniteScrollState {
  if (snapshot.isFetchingNextPage) return "loading";
  if (snapshot.isFetchNextPageError) return "error";
  return snapshot.hasNextPage ? "idle" : "none";
}
