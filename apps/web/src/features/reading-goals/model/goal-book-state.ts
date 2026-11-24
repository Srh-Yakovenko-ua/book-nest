import type { Nullable, ReadingGoalBookView, ReadingStatus } from "@app/shared";

export type GoalBookPages =
  | { current: number; kind: "with-total"; percent: number; total: number }
  | { current: number; kind: "without-total" };

export type GoalBookState =
  | { countedFinishedAt: Nullable<string>; kind: "counted" }
  | { finishedAt: string; kind: "finished-outside-window" }
  | { kind: "finished-without-date" }
  | { kind: "in-progress"; pages: GoalBookPages; status: ReadingStatus }
  | { kind: "status-only"; status: ReadingStatus };

const IN_PROGRESS_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "paused",
  "reading",
  "rereading",
]);

const GOAL_BOOK_PERCENT = { max: 100, min: 0 } as const satisfies Record<string, number>;

export function resolveGoalBookState(book: ReadingGoalBookView): GoalBookState {
  const { reading } = book;
  if (book.qualifies) return { countedFinishedAt: book.countedFinishedAt, kind: "counted" };
  if (IN_PROGRESS_STATUSES.has(reading.status) && reading.currentPage !== null) {
    return {
      kind: "in-progress",
      pages: toGoalBookPages({ currentPage: reading.currentPage, pagesCount: reading.pagesCount }),
      status: reading.status,
    };
  }
  if (reading.finishedAt !== null) {
    return { finishedAt: reading.finishedAt, kind: "finished-outside-window" };
  }
  if (reading.status === "finished") return { kind: "finished-without-date" };
  return { kind: "status-only", status: reading.status };
}

function toGoalBookPages({
  currentPage,
  pagesCount,
}: {
  currentPage: number;
  pagesCount: Nullable<number>;
}): GoalBookPages {
  if (pagesCount === null || pagesCount <= 0)
    return { current: currentPage, kind: "without-total" };
  const percent = Math.round((currentPage / pagesCount) * GOAL_BOOK_PERCENT.max);
  return {
    current: currentPage,
    kind: "with-total",
    percent: Math.min(Math.max(percent, GOAL_BOOK_PERCENT.min), GOAL_BOOK_PERCENT.max),
    total: pagesCount,
  };
}
