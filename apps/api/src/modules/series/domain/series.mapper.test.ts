import type { MediaView, Nullable, SeriesBookView, SeriesDetailsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { BookDeliveryModel, BookLoanModel } from "../../../generated/prisma/models.js";
import type { SeriesWithDetails } from "../infrastructure/series.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { toSeriesDetailsView } from "./series.mapper.js";

type BookAuthorLink = SeriesDetailBook["authors"][number];
type SeriesAuthorLink = SeriesWithDetails["authors"][number];
type SeriesDetailAuthor = SeriesDetailBook["authors"][number]["author"];
type SeriesDetailBook = SeriesWithDetails["books"][number];

function makeAuthor(id: string, name: string): SeriesDetailAuthor {
  return fakeOf<SeriesDetailAuthor>({ id, name });
}

function makeBookAuthor(id: string, name: string): BookAuthorLink {
  return fakeOf<BookAuthorLink>({ author: makeAuthor(id, name), position: 0 });
}

function makeSeriesAuthor(id: string, name: string): SeriesAuthorLink {
  return fakeOf<SeriesAuthorLink>({ author: makeAuthor(id, name) });
}

const TODAY = new Date("2026-06-01T00:00:00.000Z");
const BASE_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function detailsFor(
  book: SeriesDetailBook,
  covers: Map<string, Nullable<MediaView>>,
): SeriesDetailsView {
  const series = fakeOf<SeriesWithDetails>({
    _count: { books: 1 },
    authors: [makeSeriesAuthor("author-1", "Author One")],
    books: [book],
    createdAt: BASE_CREATED_AT,
    description: null,
    genres: [],
    id: "series-1",
    name: "Test Series",
    status: "ongoing",
    totalBooks: 5,
    updatedAt: BASE_CREATED_AT,
  });
  return toSeriesDetailsView({ covers, series, today: TODAY });
}

function makeBook(overrides: Partial<SeriesDetailBook> = {}): SeriesDetailBook {
  return fakeOf<SeriesDetailBook>({
    ageCategory: "not_specified",
    authors: [makeBookAuthor("author-1", "Author One")],
    coverMedia: null,
    createdAt: BASE_CREATED_AT,
    deliveries: [],
    formats: [],
    genres: [],
    id: "book-1",
    isFavorite: false,
    loans: [],
    originalTitle: null,
    ownershipStatus: "owned",
    pagesCount: null,
    partNumber: 1,
    publicationYear: null,
    publisher: null,
    queuePosition: null,
    readingProgress: null,
    readingStatus: "not_started",
    tags: [],
    title: "Book One",
    ...overrides,
  });
}

function makeDelivery(overrides: Partial<BookDeliveryModel> = {}): BookDeliveryModel {
  return fakeOf<BookDeliveryModel>({
    bookId: "book-1",
    cancelledAt: null,
    cancelReason: null,
    createdAt: BASE_CREATED_AT,
    currency: null,
    deliveryService: null,
    expectedDeliveryDate: null,
    id: "delivery-1",
    note: null,
    orderDate: null,
    orderNumber: null,
    price: null,
    receivedAt: null,
    status: "ordered",
    storeName: null,
    trackingNumber: null,
    trackingUrl: null,
    updatedAt: BASE_CREATED_AT,
    userId: "user-1",
    ...overrides,
  });
}

function makeLoan(overrides: Partial<BookLoanModel> = {}): BookLoanModel {
  return fakeOf<BookLoanModel>({
    bookId: "book-1",
    contact: null,
    createdAt: BASE_CREATED_AT,
    expectedReturnDate: null,
    id: "loan-1",
    loanDate: null,
    note: null,
    personName: "Olena",
    remindToReturn: false,
    returnedAt: null,
    status: "active",
    type: "lent_to_someone",
    updatedAt: BASE_CREATED_AT,
    userId: "user-1",
    ...overrides,
  });
}

function mapSingleBook(book: SeriesDetailBook): SeriesBookView {
  const [mapped] = detailsFor(book, new Map()).books;
  if (mapped === undefined) {
    throw new Error("expected a mapped series book");
  }
  return mapped;
}

describe("toSeriesDetailsView book card fields", () => {
  it("maps both reading dates for a finished book", () => {
    const book = mapSingleBook(
      makeBook({
        readingProgress: fakeOf<SeriesDetailBook["readingProgress"]>({
          currentPage: 320,
          finishedAt: new Date("2026-01-20T00:00:00.000Z"),
          rating: 9,
          startedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
        readingStatus: "finished",
      }),
    );

    expect(book.startedAt).toBe("2026-01-02");
    expect(book.finishedAt).toBe("2026-01-20");
  });

  it("keeps finishedAt null while a book is still being read", () => {
    const book = mapSingleBook(
      makeBook({
        readingProgress: fakeOf<SeriesDetailBook["readingProgress"]>({
          currentPage: 40,
          finishedAt: null,
          rating: null,
          startedAt: new Date("2026-01-15T00:00:00.000Z"),
        }),
        readingStatus: "reading",
      }),
    );

    expect(book.startedAt).toBe("2026-01-15");
    expect(book.finishedAt).toBeNull();
  });

  it("leaves both reading dates null for a book that was never started", () => {
    const book = mapSingleBook(makeBook({ readingProgress: null, readingStatus: "not_started" }));

    expect(book.startedAt).toBeNull();
    expect(book.finishedAt).toBeNull();
  });

  it("maps the publisher reference when the book has one", () => {
    const book = mapSingleBook(
      makeBook({
        publisher: fakeOf<SeriesDetailBook["publisher"]>({ id: "pub-1", name: "Vivat" }),
      }),
    );

    expect(book.publisher).toEqual({ id: "pub-1", name: "Vivat" });
  });

  it("leaves the publisher null when the book has none", () => {
    const book = mapSingleBook(makeBook({ publisher: null }));

    expect(book.publisher).toBeNull();
  });

  it("maps an active lent loan into loanInfo", () => {
    const book = mapSingleBook(
      makeBook({
        loans: [
          makeLoan({
            expectedReturnDate: new Date("2026-07-01T00:00:00.000Z"),
            personName: "Olena",
            type: "lent_to_someone",
          }),
        ],
        ownershipStatus: "lent_to_someone",
      }),
    );

    expect(book.loanInfo).not.toBeNull();
    expect(book.loanInfo?.personName).toBe("Olena");
    expect(book.loanInfo?.loanType).toBe("lent_to_someone");
    expect(book.loanInfo?.expectedReturnDate).toBe("2026-07-01");
  });

  it("maps an active borrowed loan into loanInfo", () => {
    const book = mapSingleBook(
      makeBook({
        loans: [makeLoan({ personName: "Ivan", type: "borrowed_from_someone" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    );

    expect(book.loanInfo?.personName).toBe("Ivan");
    expect(book.loanInfo?.loanType).toBe("borrowed_from_someone");
  });

  it("leaves loanInfo null when there is no active loan", () => {
    const book = mapSingleBook(makeBook({ loans: [], ownershipStatus: "owned" }));

    expect(book.loanInfo).toBeNull();
  });

  it("maps an active delivery into activeDelivery", () => {
    const book = mapSingleBook(
      makeBook({
        deliveries: [
          makeDelivery({
            expectedDeliveryDate: new Date("2026-06-10T00:00:00.000Z"),
            status: "in_transit",
          }),
        ],
        ownershipStatus: "in_transit",
      }),
    );

    expect(book.activeDelivery).not.toBeNull();
    expect(book.activeDelivery?.status).toBe("in_transit");
    expect(book.activeDelivery?.expectedDeliveryDate).toBe("2026-06-10");
  });

  it("leaves activeDelivery null when there is no delivery", () => {
    const book = mapSingleBook(makeBook({ deliveries: [] }));

    expect(book.activeDelivery).toBeNull();
  });

  it("does not treat a cancelled delivery as active", () => {
    const book = mapSingleBook(
      makeBook({
        deliveries: [
          makeDelivery({ cancelledAt: new Date("2026-05-01T00:00:00.000Z"), status: "cancelled" }),
        ],
      }),
    );

    expect(book.activeDelivery).toBeNull();
  });
});

describe("toSeriesDetailsView nextBook cover", () => {
  it("attaches the resolved cover to the next book", () => {
    const cover = fakeOf<MediaView>({ id: "media-1" });
    const covers = new Map<string, Nullable<MediaView>>([["book-1", cover]]);

    const details = detailsFor(
      makeBook({ id: "book-1", partNumber: 1, readingStatus: "reading", title: "Book One" }),
      covers,
    );

    expect(details.nextBook).toEqual({ cover, id: "book-1", partNumber: 1, title: "Book One" });
  });

  it("leaves the next book cover null when the book has none", () => {
    const details = detailsFor(
      makeBook({ id: "book-1", partNumber: 1, readingStatus: "reading" }),
      new Map(),
    );

    expect(details.nextBook?.cover).toBeNull();
  });
});
