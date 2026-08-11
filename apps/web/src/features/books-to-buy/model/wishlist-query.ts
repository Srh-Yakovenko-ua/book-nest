import type { Nullable } from "@app/shared";

import {
  type inferParserType,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type {
  BooksControllerWishlistParams,
  BooksControllerWishlistPriceCurrency,
} from "@/shared/api/generated/model";

import {
  BooksControllerWishlistAgeItem,
  BooksControllerWishlistBookType,
  BooksControllerWishlistCurrencyItem,
  BooksControllerWishlistFormatItem,
  BooksControllerWishlistLanguageItem,
  BooksControllerWishlistLink,
  BooksControllerWishlistSeriesPlacementItem,
  BooksControllerWishlistSort,
} from "@/shared/api/generated/model";

export const WISHLIST_VIEW_MODES = ["grid", "list"] as const;
export const WISHLIST_VIEW_DEFAULT = "grid";

export const WISHLIST_AGE_VALUES = Object.values(BooksControllerWishlistAgeItem);
export const WISHLIST_BOOK_TYPE_VALUES = Object.values(BooksControllerWishlistBookType);
export const WISHLIST_CURRENCY_VALUES = Object.values(BooksControllerWishlistCurrencyItem);
export const WISHLIST_FORMAT_VALUES = Object.values(BooksControllerWishlistFormatItem);
export const WISHLIST_LANGUAGE_VALUES = Object.values(BooksControllerWishlistLanguageItem);
export const WISHLIST_LINK_VALUES = Object.values(BooksControllerWishlistLink);
export const WISHLIST_SERIES_PLACEMENT_VALUES = Object.values(
  BooksControllerWishlistSeriesPlacementItem,
);
export const WISHLIST_SORT_VALUES = Object.values(BooksControllerWishlistSort);
export const WISHLIST_SORT_DEFAULT = BooksControllerWishlistSort.added_asc;

export const wishlistQueryParsers = {
  age: parseAsArrayOf(parseAsStringLiteral(WISHLIST_AGE_VALUES)).withDefault([]),
  author: parseAsArrayOf(parseAsString).withDefault([]),
  bookType: parseAsStringLiteral(WISHLIST_BOOK_TYPE_VALUES),
  currency: parseAsArrayOf(parseAsStringLiteral(WISHLIST_CURRENCY_VALUES)).withDefault([]),
  format: parseAsArrayOf(parseAsStringLiteral(WISHLIST_FORMAT_VALUES)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  hasCover: parseAsBoolean,
  isFavorite: parseAsBoolean,
  language: parseAsArrayOf(parseAsStringLiteral(WISHLIST_LANGUAGE_VALUES)).withDefault([]),
  link: parseAsStringLiteral(WISHLIST_LINK_VALUES),
  pagesMax: parseAsInteger,
  pagesMin: parseAsInteger,
  priceMax: parseAsInteger,
  priceMin: parseAsInteger,
  publisher: parseAsArrayOf(parseAsString).withDefault([]),
  q: parseAsString.withDefault(""),
  seriesPlacement: parseAsArrayOf(
    parseAsStringLiteral(WISHLIST_SERIES_PLACEMENT_VALUES),
  ).withDefault([]),
  sort: parseAsStringLiteral(WISHLIST_SORT_VALUES).withDefault(WISHLIST_SORT_DEFAULT),
  store: parseAsArrayOf(parseAsString).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  view: parseAsStringLiteral(WISHLIST_VIEW_MODES).withDefault(WISHLIST_VIEW_DEFAULT),
  yearMax: parseAsInteger,
  yearMin: parseAsInteger,
};

export type WishlistQueryState = inferParserType<typeof wishlistQueryParsers>;

export type WishlistRangeFlags = {
  pages: boolean;
  price: boolean;
  year: boolean;
};

type WishlistRange = {
  max: Nullable<number> | undefined;
  min: Nullable<number> | undefined;
};

type WishlistRangeSource = {
  pagesMax?: Nullable<number>;
  pagesMin?: Nullable<number>;
  priceMax?: Nullable<number>;
  priceMin?: Nullable<number>;
  yearMax?: Nullable<number>;
  yearMin?: Nullable<number>;
};

export const WISHLIST_FILTERS_RESET = {
  age: null,
  author: null,
  bookType: null,
  currency: null,
  format: null,
  genre: null,
  hasCover: null,
  isFavorite: null,
  language: null,
  link: null,
  pagesMax: null,
  pagesMin: null,
  priceMax: null,
  priceMin: null,
  publisher: null,
  seriesPlacement: null,
  store: null,
  tag: null,
  yearMax: null,
  yearMin: null,
} satisfies Partial<Record<keyof WishlistQueryState, null>>;

export function countActiveWishlistFilters(state: WishlistQueryState): number {
  return [
    state.age.length > 0,
    state.author.length > 0,
    state.currency.length > 0,
    state.format.length > 0,
    state.genre.length > 0,
    state.language.length > 0,
    state.publisher.length > 0,
    state.seriesPlacement.length > 0,
    state.store.length > 0,
    state.tag.length > 0,
    state.bookType !== null,
    state.hasCover !== null,
    state.isFavorite !== null,
    state.link !== null,
    state.pagesMax !== null || state.pagesMin !== null,
    resolvePriceCurrency(state) !== null,
    state.yearMax !== null || state.yearMin !== null,
  ].filter(Boolean).length;
}

export function hasActiveWishlistFilters(state: WishlistQueryState): boolean {
  return countActiveWishlistFilters(state) > 0;
}

export function hasActiveWishlistSearch(state: WishlistQueryState): boolean {
  return state.q.trim() !== "";
}

export function isWishlistRangeValid(source: WishlistRangeSource): boolean {
  const { pages, price, year } = wishlistRangeFlags(source);
  return !pages && !price && !year;
}

export function resolvePriceCurrency(
  state: Pick<WishlistQueryState, "currency" | "priceMax" | "priceMin">,
): Nullable<BooksControllerWishlistPriceCurrency> {
  const [only] = state.currency;
  if (only === undefined || state.currency.length > 1) return null;
  if (state.priceMin === null && state.priceMax === null) return null;
  if (isInvertedRange({ max: state.priceMax, min: state.priceMin })) return null;
  return only;
}

export function toWishlistParams(state: WishlistQueryState): BooksControllerWishlistParams {
  const search = state.q.trim();
  const flags = wishlistRangeFlags(state);
  const priceCurrency = resolvePriceCurrency(state);

  return {
    age: state.age,
    author: state.author,
    currency: state.currency,
    format: state.format,
    genre: state.genre,
    language: state.language,
    publisher: state.publisher,
    seriesPlacement: state.seriesPlacement,
    sort: state.sort,
    store: state.store,
    tag: state.tag,
    ...(search === "" ? {} : { q: search }),
    ...(state.link === null ? {} : { link: state.link }),
    ...(state.bookType === null ? {} : { bookType: state.bookType }),
    ...(state.hasCover === null ? {} : { hasCover: String(state.hasCover) }),
    ...(state.isFavorite === null ? {} : { isFavorite: String(state.isFavorite) }),
    ...(flags.year || state.yearMin === null ? {} : { yearMin: state.yearMin }),
    ...(flags.year || state.yearMax === null ? {} : { yearMax: state.yearMax }),
    ...(flags.pages || state.pagesMin === null ? {} : { pagesMin: state.pagesMin }),
    ...(flags.pages || state.pagesMax === null ? {} : { pagesMax: state.pagesMax }),
    ...(priceCurrency === null
      ? {}
      : {
          priceCurrency,
          ...(state.priceMin === null ? {} : { priceMin: state.priceMin }),
          ...(state.priceMax === null ? {} : { priceMax: state.priceMax }),
        }),
  };
}

export function wishlistRangeFlags(source: WishlistRangeSource): WishlistRangeFlags {
  return {
    pages: isInvertedRange({ max: source.pagesMax, min: source.pagesMin }),
    price: isInvertedRange({ max: source.priceMax, min: source.priceMin }),
    year: isInvertedRange({ max: source.yearMax, min: source.yearMin }),
  };
}

function isInvertedRange({ max, min }: WishlistRange): boolean {
  if (min === null || min === undefined) return false;
  if (max === null || max === undefined) return false;
  return min > max;
}
