import type {
  GenreSummaryGenreView,
  GenreSummaryLeaderView,
  GenreSummaryView,
  Nullable,
} from "@app/shared";

import { GENRE_SUMMARY_RULES } from "@app/shared";

import type { GenreAggregate } from "./genre-aggregate.js";

import { compareGenreIdentity } from "./genre-aggregate.js";

export type GenreLibraryCounts = {
  booksWithGenresCount: number;
  finishedBooksCount: number;
  finishedBooksWithGenresCount: number;
  libraryBooksCount: number;
  queuedBooksCount: number;
  queuedBooksWithGenresCount: number;
  ratedBooksCount: number;
  ratedBooksWithGenresCount: number;
  wantToBuyBooksCount: number;
  wantToBuyBooksWithGenresCount: number;
};

type LeaderRanking = (genre: GenreAggregate) => number[];

export function buildGenreSummary({
  genres,
  libraryCounts,
}: {
  genres: GenreAggregate[];
  libraryCounts: GenreLibraryCounts;
}): GenreSummaryView {
  return {
    ...libraryCounts,
    highestRated: selectLeaders({
      candidates: genres.filter(isHighestRatedEligible),
      ranking: (genre) => [genre.averageRating ?? 0, genre.ratedBooksCount],
    }),
    mostFrequent: selectPositiveLeaders({ genres, metric: (genre) => genre.booksCount }),
    mostQueued: selectPositiveLeaders({ genres, metric: (genre) => genre.readingQueueCount }),
    mostRead: selectPositiveLeaders({ genres, metric: (genre) => genre.readCount }),
    mostWantedToBuy: selectPositiveLeaders({ genres, metric: (genre) => genre.wantToBuyCount }),
    usedGenresCount: genres.length,
  };
}

function compareRankingDesc(left: number[], right: number[]): number {
  for (const [index, leftValue] of left.entries()) {
    const difference = (right[index] ?? 0) - leftValue;
    if (difference !== 0) return difference;
  }
  return 0;
}

function isHighestRatedEligible(genre: GenreAggregate): boolean {
  return (
    genre.averageRating !== null &&
    genre.ratedBooksCount >= GENRE_SUMMARY_RULES.highestRatedMinRatedBooks
  );
}

function selectLeaders({
  candidates,
  ranking,
}: {
  candidates: GenreAggregate[];
  ranking: LeaderRanking;
}): Nullable<GenreSummaryLeaderView> {
  const [top] = [...candidates].sort(
    (left, right) =>
      compareRankingDesc(ranking(left), ranking(right)) || compareGenreIdentity(left, right),
  );
  if (top === undefined) return null;
  const topRanking = ranking(top);
  const tied = candidates
    .filter((genre) => compareRankingDesc(ranking(genre), topRanking) === 0)
    .sort(compareGenreIdentity);
  return {
    leaders: tied.slice(0, GENRE_SUMMARY_RULES.leadersLimit).map(toGenreSummaryGenreView),
    leadersCount: tied.length,
  };
}

function selectPositiveLeaders({
  genres,
  metric,
}: {
  genres: GenreAggregate[];
  metric: (genre: GenreAggregate) => number;
}): Nullable<GenreSummaryLeaderView> {
  return selectLeaders({
    candidates: genres.filter((genre) => metric(genre) > 0),
    ranking: (genre) => [metric(genre)],
  });
}

function toGenreSummaryGenreView(genre: GenreAggregate): GenreSummaryGenreView {
  return {
    averageRating: genre.averageRating,
    booksCount: genre.booksCount,
    key: genre.key,
    label: genre.label,
    ratedBooksCount: genre.ratedBooksCount,
    readCount: genre.readCount,
    readingQueueCount: genre.readingQueueCount,
    wantToBuyCount: genre.wantToBuyCount,
  };
}
