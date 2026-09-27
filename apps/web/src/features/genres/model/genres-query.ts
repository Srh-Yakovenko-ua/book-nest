import type { GenreQuickFilter, GenreSort, Nullable } from "@app/shared";

import {
  BOOK_RATING,
  GENRE_QUICK_FILTER_DEFAULT,
  GENRE_SORT_DEFAULT,
  GenreFacetsQuerySchema,
  GenreGroupKeySchema,
  GenreQuickFilterSchema,
  GenreSortSchema,
} from "@app/shared";
import {
  createParser,
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

export type GenresAdvancedFilters = {
  booksMax: Nullable<number>;
  booksMin: Nullable<number>;
  group: string[];
  ratingMax: Nullable<number>;
  ratingMin: Nullable<number>;
};

export type GenresDatasetParams = {
  booksMax?: number;
  booksMin?: number;
  group?: string[];
  q?: string;
  ratingMax?: number;
  ratingMin?: number;
};

export type GenresListParams = GenresDatasetParams & {
  filter: GenreQuickFilter;
  sort: GenreSort;
};

export type GenresQueryState = inferParserType<typeof GENRES_QUERY_PARSERS>;

export type GenresStatePatch = {
  [Key in keyof GenresQueryState]?: Nullable<GenresQueryState[Key]>;
};

export const GENRES_QUERY = {
  booksBoundSchema: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
  emptyAdvanced: {
    booksMax: null,
    booksMin: null,
    group: [],
    ratingMax: null,
    ratingMin: null,
  } satisfies GenresAdvancedFilters,
  quickFilters: GenreQuickFilterSchema.options,
  rating: BOOK_RATING,
  ratingBoundSchema: z.coerce
    .number()
    .min(BOOK_RATING.min)
    .max(BOOK_RATING.max)
    .multipleOf(BOOK_RATING.step),
  search: {
    minLength: 2,
    schema: GenreFacetsQuerySchema.shape.q,
  },
  sortOptions: GenreSortSchema.options,
};

function parseAsSchema<T>(schema: z.ZodType<T>) {
  return createParser({
    parse: (value: string) => {
      const result = schema.safeParse(value);
      return result.success ? result.data : null;
    },
    serialize: (value: T) => String(value),
  });
}

export const GENRES_QUERY_PARSERS = {
  booksMax: parseAsSchema(GENRES_QUERY.booksBoundSchema),
  booksMin: parseAsSchema(GENRES_QUERY.booksBoundSchema),
  filter: parseAsStringLiteral(GENRES_QUERY.quickFilters).withDefault(GENRE_QUICK_FILTER_DEFAULT),
  group: parseAsArrayOf(parseAsSchema(GenreGroupKeySchema)).withDefault([]),
  q: parseAsString.withDefault(""),
  ratingMax: parseAsSchema(GENRES_QUERY.ratingBoundSchema),
  ratingMin: parseAsSchema(GENRES_QUERY.ratingBoundSchema),
  sort: parseAsStringLiteral(GENRES_QUERY.sortOptions).withDefault(GENRE_SORT_DEFAULT),
};

export function activeAdvancedFilterCount(filters: GenresAdvancedFilters): number {
  const normalized = normalizeAdvancedFilters(filters);
  return [
    normalized.group.length > 0,
    normalized.booksMin !== null || normalized.booksMax !== null,
    normalized.ratingMin !== null || normalized.ratingMax !== null,
  ].filter(Boolean).length;
}

export function advancedFiltersOf(state: GenresQueryState): GenresAdvancedFilters {
  return {
    booksMax: state.booksMax,
    booksMin: state.booksMin,
    group: state.group,
    ratingMax: state.ratingMax,
    ratingMin: state.ratingMin,
  };
}

export function committedGenresSearch(query: string): string {
  const parsed = GENRES_QUERY.search.schema.safeParse(normalizeGenresSearch(query));
  if (!parsed.success || parsed.data === undefined) return "";
  return isGenresSearchCommittable(parsed.data) ? parsed.data : "";
}

export function hasActiveGenresFilters(state: GenresQueryState): boolean {
  return (
    state.filter !== GENRE_QUICK_FILTER_DEFAULT ||
    activeAdvancedFilterCount(advancedFiltersOf(state)) > 0
  );
}

export function hasInvertedBooksRange(
  filters: Pick<GenresAdvancedFilters, "booksMax" | "booksMin">,
) {
  return (
    filters.booksMin !== null && filters.booksMax !== null && filters.booksMin > filters.booksMax
  );
}

export function isGenresSearchCommittable(value: string): boolean {
  return value.length === 0 || value.length >= GENRES_QUERY.search.minLength;
}

export function normalizeAdvancedFilters(filters: GenresAdvancedFilters): GenresAdvancedFilters {
  const booksInverted = hasInvertedBooksRange(filters);
  const ratingInverted =
    filters.ratingMin !== null &&
    filters.ratingMax !== null &&
    filters.ratingMin > filters.ratingMax;

  return {
    booksMax: booksInverted ? null : filters.booksMax,
    booksMin: booksInverted ? null : filters.booksMin,
    group: [...new Set(filters.group)],
    ratingMax:
      ratingInverted || filters.ratingMax === GENRES_QUERY.rating.max ? null : filters.ratingMax,
    ratingMin:
      ratingInverted || filters.ratingMin === GENRES_QUERY.rating.min ? null : filters.ratingMin,
  };
}

export function resetGenresFiltersPatch(): GenresStatePatch {
  return {
    booksMax: null,
    booksMin: null,
    filter: null,
    group: null,
    ratingMax: null,
    ratingMin: null,
  };
}

export function toGenresAdvancedPatch(filters: GenresAdvancedFilters): GenresStatePatch {
  const normalized = normalizeAdvancedFilters(filters);
  return { ...normalized, group: normalized.group.length === 0 ? null : normalized.group };
}

export function toGenresDatasetParams(state: GenresQueryState): GenresDatasetParams {
  const search = committedGenresSearch(state.q);
  const filters = normalizeAdvancedFilters(advancedFiltersOf(state));

  return {
    ...(search === "" ? {} : { q: search }),
    ...(filters.group.length === 0 ? {} : { group: filters.group }),
    ...(filters.booksMin === null ? {} : { booksMin: filters.booksMin }),
    ...(filters.booksMax === null ? {} : { booksMax: filters.booksMax }),
    ...(filters.ratingMin === null ? {} : { ratingMin: filters.ratingMin }),
    ...(filters.ratingMax === null ? {} : { ratingMax: filters.ratingMax }),
  };
}

export function toGenresListParams(state: GenresQueryState): GenresListParams {
  return { ...toGenresDatasetParams(state), filter: state.filter, sort: state.sort };
}

function normalizeGenresSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
