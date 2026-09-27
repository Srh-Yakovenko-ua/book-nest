import type {
  GenreFacetsQuery,
  GenreGroupFacet,
  GenreQuickCounts,
  GenreQuickFilter,
  GenreSort,
  Nullable,
} from "@app/shared";

import { normalizeName } from "@app/shared";

import type { GenreAggregate } from "./genre-aggregate.js";

import { compareGenreIdentity } from "./genre-aggregate.js";

type GenreComparator = (left: GenreAggregate, right: GenreAggregate) => number;

const GENRE_QUICK_FILTER_PREDICATES: Record<GenreQuickFilter, (genre: GenreAggregate) => boolean> =
  {
    all: () => true,
    finished: (genre) => genre.readCount > 0,
    in_queue: (genre) => genre.readingQueueCount > 0,
    unread: (genre) => genre.booksCount - genre.readCount > 0,
    want_to_buy: (genre) => genre.wantToBuyCount > 0,
  };

const byCountDesc =
  (metric: (genre: GenreAggregate) => number): GenreComparator =>
  (left, right) =>
    metric(right) - metric(left) || compareGenreIdentity(left, right);

const GENRE_SORT_COMPARATORS: Record<GenreSort, GenreComparator> = {
  books_count_desc: byCountDesc((genre) => genre.booksCount),
  name_asc: compareGenreIdentity,
  queue_count_desc: byCountDesc((genre) => genre.readingQueueCount),
  rating_desc: (left, right) =>
    compareNullableDesc(left.averageRating, right.averageRating) ||
    compareGenreIdentity(left, right),
  read_count_desc: byCountDesc((genre) => genre.readCount),
};

export function applyGenresDatasetCriteria({
  criteria,
  genres,
}: {
  criteria: GenreFacetsQuery;
  genres: GenreAggregate[];
}): GenreAggregate[] {
  const search = criteria.q === undefined ? "" : normalizeName(criteria.q);
  const groups = new Set(criteria.group ?? []);
  return genres.filter(
    (genre) =>
      matchesSearch({ genre, search }) &&
      (groups.size === 0 || groups.has(genre.groupKey)) &&
      isWithin({ max: criteria.booksMax, min: criteria.booksMin, value: genre.booksCount }) &&
      matchesRatingRange({ criteria, genre }),
  );
}

export function countGenreQuickFilters(genres: GenreAggregate[]): GenreQuickCounts {
  const countMatching = (filter: GenreQuickFilter): number =>
    genres.filter(GENRE_QUICK_FILTER_PREDICATES[filter]).length;
  return {
    all: countMatching("all"),
    finished: countMatching("finished"),
    in_queue: countMatching("in_queue"),
    unread: countMatching("unread"),
    want_to_buy: countMatching("want_to_buy"),
  };
}

export function listGenreGroups(genres: GenreAggregate[]): GenreGroupFacet[] {
  const groupsByKey = new Map<string, { label: string; sortOrder: number }>();
  for (const genre of genres) {
    const known = groupsByKey.get(genre.groupKey);
    if (known === undefined || genre.sortOrder < known.sortOrder) {
      groupsByKey.set(genre.groupKey, { label: genre.groupName, sortOrder: genre.sortOrder });
    }
  }
  return [...groupsByKey]
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        left.sortOrder - right.sortOrder || leftKey.localeCompare(rightKey),
    )
    .map(([key, group]) => ({ key, label: group.label }));
}

export function selectGenresResult({
  filter,
  genres,
  sort,
}: {
  filter: GenreQuickFilter;
  genres: GenreAggregate[];
  sort: GenreSort;
}): GenreAggregate[] {
  return genres.filter(GENRE_QUICK_FILTER_PREDICATES[filter]).sort(GENRE_SORT_COMPARATORS[sort]);
}

function compareNullableDesc(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function isWithin({
  max,
  min,
  value,
}: {
  max: number | undefined;
  min: number | undefined;
  value: number;
}): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

function matchesRatingRange({
  criteria,
  genre,
}: {
  criteria: GenreFacetsQuery;
  genre: GenreAggregate;
}): boolean {
  if (criteria.ratingMin === undefined && criteria.ratingMax === undefined) return true;
  if (genre.averageRating === null) return false;
  return isWithin({ max: criteria.ratingMax, min: criteria.ratingMin, value: genre.averageRating });
}

function matchesSearch({ genre, search }: { genre: GenreAggregate; search: string }): boolean {
  if (search === "") return true;
  return genre.normalizedName.includes(search) || normalizeName(genre.label).includes(search);
}
