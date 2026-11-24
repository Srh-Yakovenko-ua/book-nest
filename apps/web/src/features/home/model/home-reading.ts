import type {
  HomeActiveBooksPage,
  HomeGoalSection,
  HomeReadingView,
  HomeReadingWeek,
  HomeSectionUnavailableReason,
  Nullable,
} from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { HomePresence } from "./home-onboarding";

export type HomeReadingFacts = {
  activeBooksCount: Nullable<number>;
  goalPresence: HomePresence;
  hasReadToday: Nullable<boolean>;
  historyPresence: HomePresence;
};

export type HomeReadingSection<TData> =
  | { data: TData; kind: "fresh" }
  | { data: TData; kind: "stale" }
  | { kind: "unavailable"; reason: HomeSectionUnavailableReason };

export type HomeReadingState = {
  currentlyReading: HomeReadingSection<HomeActiveBooksPage>;
  readingGoal: HomeReadingSection<HomeGoalSection>;
  readingWeek: HomeReadingSection<HomeReadingWeek>;
  today: string;
};

export type HomeReadingWidget<TData> =
  | { data: TData; kind: "fresh" }
  | { data: TData; kind: "stale" }
  | { kind: "error" }
  | { kind: "loading" };

type HomeSectionResponse<TData> =
  | { data: TData; status: "available" }
  | { reason: HomeSectionUnavailableReason; status: "unavailable" };

const UNKNOWN_READING_FACTS: HomeReadingFacts = {
  activeBooksCount: null,
  goalPresence: "unknown",
  hasReadToday: null,
  historyPresence: "unknown",
};

export function homeReadingFacts(state: HomeReadingState | undefined): HomeReadingFacts {
  if (state === undefined) return UNKNOWN_READING_FACTS;

  const activeBooks = homeSectionData(state.currentlyReading);
  const goal = homeSectionData(state.readingGoal);
  const week = homeSectionData(state.readingWeek);

  return {
    activeBooksCount: activeBooks?.total ?? null,
    goalPresence: goal === null ? "unknown" : goalPresence(goal),
    hasReadToday: week === null ? null : hasReadOn({ day: state.today, week }),
    historyPresence: week === null ? "unknown" : week.hasReadingHistory ? "present" : "absent",
  };
}

export function homeReadingWidget<TData>({
  isError,
  isRefetchError,
  section,
}: {
  isError: boolean;
  isRefetchError: boolean;
  section: HomeReadingSection<TData> | undefined;
}): HomeReadingWidget<TData> {
  if (section === undefined) return isError ? { kind: "error" } : { kind: "loading" };
  if (section.kind === "unavailable") return { kind: "error" };
  if (isRefetchError) return { data: section.data, kind: "stale" };
  return section;
}

export function homeSectionData<TData>(section: HomeReadingSection<TData>): Nullable<TData> {
  return section.kind === "unavailable" ? null : section.data;
}

export function mergeHomeReading({
  next,
  previous,
}: {
  next: HomeReadingView;
  previous: HomeReadingState | undefined;
}): HomeReadingState {
  const sameDay = previous?.today === next.today ? previous : undefined;

  return {
    currentlyReading: mergeSection({
      next: next.currentlyReading,
      previous: sameDay?.currentlyReading,
    }),
    readingGoal: mergeSection({ next: next.readingGoal, previous: sameDay?.readingGoal }),
    readingWeek: mergeSection({ next: next.readingWeek, previous: sameDay?.readingWeek }),
    today: next.today,
  };
}

function goalPresence(goal: HomeGoalSection): HomePresence {
  return goal.activeGoalsCount > 0 || goal.recentCompletion !== null ? "present" : "absent";
}

function hasReadOn({ day, week }: { day: string; week: HomeReadingWeek }): Nullable<boolean> {
  const cell = week.days.find((candidate) => candidate.date === day);
  if (cell === undefined) return null;

  switch (cell.status) {
    case "active":
      return true;
    case "future":
    case "unknown":
      return null;
    case "inactive":
      return false;
    default:
      return assertNever(cell.status);
  }
}

function mergeSection<TData>({
  next,
  previous,
}: {
  next: HomeSectionResponse<TData>;
  previous: HomeReadingSection<TData> | undefined;
}): HomeReadingSection<TData> {
  if (next.status === "available") return { data: next.data, kind: "fresh" };
  if (previous === undefined || previous.kind === "unavailable") {
    return { kind: "unavailable", reason: next.reason };
  }
  return { data: previous.data, kind: "stale" };
}
