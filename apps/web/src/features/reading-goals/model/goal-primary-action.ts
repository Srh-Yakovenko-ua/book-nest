import type { Nullable, ReadingGoalDetail } from "@app/shared";

export type GoalPrimaryAction = { bookId: string; kind: "continue" } | { kind: "books" };

export function resolveGoalPrimaryAction({
  remainingBooks,
  status,
}: Pick<ReadingGoalDetail, "remainingBooks" | "status">): Nullable<GoalPrimaryAction> {
  if (status !== "active") return null;

  const bookInProgress = remainingBooks.find((book) => book.reading.status === "reading");
  if (bookInProgress === undefined) return { kind: "books" };
  return { bookId: bookInProgress.id, kind: "continue" };
}
