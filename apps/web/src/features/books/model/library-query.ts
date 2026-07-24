import type { Nullable } from "@app/shared";

import {
  type inferParserType,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import {
  BooksControllerListAgeCategoryItem,
  BooksControllerListBookType,
  BooksControllerListFormatItem,
  BooksControllerListLanguageItem,
  BooksControllerListOwnerItem,
  BooksControllerListSort,
  BooksControllerListStatusItem,
} from "@/shared/api/generated/model";

export const LIBRARY_PAGE_SIZE = 24;
export const LIBRARY_SORT_DEFAULT = BooksControllerListSort.created_desc;
export const LIBRARY_VIEW_DEFAULT = "grid";

export const LIBRARY_VIEW_MODES = ["grid", "list"] as const;
export type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];

export const LIBRARY_SCOPES = ["all", "my", "favorites"] as const;
export type LibraryScope = (typeof LIBRARY_SCOPES)[number];

export const LIBRARY_OWNERSHIP_SCOPE = [
  BooksControllerListOwnerItem.owned,
  BooksControllerListOwnerItem.lent_to_someone,
  BooksControllerListOwnerItem.borrowed_from_someone,
] as const satisfies readonly BooksControllerListOwnerItem[];

const LIBRARY_OWNERSHIP_SCOPE_SET: ReadonlySet<BooksControllerListOwnerItem> = new Set(
  LIBRARY_OWNERSHIP_SCOPE,
);

export const LIBRARY_SORT_ORDER = Object.values(BooksControllerListSort);

export const LIBRARY_STATUS_VALUES = Object.values(BooksControllerListStatusItem);
export const LIBRARY_OWNER_VALUES = Object.values(BooksControllerListOwnerItem);
export const LIBRARY_FORMAT_VALUES = Object.values(BooksControllerListFormatItem);
export const LIBRARY_AGE_CATEGORY_VALUES = Object.values(BooksControllerListAgeCategoryItem);
export const LIBRARY_LANGUAGE_VALUES = Object.values(BooksControllerListLanguageItem);
export const LIBRARY_BOOK_TYPE_VALUES = Object.values(BooksControllerListBookType);
const sortValues = Object.values(BooksControllerListSort);

export const libraryQueryParsers = {
  ageCategory: parseAsArrayOf(parseAsStringLiteral(LIBRARY_AGE_CATEGORY_VALUES)).withDefault([]),
  author: parseAsArrayOf(parseAsString).withDefault([]),
  bookType: parseAsStringLiteral(LIBRARY_BOOK_TYPE_VALUES),
  format: parseAsArrayOf(parseAsStringLiteral(LIBRARY_FORMAT_VALUES)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  hasCover: parseAsBoolean,
  hasRating: parseAsBoolean,
  isFavorite: parseAsBoolean,
  language: parseAsArrayOf(parseAsStringLiteral(LIBRARY_LANGUAGE_VALUES)).withDefault([]),
  owner: parseAsArrayOf(parseAsStringLiteral(LIBRARY_OWNER_VALUES)).withDefault([]),
  pagesMax: parseAsInteger,
  pagesMin: parseAsInteger,
  publisher: parseAsArrayOf(parseAsString).withDefault([]),
  q: parseAsString.withDefault(""),
  ratingMax: parseAsFloat,
  ratingMin: parseAsFloat,
  sort: parseAsStringLiteral(sortValues).withDefault(LIBRARY_SORT_DEFAULT),
  status: parseAsArrayOf(parseAsStringLiteral(LIBRARY_STATUS_VALUES)).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  view: parseAsStringLiteral(LIBRARY_VIEW_MODES).withDefault(LIBRARY_VIEW_DEFAULT),
  yearMax: parseAsInteger,
  yearMin: parseAsInteger,
};

export const favoritesQueryParsers = {
  ...libraryQueryParsers,
  sort: parseAsStringLiteral(sortValues).withDefault(BooksControllerListSort.favorite_added_desc),
};

export type LibraryListParams = Omit<BooksControllerListParams, "pageNumber">;

export type LibraryQueryState = inferParserType<typeof libraryQueryParsers>;

export type LibraryRangeFlags = {
  pages: boolean;
  rating: boolean;
  year: boolean;
};

type LibraryRange = {
  max: Nullable<number> | undefined;
  min: Nullable<number> | undefined;
};

type LibraryRangeSource = {
  pagesMax?: Nullable<number>;
  pagesMin?: Nullable<number>;
  ratingMax?: Nullable<number>;
  ratingMin?: Nullable<number>;
  yearMax?: Nullable<number>;
  yearMin?: Nullable<number>;
};

export function hasActiveLibraryFilters(state: LibraryQueryState): boolean {
  return (
    state.status.length > 0 ||
    state.owner.length > 0 ||
    state.format.length > 0 ||
    state.genre.length > 0 ||
    state.tag.length > 0 ||
    state.author.length > 0 ||
    state.publisher.length > 0 ||
    state.ageCategory.length > 0 ||
    state.language.length > 0 ||
    state.bookType !== null ||
    state.isFavorite !== null ||
    state.hasCover !== null ||
    state.hasRating !== null ||
    state.ratingMin !== null ||
    state.ratingMax !== null ||
    state.yearMin !== null ||
    state.yearMax !== null ||
    state.pagesMin !== null ||
    state.pagesMax !== null
  );
}

export function hasActiveLibrarySearch(state: LibraryQueryState): boolean {
  return state.q.trim() !== "";
}

export function isLibraryRangeValid(source: LibraryRangeSource): boolean {
  const { pages, rating, year } = libraryRangeFlags(source);
  return !pages && !rating && !year;
}

export function libraryRangeFlags(source: LibraryRangeSource): LibraryRangeFlags {
  return {
    pages: isInvertedRange({ max: source.pagesMax, min: source.pagesMin }),
    rating: isInvertedRange({ max: source.ratingMax, min: source.ratingMin }),
    year: isInvertedRange({ max: source.yearMax, min: source.yearMin }),
  };
}

export function scopedOwnerValues(scope: LibraryScope): BooksControllerListOwnerItem[] {
  if (scope === "my") {
    return LIBRARY_OWNER_VALUES.filter((value) => LIBRARY_OWNERSHIP_SCOPE_SET.has(value));
  }
  return LIBRARY_OWNER_VALUES;
}

export function toLibraryListParams(
  state: LibraryQueryState,
  scope: LibraryScope,
): LibraryListParams {
  const search = state.q.trim();
  const isFavorite = resolveIsFavoriteParam(state, scope);

  return {
    ageCategory: state.ageCategory,
    author: state.author,
    format: state.format,
    genre: state.genre,
    language: state.language,
    owner: scopedOwner(state.owner, scope),
    pageSize: LIBRARY_PAGE_SIZE,
    publisher: state.publisher,
    sort: state.sort,
    status: state.status,
    tag: state.tag,
    ...(search === "" ? {} : { q: search }),
    ...(state.bookType === null ? {} : { bookType: state.bookType }),
    ...(isFavorite === undefined ? {} : { isFavorite }),
    ...(state.hasCover === null ? {} : { hasCover: String(state.hasCover) }),
    ...(state.hasRating === null ? {} : { hasRating: String(state.hasRating) }),
    ...(state.ratingMin === null ? {} : { ratingMin: state.ratingMin }),
    ...(state.ratingMax === null ? {} : { ratingMax: state.ratingMax }),
    ...(state.yearMin === null ? {} : { yearMin: state.yearMin }),
    ...(state.yearMax === null ? {} : { yearMax: state.yearMax }),
    ...(state.pagesMin === null ? {} : { pagesMin: state.pagesMin }),
    ...(state.pagesMax === null ? {} : { pagesMax: state.pagesMax }),
  };
}

function isInvertedRange({ max, min }: LibraryRange): boolean {
  if (min === null || min === undefined) return false;
  if (max === null || max === undefined) return false;
  return min > max;
}

function resolveIsFavoriteParam(state: LibraryQueryState, scope: LibraryScope): string | undefined {
  if (scope === "favorites") return "true";
  if (state.isFavorite === null) return undefined;
  return String(state.isFavorite);
}

function scopedOwner(
  owner: BooksControllerListOwnerItem[],
  scope: LibraryScope,
): BooksControllerListOwnerItem[] {
  if (scope !== "my") return owner;
  const intersection = owner.filter((value) => LIBRARY_OWNERSHIP_SCOPE_SET.has(value));
  return intersection.length === 0 ? [...LIBRARY_OWNERSHIP_SCOPE] : intersection;
}

export const LIBRARY_FILTERS_RESET = {
  ageCategory: null,
  author: null,
  bookType: null,
  format: null,
  genre: null,
  hasCover: null,
  hasRating: null,
  isFavorite: null,
  language: null,
  owner: null,
  pagesMax: null,
  pagesMin: null,
  publisher: null,
  ratingMax: null,
  ratingMin: null,
  status: null,
  tag: null,
  yearMax: null,
  yearMin: null,
} satisfies Partial<Record<keyof LibraryQueryState, null>>;
