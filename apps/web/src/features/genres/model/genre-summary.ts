import type { GenreSummaryGenreView, GenreSummaryView } from "@app/shared";

import { GENRE_SUMMARY_RULES } from "@app/shared";

export type GenreLeaderCardKey =
  "highestRated" | "mostFrequent" | "mostQueued" | "mostRead" | "mostWantedToBuy";

export type GenreLeaderFact =
  | { hiddenLeadersCount: number; kind: "leaders"; leaders: GenreSummaryGenreView[] }
  | { kind: "missing"; reason: GenreSummaryMissingReason };

export type GenreSummaryMissingReason =
  | "emptyLibrary"
  | "finishedWithoutGenres"
  | "noFinished"
  | "noGenresOnBooks"
  | "noRatedWithGenres"
  | "noRatings"
  | "noWantToBuy"
  | "queueEmpty"
  | "queueWithoutGenres"
  | "ratingSampleTooSmall"
  | "wantToBuyWithoutGenres";

export type UsedGenresFact =
  | { booksCount: number; kind: "inBooks" }
  | {
      kind: "missing";
      reason: Extract<GenreSummaryMissingReason, "emptyLibrary" | "noGenresOnBooks">;
    };

const MISSING_LEADER_REASON = {
  highestRated: (summary) => {
    if (summary.ratedBooksCount === 0) return "noRatings";
    if (summary.ratedBooksWithGenresCount === 0) return "noRatedWithGenres";
    return "ratingSampleTooSmall";
  },
  mostFrequent: () => "noGenresOnBooks",
  mostQueued: (summary) =>
    summary.queuedBooksCount > 0 && summary.queuedBooksWithGenresCount === 0
      ? "queueWithoutGenres"
      : "queueEmpty",
  mostRead: (summary) =>
    summary.finishedBooksCount > 0 && summary.finishedBooksWithGenresCount === 0
      ? "finishedWithoutGenres"
      : "noFinished",
  mostWantedToBuy: (summary) =>
    summary.wantToBuyBooksCount > 0 && summary.wantToBuyBooksWithGenresCount === 0
      ? "wantToBuyWithoutGenres"
      : "noWantToBuy",
} as const satisfies Record<
  GenreLeaderCardKey,
  (summary: GenreSummaryView) => GenreSummaryMissingReason
>;

export function genreLeaderFact(
  summary: GenreSummaryView,
  key: GenreLeaderCardKey,
): GenreLeaderFact {
  if (summary.libraryBooksCount === 0) return { kind: "missing", reason: "emptyLibrary" };

  const leader = summary[key];
  const leaders = leader?.leaders.slice(0, GENRE_SUMMARY_RULES.leadersLimit) ?? [];
  if (leader === null || leaders.length === 0) {
    return { kind: "missing", reason: MISSING_LEADER_REASON[key](summary) };
  }

  return {
    hiddenLeadersCount: Math.max(0, leader.leadersCount - leaders.length),
    kind: "leaders",
    leaders,
  };
}

export function usedGenresFact(summary: GenreSummaryView): UsedGenresFact {
  if (summary.libraryBooksCount === 0) return { kind: "missing", reason: "emptyLibrary" };
  if (summary.booksWithGenresCount === 0) return { kind: "missing", reason: "noGenresOnBooks" };
  return { booksCount: summary.booksWithGenresCount, kind: "inBooks" };
}
