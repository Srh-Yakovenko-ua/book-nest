import type {
  DormantGenreView,
  GenresOverviewView,
  NewForYouGenreView,
  Nullable,
  UnratedFinishedGenreView,
} from "@app/shared";

import { compareAsc, compareDesc } from "date-fns";

import { daysBetweenIsoDates, toIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { compareGenreIdentity } from "./genre-aggregate.js";

export type GenreOverviewAggregate = {
  booksCount: number;
  firstAddedAt: Date;
  key: string;
  label: string;
  lastReadingActivityAt: Nullable<Date>;
  latestUnratedFinishedAt: Nullable<Date>;
  normalizedName: string;
  readCount: number;
  startedBooksCount: number;
  unratedFinishedCount: number;
};

type ActiveGenre = GenreOverviewAggregate & { lastReadingActivityAt: Date };

const GENRES_OVERVIEW_RULES = {
  blockLimit: 2,
  dormantDays: 90,
  multipleBooksMin: 2,
  newGenreWindowDays: 90,
} as const;

export function buildGenresOverview({
  genres,
  now,
}: {
  genres: GenreOverviewAggregate[];
  now: Date;
}): GenresOverviewView {
  return {
    dormantGenres: selectDormantGenres({ genres, now }),
    newForYouGenres: selectNewForYouGenres({ genres, now }),
    unratedFinishedGenres: selectUnratedFinishedGenres(genres),
  };
}

function calendarDaysSince({
  instant,
  todayIsoDate,
}: {
  instant: Date;
  todayIsoDate: string;
}): number {
  return daysBetweenIsoDates({ endIsoDate: todayIsoDate, startIsoDate: toIsoDate(instant) });
}

function compareNullableDateDesc(left: Nullable<Date>, right: Nullable<Date>): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareDesc(left, right);
}

function hasMultipleBooks(genre: GenreOverviewAggregate): number {
  return genre.booksCount >= GENRES_OVERVIEW_RULES.multipleBooksMin ? 1 : 0;
}

function isDormantAsOf(todayIsoDate: string) {
  return (genre: GenreOverviewAggregate): genre is ActiveGenre =>
    genre.lastReadingActivityAt !== null &&
    genre.readCount > 0 &&
    genre.readCount < genre.booksCount &&
    calendarDaysSince({ instant: genre.lastReadingActivityAt, todayIsoDate }) >=
      GENRES_OVERVIEW_RULES.dormantDays;
}

function isNewForYou({
  genre,
  todayIsoDate,
}: {
  genre: GenreOverviewAggregate;
  todayIsoDate: string;
}): boolean {
  return (
    calendarDaysSince({ instant: genre.firstAddedAt, todayIsoDate }) <=
      GENRES_OVERVIEW_RULES.newGenreWindowDays &&
    genre.lastReadingActivityAt === null &&
    genre.startedBooksCount === 0
  );
}

function remainingCount(genre: GenreOverviewAggregate): number {
  return genre.booksCount - genre.readCount;
}

function selectDormantGenres({
  genres,
  now,
}: {
  genres: GenreOverviewAggregate[];
  now: Date;
}): DormantGenreView[] {
  return genres
    .filter(isDormantAsOf(toIsoDate(now)))
    .sort(
      (left, right) =>
        compareAsc(left.lastReadingActivityAt, right.lastReadingActivityAt) ||
        remainingCount(right) - remainingCount(left) ||
        compareGenreIdentity(left, right),
    )
    .slice(0, GENRES_OVERVIEW_RULES.blockLimit)
    .map((genre) => ({
      booksCount: genre.booksCount,
      key: genre.key,
      label: genre.label,
      lastReadingActivityAt: genre.lastReadingActivityAt.toISOString(),
      readCount: genre.readCount,
    }));
}

function selectNewForYouGenres({
  genres,
  now,
}: {
  genres: GenreOverviewAggregate[];
  now: Date;
}): NewForYouGenreView[] {
  const todayIsoDate = toIsoDate(now);
  return genres
    .filter((genre) => isNewForYou({ genre, todayIsoDate }))
    .sort(
      (left, right) =>
        hasMultipleBooks(right) - hasMultipleBooks(left) ||
        compareDesc(left.firstAddedAt, right.firstAddedAt) ||
        right.booksCount - left.booksCount ||
        compareGenreIdentity(left, right),
    )
    .slice(0, GENRES_OVERVIEW_RULES.blockLimit)
    .map((genre) => ({
      booksCount: genre.booksCount,
      firstAddedAt: genre.firstAddedAt.toISOString(),
      key: genre.key,
      label: genre.label,
    }));
}

function selectUnratedFinishedGenres(genres: GenreOverviewAggregate[]): UnratedFinishedGenreView[] {
  return genres
    .filter((genre) => genre.unratedFinishedCount > 0)
    .sort(
      (left, right) =>
        right.unratedFinishedCount - left.unratedFinishedCount ||
        compareNullableDateDesc(left.latestUnratedFinishedAt, right.latestUnratedFinishedAt) ||
        compareGenreIdentity(left, right),
    )
    .slice(0, GENRES_OVERVIEW_RULES.blockLimit)
    .map((genre) => ({
      key: genre.key,
      label: genre.label,
      latestUnratedFinishedAt: toNullableIsoDateTime(genre.latestUnratedFinishedAt),
      unratedFinishedCount: genre.unratedFinishedCount,
    }));
}
