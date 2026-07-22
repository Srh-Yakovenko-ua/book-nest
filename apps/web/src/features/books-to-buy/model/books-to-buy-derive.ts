import type { Currency, Nullable, WishlistBookView } from "@app/shared";

import { findBestOfferLinkId } from "./best-offer-link";

export type WishlistBestOffer = {
  bookId: string;
  coverUrl: Nullable<string>;
  currency: Currency;
  price: number;
  storeName: Nullable<string>;
  title: string;
};

export type WishlistFilterOption = {
  label: string;
  value: string;
};

export type WishlistFilterOptions = {
  genres: WishlistFilterOption[];
  publishers: WishlistFilterOption[];
  stores: WishlistFilterOption[];
  tags: WishlistFilterOption[];
};

export type WishlistFilters = {
  genreKey: Nullable<string>;
  link: WishlistLinkFilter;
  publisherId: Nullable<string>;
  search: string;
  storeName: Nullable<string>;
  tagId: Nullable<string>;
};

export type WishlistLinkFilter =
  "all" | "has_links" | "has_price" | "without_links" | "without_price";

export type WishlistSort =
  | "added_asc"
  | "added_desc"
  | "author_asc"
  | "price_asc"
  | "price_desc"
  | "publisher_asc"
  | "stores_desc"
  | "title_asc";

export const WISHLIST_LINK_FILTERS = [
  "all",
  "has_links",
  "without_links",
  "has_price",
  "without_price",
] as const satisfies readonly WishlistLinkFilter[];

export const WISHLIST_SORT_OPTIONS = [
  "added_asc",
  "added_desc",
  "title_asc",
  "author_asc",
  "publisher_asc",
  "price_asc",
  "price_desc",
  "stores_desc",
] as const satisfies readonly WishlistSort[];

export const WISHLIST_SORT_DEFAULT: WishlistSort = "added_asc";

export const WISHLIST_FILTERS_DEFAULT: WishlistFilters = {
  genreKey: null,
  link: "all",
  publisherId: null,
  search: "",
  storeName: null,
  tagId: null,
};

type WishlistComparator = (
  left: WishlistBookView,
  right: WishlistBookView,
  locale: string,
) => number;

type WishlistDerived = {
  linkFilterCounts: Record<WishlistLinkFilter, number>;
  visibleBooks: WishlistBookView[];
};

const LINK_FILTER_PREDICATES: Record<WishlistLinkFilter, (book: WishlistBookView) => boolean> = {
  all: () => true,
  has_links: (book) => book.storeLinks.length > 0,
  has_price: (book) => book.storeLinks.some((link) => link.price !== null),
  without_links: (book) => book.storeLinks.length === 0,
  without_price: (book) => book.storeLinks.every((link) => link.price === null),
};

const SORT_COMPARATORS: Record<WishlistSort, WishlistComparator> = {
  added_asc: (left, right) => left.createdAt.localeCompare(right.createdAt),
  added_desc: (left, right) => right.createdAt.localeCompare(left.createdAt),
  author_asc: (left, right, locale) =>
    compareNames({ left: primaryAuthorName(left), locale, right: primaryAuthorName(right) }),
  price_asc: (left, right) => compareBestOfferPrice({ direction: "asc", left, right }),
  price_desc: (left, right) => compareBestOfferPrice({ direction: "desc", left, right }),
  publisher_asc: (left, right, locale) =>
    compareNames({ left: left.publisher?.name ?? "", locale, right: right.publisher?.name ?? "" }),
  stores_desc: (left, right) => right.storeLinks.length - left.storeLinks.length,
  title_asc: (left, right, locale) =>
    compareNames({ left: left.title, locale, right: right.title }),
};

export function buildWishlistFilterOptions({
  books,
  genreNameByKey,
  locale,
}: {
  books: WishlistBookView[];
  genreNameByKey: Map<string, string>;
  locale: string;
}): WishlistFilterOptions {
  const genreLabels = new Map<string, string>();
  const publisherLabels = new Map<string, string>();
  const storeLabels = new Map<string, string>();
  const tagLabels = new Map<string, string>();

  for (const book of books) {
    for (const link of book.storeLinks) {
      storeLabels.set(link.storeName, link.storeName);
    }
    for (const genreKey of book.genres) {
      genreLabels.set(genreKey, genreNameByKey.get(genreKey) ?? genreKey);
    }
    for (const tag of book.tags) {
      tagLabels.set(tag.id, tag.name);
    }
    if (book.publisher !== null) {
      publisherLabels.set(book.publisher.id, book.publisher.name);
    }
  }

  return {
    genres: toSortedOptions({ labels: genreLabels, locale }),
    publishers: toSortedOptions({ labels: publisherLabels, locale }),
    stores: toSortedOptions({ labels: storeLabels, locale }),
    tags: toSortedOptions({ labels: tagLabels, locale }),
  };
}

export function deriveWishlistBestOffers(books: WishlistBookView[]): WishlistBestOffer[] {
  const offers: WishlistBestOffer[] = [];

  for (const book of books) {
    const offer = toWishlistBestOffer(book);
    if (offer !== null) {
      offers.push(offer);
    }
  }

  return offers.sort((left, right) => left.price - right.price);
}

export function deriveWishlistBooks({
  books,
  filters,
  genreNameByKey,
  locale,
  sort,
}: {
  books: WishlistBookView[];
  filters: WishlistFilters;
  genreNameByKey: Map<string, string>;
  locale: string;
  sort: WishlistSort;
}): WishlistDerived {
  const matched = books.filter(
    (book) =>
      matchesValueFilters({ book, filters }) &&
      matchesSearch({ book, genreNameByKey, query: filters.search }),
  );
  const comparator = SORT_COMPARATORS[sort];

  return {
    linkFilterCounts: countLinkFilters(matched),
    visibleBooks: matched
      .filter(LINK_FILTER_PREDICATES[filters.link])
      .sort((left, right) => comparator(left, right, locale)),
  };
}

function compareBestOfferPrice({
  direction,
  left,
  right,
}: {
  direction: "asc" | "desc";
  left: WishlistBookView;
  right: WishlistBookView;
}): number {
  const leftPrice = left.bestOffer?.price ?? null;
  const rightPrice = right.bestOffer?.price ?? null;
  if (leftPrice === null && rightPrice === null) return 0;
  if (leftPrice === null) return 1;
  if (rightPrice === null) return -1;
  return direction === "asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
}

function compareNames({
  left,
  locale,
  right,
}: {
  left: string;
  locale: string;
  right: string;
}): number {
  if (left === right) return 0;
  if (left === "") return 1;
  if (right === "") return -1;
  return left.localeCompare(right, locale);
}

function countLinkFilters(books: WishlistBookView[]): Record<WishlistLinkFilter, number> {
  return {
    all: books.length,
    has_links: books.filter(LINK_FILTER_PREDICATES.has_links).length,
    has_price: books.filter(LINK_FILTER_PREDICATES.has_price).length,
    without_links: books.filter(LINK_FILTER_PREDICATES.without_links).length,
    without_price: books.filter(LINK_FILTER_PREDICATES.without_price).length,
  };
}

function matchesSearch({
  book,
  genreNameByKey,
  query,
}: {
  book: WishlistBookView;
  genreNameByKey: Map<string, string>;
  query: string;
}): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return searchableValues({ book, genreNameByKey }).some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function matchesValueFilters({
  book,
  filters,
}: {
  book: WishlistBookView;
  filters: WishlistFilters;
}): boolean {
  if (filters.storeName !== null) {
    if (!book.storeLinks.some((link) => link.storeName === filters.storeName)) return false;
  }
  if (filters.publisherId !== null && book.publisher?.id !== filters.publisherId) return false;
  if (filters.genreKey !== null && !book.genres.includes(filters.genreKey)) return false;
  if (filters.tagId !== null && !book.tags.some((tag) => tag.id === filters.tagId)) return false;
  return true;
}

function primaryAuthorName(book: WishlistBookView): string {
  return book.authors[0]?.name ?? "";
}

function searchableValues({
  book,
  genreNameByKey,
}: {
  book: WishlistBookView;
  genreNameByKey: Map<string, string>;
}): string[] {
  return [
    book.title,
    book.originalTitle ?? "",
    book.publisher?.name ?? "",
    ...book.authors.map((author) => author.name),
    ...book.storeLinks.map((link) => link.storeName),
    ...book.genres.map((genreKey) => genreNameByKey.get(genreKey) ?? genreKey),
    ...book.tags.map((tag) => tag.name),
  ];
}

function toSortedOptions({
  labels,
  locale,
}: {
  labels: Map<string, string>;
  locale: string;
}): WishlistFilterOption[] {
  return [...labels.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}

function toWishlistBestOffer(book: WishlistBookView): Nullable<WishlistBestOffer> {
  const { bestOffer, storeLinks } = book;
  if (bestOffer === null) return null;

  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });

  return {
    bookId: book.id,
    coverUrl: book.cover?.urls.thumb ?? null,
    currency: bestOffer.currency,
    price: bestOffer.price,
    storeName: storeLinks.find((link) => link.id === bestOfferLinkId)?.storeName ?? null,
    title: book.title,
  };
}
