import type { Nullable, ReadingGoalMetrics, ReadingGoalPace } from "@app/shared";

const GOAL_FIGURE_SCALE = {
  tenths: 10,
} as const satisfies Record<string, number>;

export type GoalPlanGap = {
  books: number;
  kind: "ahead" | "behind" | "close_behind" | "on_plan";
  pace: ReadingGoalPace;
};

export type GoalRateFigure =
  | { booksPerDay: Nullable<number>; daysPerBook: number; kind: "days_per_book" }
  | { booksPerDay: number; kind: "books_per_day" }
  | { kind: "missing" };

type GoalRateInput = {
  booksPerDay: Nullable<number>;
  daysPerBook: Nullable<number>;
};

export function resolveGoalPlanGap({
  pace,
  paceDeltaBooks,
}: Pick<ReadingGoalMetrics, "pace" | "paceDeltaBooks">): Nullable<GoalPlanGap> {
  if (pace === null || paceDeltaBooks === null) return null;

  const delta = roundToTenth(paceDeltaBooks);
  const books = Math.abs(delta);

  if (pace === "behind" || pace === "critical") {
    return { books: Math.max(-delta, 0), kind: "behind", pace };
  }
  if (delta === 0) return { books, kind: "on_plan", pace };
  if (delta > 0) return { books, kind: "ahead", pace };
  return { books, kind: pace === "on_track" ? "close_behind" : "behind", pace };
}

export function resolveGoalRateFigure({ booksPerDay, daysPerBook }: GoalRateInput): GoalRateFigure {
  const positiveBooksPerDay = booksPerDay !== null && booksPerDay > 0 ? booksPerDay : null;

  if (daysPerBook !== null && daysPerBook > 0) {
    return { booksPerDay: positiveBooksPerDay, daysPerBook, kind: "days_per_book" };
  }
  if (positiveBooksPerDay !== null)
    return { booksPerDay: positiveBooksPerDay, kind: "books_per_day" };
  return { kind: "missing" };
}

export function roundToTenth(value: number): number {
  return Math.round(value * GOAL_FIGURE_SCALE.tenths) / GOAL_FIGURE_SCALE.tenths;
}
