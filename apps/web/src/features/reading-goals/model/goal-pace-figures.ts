import type { Nullable, ReadingGoalMetrics, ReadingGoalPace } from "@app/shared";

const GOAL_FIGURE_SCALE = {
  minWholeDaysPerBook: 1,
  tenths: 10,
} as const satisfies Record<string, number>;

export type GoalRateFigure =
  | { booksPerDay: Nullable<number>; daysPerBook: number; kind: "days_per_book" }
  | { booksPerDay: number; kind: "books_per_day" }
  | { kind: "missing" };

type GoalPaceAdvice =
  | { booksPerDay: number; kind: "books_per_day" }
  | { days: number; kind: "days_per_book" }
  | { kind: "missing" };

type GoalPaceBadge = { kind: "close_to_plan" } | { kind: "pace"; pace: ReadingGoalPace };

type GoalRateInput = {
  booksPerDay: Nullable<number>;
  daysPerBook: Nullable<number>;
};

export function resolveGoalPaceAdvice(rates: GoalRateInput): GoalPaceAdvice {
  const figure = resolveGoalRateFigure(rates);

  if (
    figure.kind === "days_per_book" &&
    figure.daysPerBook >= GOAL_FIGURE_SCALE.minWholeDaysPerBook
  ) {
    return { days: Math.round(figure.daysPerBook), kind: "days_per_book" };
  }

  const booksPerDay = figure.kind === "missing" ? null : figure.booksPerDay;
  if (booksPerDay === null) return { kind: "missing" };
  return { booksPerDay: roundToTenth(booksPerDay), kind: "books_per_day" };
}

export function resolveGoalPaceBadge({
  pace,
  paceDeltaBooks,
}: Pick<ReadingGoalMetrics, "pace" | "paceDeltaBooks">): Nullable<GoalPaceBadge> {
  if (pace === null || paceDeltaBooks === null) return null;
  if (pace === "on_track" && roundToTenth(paceDeltaBooks) < 0) return { kind: "close_to_plan" };
  return { kind: "pace", pace };
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
