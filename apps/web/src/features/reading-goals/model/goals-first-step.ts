import type { CollectionPresence } from "@/lib/collection-presence";

export type { CollectionPresence } from "@/lib/collection-presence";

export type GoalsFirstStep =
  | { kind: "add-first-book" }
  | { kind: "create-goal" }
  | { kind: "error"; retry: () => void }
  | { kind: "fill-list" }
  | { kind: "pending" };

export function resolveGoalsFirstStep({
  eligibleLists,
  library,
}: {
  eligibleLists: CollectionPresence;
  library: CollectionPresence;
}): GoalsFirstStep {
  if (library.kind !== "ready") return library;
  if (library.total === 0) return { kind: "add-first-book" };
  if (eligibleLists.kind !== "ready") return eligibleLists;
  if (eligibleLists.total === 0) return { kind: "fill-list" };
  return { kind: "create-goal" };
}
