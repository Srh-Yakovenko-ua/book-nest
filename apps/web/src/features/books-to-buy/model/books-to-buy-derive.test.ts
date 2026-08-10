import type { WishlistBookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { WishlistFilters, WishlistSort } from "./books-to-buy-derive";

import {
  buildWishlistFilterOptions,
  deriveWishlistBestOffers,
  deriveWishlistBooks,
  WISHLIST_FILTERS_DEFAULT,
  WISHLIST_SORT_DEFAULT,
} from "./books-to-buy-derive";
import { makeStoreLink, makeWishlistBook } from "./books-to-buy.fixtures";

const GENRE_NAME_BY_KEY = new Map([
  ["adventure", "Пригоди"],
  ["fantasy", "Фентезі"],
]);

const bookA = makeWishlistBook({
  genres: ["fantasy"],
  id: "book-a",
  publisher: { id: "pub-a", name: "Астролябія" },
  storeLinks: [makeStoreLink({ id: "link-a", storeName: "Yakaboo" })],
  tags: [{ id: "tag-a", name: "фентезі" }],
  title: "Альфа",
});

const bookB = makeWishlistBook({
  genres: ["adventure"],
  id: "book-b",
  publisher: { id: "pub-b", name: "Наш Формат" },
  storeLinks: [makeStoreLink({ id: "link-b", storeName: "Книгарня Є" })],
  tags: [{ id: "tag-b", name: "пригоди" }],
  title: "Бета",
});

const withoutLinks = makeWishlistBook({ id: "no-links", storeLinks: [], title: "Без посилань" });

const withUnpricedLink = makeWishlistBook({
  id: "no-price",
  storeLinks: [makeStoreLink({ currency: null, id: "link-free", price: null })],
  title: "Посилання без ціни",
});

const withPricedLink = makeWishlistBook({
  bestOffer: { currency: "UAH", price: 300 },
  id: "priced",
  storeLinks: [makeStoreLink({ id: "link-priced", price: 300 })],
  title: "Книга з ціною",
});

function derive({
  books,
  filters,
  sort,
}: {
  books: WishlistBookView[];
  filters?: Partial<WishlistFilters>;
  sort?: WishlistSort;
}) {
  return deriveWishlistBooks({
    books,
    filters: { ...WISHLIST_FILTERS_DEFAULT, ...filters },
    genreNameByKey: GENRE_NAME_BY_KEY,
    locale: "uk",
    sort: sort ?? WISHLIST_SORT_DEFAULT,
  });
}

function offerBook({
  createdAt = "2026-03-01T00:00:00.000Z",
  price,
  title,
  wishlistAddedAt = null,
}: {
  createdAt?: string;
  price: null | number;
  title: string;
  wishlistAddedAt?: null | string;
}): WishlistBookView {
  return makeWishlistBook({
    bestOffer: price === null ? null : { currency: "UAH", price },
    createdAt,
    id: title,
    storeLinks: price === null ? [] : [makeStoreLink({ id: `link-${title}`, price })],
    title,
    wishlistAddedAt,
  });
}

function titles(books: WishlistBookView[]): string[] {
  return books.map((book) => book.title);
}

describe("deriveWishlistBooks sorting", () => {
  it("reverses the server arrival order so the earliest added book comes first by default", () => {
    const books = [
      offerBook({ createdAt: "2026-03-03T00:00:00.000Z", price: 100, title: "Третя" }),
      offerBook({ createdAt: "2026-03-02T00:00:00.000Z", price: 100, title: "Друга" }),
      offerBook({ createdAt: "2026-03-01T00:00:00.000Z", price: 100, title: "Перша" }),
    ];

    expect(titles(derive({ books }).visibleBooks)).toEqual(["Перша", "Друга", "Третя"]);
  });

  it("sorts by newest first when asked for the reverse arrival order", () => {
    const books = [
      offerBook({ createdAt: "2026-03-01T00:00:00.000Z", price: 100, title: "Перша" }),
      offerBook({ createdAt: "2026-03-03T00:00:00.000Z", price: 100, title: "Третя" }),
    ];

    expect(titles(derive({ books, sort: "added_desc" }).visibleBooks)).toEqual(["Третя", "Перша"]);
  });

  it("orders by the day a book entered the wishlist, not the day it entered the library", () => {
    const books = [
      offerBook({
        createdAt: "2025-01-01T00:00:00.000Z",
        price: 100,
        title: "Стара в бібліотеці",
        wishlistAddedAt: "2026-03-05T00:00:00.000Z",
      }),
      offerBook({
        createdAt: "2026-03-04T00:00:00.000Z",
        price: 100,
        title: "Нова в бібліотеці",
        wishlistAddedAt: "2026-03-01T00:00:00.000Z",
      }),
    ];

    expect(titles(derive({ books }).visibleBooks)).toEqual([
      "Нова в бібліотеці",
      "Стара в бібліотеці",
    ]);
  });

  it("falls back to the creation date for a book that carries no entry date", () => {
    const books = [
      offerBook({
        createdAt: "2026-03-03T00:00:00.000Z",
        price: 100,
        title: "Без дати входу",
      }),
      offerBook({
        createdAt: "2026-03-04T00:00:00.000Z",
        price: 100,
        title: "З датою входу",
        wishlistAddedAt: "2026-03-02T00:00:00.000Z",
      }),
    ];

    expect(titles(derive({ books }).visibleBooks)).toEqual(["З датою входу", "Без дати входу"]);
  });

  it("puts books without a best offer last when sorting by the lowest price", () => {
    const books = [
      offerBook({ price: null, title: "Без ціни" }),
      offerBook({ price: 900, title: "Дорога" }),
      offerBook({ price: 100, title: "Дешева" }),
    ];

    expect(titles(derive({ books, sort: "price_asc" }).visibleBooks)).toEqual([
      "Дешева",
      "Дорога",
      "Без ціни",
    ]);
  });

  it("still puts books without a best offer last when sorting by the highest price", () => {
    const books = [
      offerBook({ price: null, title: "Без ціни" }),
      offerBook({ price: 100, title: "Дешева" }),
      offerBook({ price: 900, title: "Дорога" }),
    ];

    expect(titles(derive({ books, sort: "price_desc" }).visibleBooks)).toEqual([
      "Дорога",
      "Дешева",
      "Без ціни",
    ]);
  });

  it("sorts books with an unknown author last", () => {
    const books = [
      makeWishlistBook({ authors: [], id: "unknown", title: "Без автора" }),
      makeWishlistBook({
        authors: [{ id: "author-ya", name: "Ярош" }],
        id: "ya",
        title: "Останній",
      }),
      makeWishlistBook({
        authors: [{ id: "author-an", name: "Андрухович" }],
        id: "an",
        title: "Перший",
      }),
    ];

    expect(titles(derive({ books, sort: "author_asc" }).visibleBooks)).toEqual([
      "Перший",
      "Останній",
      "Без автора",
    ]);
  });

  it("sorts books without a publisher last", () => {
    const books = [
      makeWishlistBook({ id: "none", publisher: null, title: "Без видавництва" }),
      makeWishlistBook({
        id: "nash",
        publisher: { id: "pub-b", name: "Наш Формат" },
        title: "Останній",
      }),
      makeWishlistBook({
        id: "astro",
        publisher: { id: "pub-a", name: "Астролябія" },
        title: "Перший",
      }),
    ];

    expect(titles(derive({ books, sort: "publisher_asc" }).visibleBooks)).toEqual([
      "Перший",
      "Останній",
      "Без видавництва",
    ]);
  });

  it("sorts books by how many stores track them", () => {
    const books = [
      makeWishlistBook({ id: "one", storeLinks: [makeStoreLink({ id: "s1" })], title: "Один" }),
      makeWishlistBook({
        id: "two",
        storeLinks: [makeStoreLink({ id: "s2" }), makeStoreLink({ id: "s3" })],
        title: "Два",
      }),
    ];

    expect(titles(derive({ books, sort: "stores_desc" }).visibleBooks)).toEqual(["Два", "Один"]);
  });

  it("leaves the source array in its original order", () => {
    const books = [
      offerBook({ price: 900, title: "Дорога" }),
      offerBook({ price: 100, title: "Дешева" }),
    ];
    const originalOrder = titles(books);

    derive({ books, sort: "price_asc" });

    expect(titles(books)).toEqual(originalOrder);
  });
});

describe("deriveWishlistBooks search", () => {
  const searchBook = makeWishlistBook({
    authors: [{ id: "author-1", name: "Анджей Сапковський" }],
    genres: ["fantasy"],
    id: "searchable",
    originalTitle: "Ostatnie życzenie",
    publisher: { id: "pub-1", name: "Клуб Сімейного Дозвілля" },
    storeLinks: [makeStoreLink({ storeName: "Yakaboo" })],
    tags: [{ id: "tag-1", name: "відьмак" }],
    title: "Останнє бажання",
  });

  it.each([
    { field: "title", query: "останнє бажання" },
    { field: "original title", query: "ostatnie" },
    { field: "author name", query: "сапковський" },
    { field: "publisher name", query: "сімейного" },
    { field: "store name", query: "yakaboo" },
    { field: "genre display name", query: "фентезі" },
    { field: "tag name", query: "відьмак" },
  ])("matches the search query against the $field", ({ query }) => {
    expect(
      titles(derive({ books: [searchBook], filters: { search: query } }).visibleBooks),
    ).toEqual(["Останнє бажання"]);
  });

  it("ignores surrounding whitespace and letter case in the query", () => {
    const result = derive({ books: [searchBook], filters: { search: "   ОСТАННЄ   " } });

    expect(titles(result.visibleBooks)).toEqual(["Останнє бажання"]);
  });

  it("drops books that match nothing", () => {
    const result = derive({ books: [searchBook], filters: { search: "зоряні війни" } });

    expect(result.visibleBooks).toEqual([]);
  });
});

describe("deriveWishlistBooks filters", () => {
  const linkBooks = [withoutLinks, withUnpricedLink, withPricedLink];

  it("keeps every book when no link filter is active", () => {
    expect(titles(derive({ books: linkBooks }).visibleBooks)).toEqual([
      "Без посилань",
      "Посилання без ціни",
      "Книга з ціною",
    ]);
  });

  it("keeps only books that have at least one link", () => {
    const result = derive({ books: linkBooks, filters: { link: "has_links" } });

    expect(titles(result.visibleBooks)).toEqual(["Посилання без ціни", "Книга з ціною"]);
  });

  it("keeps only books that have no link at all", () => {
    const result = derive({ books: linkBooks, filters: { link: "without_links" } });

    expect(titles(result.visibleBooks)).toEqual(["Без посилань"]);
  });

  it("keeps only books with at least one priced link", () => {
    const result = derive({ books: linkBooks, filters: { link: "has_price" } });

    expect(titles(result.visibleBooks)).toEqual(["Книга з ціною"]);
  });

  it("counts books without any link as books without a price", () => {
    const result = derive({ books: linkBooks, filters: { link: "without_price" } });

    expect(titles(result.visibleBooks)).toEqual(["Без посилань", "Посилання без ціни"]);
  });

  it.each([
    { expected: ["Альфа"], filters: { storeName: "Yakaboo" }, kind: "store" },
    { expected: ["Бета"], filters: { publisherId: "pub-b" }, kind: "publisher" },
    { expected: ["Альфа"], filters: { genreKey: "fantasy" }, kind: "genre" },
    { expected: ["Бета"], filters: { tagId: "tag-b" }, kind: "tag" },
  ])("keeps only the books matching the $kind filter", ({ expected, filters }) => {
    expect(titles(derive({ books: [bookA, bookB], filters }).visibleBooks)).toEqual(expected);
  });
});

describe("deriveWishlistBooks link filter counts", () => {
  const linkBooks = [withoutLinks, withUnpricedLink, withPricedLink];

  it("counts every link filter regardless of which one is active", () => {
    const result = derive({ books: linkBooks, filters: { link: "has_price" } });

    expect(result.linkFilterCounts).toEqual({
      all: 3,
      has_links: 2,
      has_price: 1,
      without_links: 1,
      without_price: 2,
    });
  });

  it("narrows the counts to the books matching the search", () => {
    const result = derive({ books: linkBooks, filters: { search: "Книга з ціною" } });

    expect(result.linkFilterCounts).toEqual({
      all: 1,
      has_links: 1,
      has_price: 1,
      without_links: 0,
      without_price: 0,
    });
  });

  it("narrows the counts to the books matching the value filters", () => {
    const result = derive({ books: [bookA, bookB], filters: { storeName: "Yakaboo" } });

    expect(result.linkFilterCounts.all).toBe(1);
  });
});

describe("buildWishlistFilterOptions", () => {
  it("offers only the stores, publishers and tags that occur in the wishlist", () => {
    const options = buildWishlistFilterOptions({
      books: [bookA, bookB],
      genreNameByKey: GENRE_NAME_BY_KEY,
      locale: "uk",
    });

    expect(options.stores).toEqual([
      { label: "Книгарня Є", value: "Книгарня Є" },
      { label: "Yakaboo", value: "Yakaboo" },
    ]);
    expect(options.publishers).toEqual([
      { label: "Астролябія", value: "pub-a" },
      { label: "Наш Формат", value: "pub-b" },
    ]);
    expect(options.tags).toEqual([
      { label: "пригоди", value: "tag-b" },
      { label: "фентезі", value: "tag-a" },
    ]);
  });

  it("labels genre options with their display names and keeps the key as the value", () => {
    const options = buildWishlistFilterOptions({
      books: [bookA, bookB],
      genreNameByKey: GENRE_NAME_BY_KEY,
      locale: "uk",
    });

    expect(options.genres).toEqual([
      { label: "Пригоди", value: "adventure" },
      { label: "Фентезі", value: "fantasy" },
    ]);
  });

  it("falls back to the genre key when no display name is known", () => {
    const options = buildWishlistFilterOptions({
      books: [makeWishlistBook({ genres: ["noir"] })],
      genreNameByKey: GENRE_NAME_BY_KEY,
      locale: "uk",
    });

    expect(options.genres).toEqual([{ label: "noir", value: "noir" }]);
  });

  it("offers nothing for a wishlist without any book", () => {
    const options = buildWishlistFilterOptions({
      books: [],
      genreNameByKey: GENRE_NAME_BY_KEY,
      locale: "uk",
    });

    expect(options).toEqual({ genres: [], publishers: [], stores: [], tags: [] });
  });
});

describe("deriveWishlistBestOffers", () => {
  it("orders the offers from the cheapest to the most expensive", () => {
    const offers = deriveWishlistBestOffers([
      offerBook({ price: 900, title: "Дорога" }),
      offerBook({ price: 100, title: "Дешева" }),
    ]);

    expect(offers.map((offer) => offer.title)).toEqual(["Дешева", "Дорога"]);
  });

  it("skips books that have no best offer", () => {
    const offers = deriveWishlistBestOffers([
      offerBook({ price: null, title: "Без ціни" }),
      offerBook({ price: 100, title: "Дешева" }),
    ]);

    expect(offers.map((offer) => offer.title)).toEqual(["Дешева"]);
  });

  it("names the store that holds the best offer", () => {
    const book = makeWishlistBook({
      bestOffer: { currency: "UAH", price: 300 },
      storeLinks: [
        makeStoreLink({ id: "expensive", price: 500, storeName: "Yakaboo" }),
        makeStoreLink({ id: "cheap", price: 300, storeName: "Книгарня Є" }),
      ],
    });

    expect(deriveWishlistBestOffers([book])[0]?.storeName).toBe("Книгарня Є");
  });

  it("leaves the store unnamed when no link carries the best offer price", () => {
    const book = makeWishlistBook({
      bestOffer: { currency: "USD", price: 12 },
      storeLinks: [makeStoreLink({ id: "uah", price: 300, storeName: "Yakaboo" })],
    });

    expect(deriveWishlistBestOffers([book])[0]?.storeName).toBeNull();
  });
});
