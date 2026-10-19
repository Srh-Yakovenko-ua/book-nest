import type { Nullable, ReadingGoalBookView, ReadingStatus } from "@app/shared";

export type GoalBookState =
  | { countedFinishedAt: Nullable<string>; kind: "counted" }
  | {
      currentPage: number;
      kind: "in-progress";
      pagesCount: Nullable<number>;
      status: ReadingStatus;
    }
  | { finishedAt: string; kind: "finished-outside-window" }
  | { kind: "finished-without-date" }
  | { kind: "status-only"; status: ReadingStatus };

const IN_PROGRESS_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "paused",
  "reading",
  "rereading",
]);

export function resolveGoalBookState(book: ReadingGoalBookView): GoalBookState {
  const { reading } = book;
  if (book.qualifies) return { countedFinishedAt: book.countedFinishedAt, kind: "counted" };
  if (IN_PROGRESS_STATUSES.has(reading.status) && reading.currentPage !== null) {
    return {
      currentPage: reading.currentPage,
      kind: "in-progress",
      pagesCount: reading.pagesCount === 0 ? null : reading.pagesCount,
      status: reading.status,
    };
  }
  if (reading.finishedAt !== null) {
    return { finishedAt: reading.finishedAt, kind: "finished-outside-window" };
  }
  if (reading.status === "finished") return { kind: "finished-without-date" };
  return { kind: "status-only", status: reading.status };
}
