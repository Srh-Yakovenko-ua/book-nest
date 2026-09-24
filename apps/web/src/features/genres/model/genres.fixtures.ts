import type {
  GenresOverviewView,
  GenreStatsView,
  GenreSummaryGenreView,
  GenreSummaryView,
} from "@app/shared";

export function makeGenresOverview(
  overrides: Partial<GenresOverviewView> = {},
): GenresOverviewView {
  return { dormantGenres: [], newForYouGenres: [], unratedFinishedGenres: [], ...overrides };
}

export function makeGenreStats(overrides: Partial<GenreStatsView> = {}): GenreStatsView {
  return {
    averageRating: null,
    booksCount: 5,
    coverUrls: [],
    groupKey: "fiction",
    groupName: "Художня література",
    key: "fantasy",
    label: "Фентезі",
    ratedBooksCount: 0,
    readCount: 2,
    readingQueueCount: 0,
    wantToBuyCount: 0,
    ...overrides,
  };
}

export function makeGenreSummary(overrides: Partial<GenreSummaryView> = {}): GenreSummaryView {
  const leader = { leaders: [makeSummaryGenre()], leadersCount: 1 };

  return {
    booksWithGenresCount: 124,
    finishedBooksCount: 40,
    finishedBooksWithGenresCount: 38,
    highestRated: leader,
    libraryBooksCount: 130,
    mostFrequent: leader,
    mostQueued: leader,
    mostRead: leader,
    mostWantedToBuy: leader,
    queuedBooksCount: 20,
    queuedBooksWithGenresCount: 18,
    ratedBooksCount: 30,
    ratedBooksWithGenresCount: 28,
    usedGenresCount: 19,
    wantToBuyBooksCount: 14,
    wantToBuyBooksWithGenresCount: 14,
    ...overrides,
  };
}

export function makeSummaryGenre(
  overrides: Partial<GenreSummaryGenreView> = {},
): GenreSummaryGenreView {
  return {
    averageRating: 8.9,
    booksCount: 66,
    key: "fantasy",
    label: "Фентезі",
    ratedBooksCount: 7,
    readCount: 24,
    readingQueueCount: 12,
    wantToBuyCount: 9,
    ...overrides,
  };
}
