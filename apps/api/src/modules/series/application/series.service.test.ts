import type { MediaView, Nullable } from "@app/shared";
import type { Mock } from "vitest";

import { SERIES_SORT_DEFAULT } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { MediaAssetModel, SeriesModel } from "../../../generated/prisma/models.js";
import type { GenresService } from "../../genres/application/genres.service.js";
import type { MediaService } from "../../media/application/media.service.js";
import type {
  SeriesRepository,
  SeriesWithBookCount,
  SeriesWithDetails,
} from "../infrastructure/series.repository.js";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { SeriesService } from "./series.service.js";

type BookRow = SeriesWithBookCount["books"][number];

type BookRowInput = {
  ageCategory?: string;
  coverMedia?: Nullable<MediaAssetModel>;
  createdAt?: Date;
  formats?: string[];
  id?: string;
  isFavorite?: boolean;
  language?: string;
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  partNumber?: Nullable<number>;
  publicationYear?: Nullable<number>;
  publisherId?: Nullable<string>;
  rating?: Nullable<number>;
  readingStatus?: string;
  tags?: { id: string; name: string }[];
  title?: string;
  updatedAt?: Date;
};

type DetailBookInput = {
  ageCategory?: string;
  authors?: { id: string; name: string }[];
  coverMedia?: Nullable<{ id: string }>;
  createdAt?: Date;
  formats?: string[];
  genres?: string[];
  id: string;
  isFavorite?: boolean;
  language?: string;
  originalTitle?: Nullable<string>;
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  partNumber: Nullable<number>;
  publicationYear?: Nullable<number>;
  publisher?: Nullable<{ id: string; name: string }>;
  queuePosition?: Nullable<number>;
  rating?: Nullable<number>;
  readingStatus?: string;
  tags?: { id: string; name: string }[];
  title?: string;
  updatedAt?: Date;
};

type RepoMock = Partial<Record<keyof SeriesRepository, Mock>>;

function bookRow(overrides: BookRowInput = {}): BookRow {
  const { rating, tags, ...scalars } = overrides;
  return {
    ageCategory: "not_specified",
    authors: [],
    coverMedia: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    formats: [],
    id: "book-1",
    isFavorite: false,
    language: "ukrainian",
    ownershipStatus: "none",
    pagesCount: null,
    partNumber: 1,
    publicationYear: null,
    publisherId: null,
    readingProgress: rating === undefined ? null : { rating },
    readingStatus: "not_started",
    tags: (tags ?? []).map((tag) =>
      fakeOf<BookRow["tags"][number]>({ tag: fakeOf<BookRow["tags"][number]["tag"]>(tag) }),
    ),
    title: "Book",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...scalars,
  };
}

function coverAsset(id: string): MediaAssetModel {
  return fakeOf<MediaAssetModel>({ id });
}

function detailedSeries(
  input: Partial<SeriesModel> & {
    books: DetailBookInput[];
  },
): SeriesWithDetails {
  const { books, ...overrides } = input;
  return {
    ...series(overrides),
    _count: { books: books.length },
    authors: [],
    books: books.map((book) => ({
      ageCategory: book.ageCategory ?? "not_specified",
      authors: (book.authors ?? []).map((author, index) => ({
        author: { id: author.id, name: author.name },
        position: index,
      })),
      coverMedia: book.coverMedia ?? null,
      createdAt: book.createdAt ?? new Date("2026-02-01T10:00:00.000Z"),
      formats: book.formats ?? [],
      genres: book.genres ?? [],
      id: book.id,
      isFavorite: book.isFavorite ?? false,
      language: book.language ?? "ukrainian",
      loans: [],
      orderItems: [],
      originalTitle: book.originalTitle ?? null,
      ownershipStatus: book.ownershipStatus ?? "none",
      pagesCount: book.pagesCount ?? null,
      partNumber: book.partNumber,
      publicationYear: book.publicationYear ?? null,
      publisher: book.publisher ?? null,
      queuePosition: book.queuePosition ?? null,
      readingProgress:
        book.rating === undefined ? null : { currentPage: null, rating: book.rating },
      readingStatus: book.readingStatus ?? "not_started",
      tags: (book.tags ?? []).map((tag) => ({ tag: { id: tag.id, name: tag.name } })),
      title: book.title ?? "Book",
      updatedAt: book.updatedAt ?? new Date("2026-02-01T10:00:00.000Z"),
    })),
  } as unknown as SeriesWithDetails;
}

function makeService(options: {
  assertGenresSelectable?: Mock;
  buildViewOrNull?: Mock;
  repository: RepoMock;
  resolveReferences?: Mock;
}): {
  authorsService: { resolveReferences: Mock };
  genresService: { assertGenresSelectable: Mock };
  mediaService: { buildViewOrNull: Mock };
  service: SeriesService;
} {
  const resolveReferences = options.resolveReferences ?? vi.fn().mockResolvedValue([]);
  const authorsService = { resolveReferences };
  const assertGenresSelectable =
    options.assertGenresSelectable ?? vi.fn().mockResolvedValue(undefined);
  const genresService = { assertGenresSelectable };
  const buildViewOrNull =
    options.buildViewOrNull ??
    vi.fn((asset: Nullable<{ id: string }>) => (asset === null ? null : mediaView(asset.id)));
  const mediaService = { buildViewOrNull };
  const service = new SeriesService(
    fakeOf<SeriesRepository>(options.repository),
    fakeOf<AuthorsService>(authorsService),
    fakeOf<GenresService>(genresService),
    fakeOf<MediaService>(mediaService),
  );
  return { authorsService, genresService, mediaService, service };
}

function mediaView(id: string): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-02-01T10:00:00.000Z",
    height: 800,
    id,
    kind: "book_cover",
    name: null,
    sizeBytes: 1000,
    urls: { card: `card-${id}`, full: `full-${id}`, thumb: `thumb-${id}` },
    width: 600,
  };
}

function ownedWithCount(
  input: Partial<SeriesModel> & {
    bookCount?: number;
    books?: SeriesWithBookCount["books"];
  } = {},
): SeriesWithBookCount {
  const { bookCount, books = [], ...overrides } = input;
  return {
    ...series(overrides),
    _count: { books: bookCount ?? books.length },
    authors: [],
    books,
  };
}

const TX = fakeOf<Prisma.TransactionClient>();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SERIES_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function buildService(overrides: {
  createByNormalized?: Error | SeriesModel;
  findByNormalized?: Nullable<SeriesModel>;
  findOwnedById?: Nullable<SeriesModel>;
  searchOwned?: SeriesWithBookCount[];
}): {
  authorsService: {
    resolveReferences: Mock;
  };
  genresService: {
    assertGenresSelectable: Mock;
  };
  repository: {
    acquireCreateLock: Mock;
    countOwned: Mock;
    createByNormalized: Mock;
    findByNormalized: Mock;
    findOwnedById: Mock;
    searchOwned: Mock;
  };
  service: SeriesService;
} {
  const acquireCreateLock = vi.fn().mockResolvedValue(undefined);
  const createByNormalized = vi.fn();
  if (overrides.createByNormalized instanceof Error) {
    createByNormalized.mockRejectedValue(overrides.createByNormalized);
  } else {
    createByNormalized.mockResolvedValue(overrides.createByNormalized ?? series());
  }

  const searchOwned = overrides.searchOwned ?? [];
  const repository = {
    acquireCreateLock,
    countOwned: vi.fn().mockResolvedValue(searchOwned.length),
    createByNormalized,
    findByNormalized: vi.fn().mockResolvedValue(overrides.findByNormalized ?? null),
    findOwnedById: vi.fn().mockResolvedValue(overrides.findOwnedById ?? null),
    searchOwned: vi.fn().mockResolvedValue(searchOwned),
  };

  const authorsService = {
    resolveReferences: vi.fn().mockResolvedValue([]),
  };

  const genresService = {
    assertGenresSelectable: vi.fn().mockResolvedValue(undefined),
  };

  const mediaService = {
    buildViewOrNull: vi.fn((asset: Nullable<{ id: string }>) =>
      asset === null ? null : mediaView(asset.id),
    ),
  };

  const service = new SeriesService(
    fakeOf<SeriesRepository>(repository),
    fakeOf<AuthorsService>(authorsService),
    fakeOf<GenresService>(genresService),
    fakeOf<MediaService>(mediaService),
  );

  return { authorsService, genresService, repository, service };
}

function series(overrides: Partial<SeriesModel> = {}): SeriesModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    deletedAt: null,
    description: null,
    genres: [],
    id: SERIES_ID,
    name: "Throne of Glass",
    normalizedName: "throne of glass",
    purgeAt: null,
    status: "unknown",
    totalBooks: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function seriesWithCount(
  booksInSeries: number,
  overrides: Partial<SeriesModel> = {},
  finishedInSeries = 0,
): SeriesWithBookCount {
  return {
    ...series(overrides),
    _count: { books: booksInSeries },
    authors: [],
    books: Array.from({ length: finishedInSeries }, (unused, index) =>
      bookRow({
        id: `b-${index}`,
        partNumber: index + 1,
        readingStatus: "finished",
        title: `Book ${index}`,
      }),
    ),
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

describe("SeriesService.resolveForBook by id", () => {
  it("returns the id when an owned series is found", async () => {
    const { service } = buildService({ findOwnedById: series({ id: SERIES_ID }) });

    const resolved = await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID }, TX);

    expect(resolved.id).toBe(SERIES_ID);
  });

  it("returns the total books when an owned series is found", async () => {
    const { service } = buildService({ findOwnedById: series({ id: SERIES_ID, totalBooks: 3 }) });

    const resolved = await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID }, TX);

    expect(resolved.totalBooks).toBe(3);
  });

  it("throws NotFoundError when the id is not owned by the user", async () => {
    const { service } = buildService({ findOwnedById: null });

    await expect(
      service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID }, TX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not upsert a new series when resolving by id", async () => {
    const { repository, service } = buildService({ findOwnedById: series() });

    await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID }, TX);

    expect(repository.createByNormalized).not.toHaveBeenCalled();
  });
});

describe("SeriesService.resolveForBook by newSeries", () => {
  it("reuses the matching series and ignores the extra fields", async () => {
    const { repository, service } = buildService({
      findByNormalized: series({ id: OTHER_ID }),
    });

    const resolved = await service.resolveForBook(
      {
        newSeries: { genres: [], name: "Throne of Glass", status: "completed", totalBooks: 8 },
        userId: USER_ID,
      },
      TX,
    );

    expect(resolved.id).toBe(OTHER_ID);
    expect(repository.createByNormalized).not.toHaveBeenCalled();
  });

  it("matches an existing series case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({ findByNormalized: series({ id: OTHER_ID }) });

    await service.resolveForBook(
      {
        newSeries: { genres: [], name: "  Throne   OF Glass ", status: "unknown" },
        userId: USER_ID,
      },
      TX,
    );

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "throne of glass", TX);
  });

  it("creates a series with the provided fields when no match exists", async () => {
    const created = series({ id: SERIES_ID });
    const { repository, service } = buildService({
      createByNormalized: created,
      findByNormalized: null,
    });

    const resolved = await service.resolveForBook(
      {
        newSeries: {
          description: "saga",
          genres: ["fantasy"],
          name: "Throne of Glass",
          status: "ongoing",
          totalBooks: 3,
        },
        userId: USER_ID,
      },
      TX,
    );

    expect(resolved.id).toBe(SERIES_ID);
    expect(repository.createByNormalized).toHaveBeenCalledWith(
      {
        authorIds: [],
        data: {
          description: "saga",
          genres: ["fantasy"],
          name: "Throne of Glass",
          normalizedName: "throne of glass",
          status: "ongoing",
          totalBooks: 3,
        },
        userId: USER_ID,
      },
      TX,
    );
  });

  it("propagates errors raised by the create", async () => {
    const { service } = buildService({
      createByNormalized: new Error("connection lost"),
      findByNormalized: null,
    });

    await expect(
      service.resolveForBook(
        {
          newSeries: { genres: [], name: "Throne of Glass", status: "unknown" },
          userId: USER_ID,
        },
        TX,
      ),
    ).rejects.toThrow("connection lost");
  });

  it("throws NotFoundError when neither id nor newSeries is provided", async () => {
    const { service } = buildService({});

    await expect(service.resolveForBook({ userId: USER_ID }, TX)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("SeriesService.resolveForBook author linking", () => {
  const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("links the resolved newSeries authors to the created series in resolver order", async () => {
    const { authorsService, repository, service } = buildService({
      createByNormalized: series({ id: SERIES_ID }),
      findByNormalized: null,
    });
    authorsService.resolveReferences.mockResolvedValue([
      { id: AUTHOR_A, name: "Sarah J. Maas" },
      { id: AUTHOR_B, name: "Leigh Bardugo" },
    ]);

    await service.resolveForBook(
      {
        newSeries: {
          authors: [{ id: AUTHOR_A }, { id: AUTHOR_B }],
          genres: [],
          name: "Throne of Glass",
          status: "unknown",
        },
        userId: USER_ID,
      },
      TX,
    );

    expect(authorsService.resolveReferences).toHaveBeenCalledWith({
      references: [{ id: AUTHOR_A }, { id: AUTHOR_B }],
      userId: USER_ID,
    });
    expect(repository.createByNormalized).toHaveBeenCalledWith(
      {
        authorIds: [AUTHOR_A, AUTHOR_B],
        data: expect.objectContaining({
          name: "Throne of Glass",
          normalizedName: "throne of glass",
        }),
        userId: USER_ID,
      },
      TX,
    );
  });

  it("falls back to the book's authors when newSeries omits an authors field", async () => {
    const { authorsService, repository, service } = buildService({
      createByNormalized: series({ id: SERIES_ID }),
      findByNormalized: null,
    });

    await service.resolveForBook(
      {
        fallbackAuthorIds: [AUTHOR_A, AUTHOR_B],
        newSeries: { genres: [], name: "Throne of Glass", status: "unknown" },
        userId: USER_ID,
      },
      TX,
    );

    expect(authorsService.resolveReferences).toHaveBeenCalledWith({
      references: [],
      userId: USER_ID,
    });
    expect(repository.createByNormalized).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: [AUTHOR_A, AUTHOR_B] }),
      TX,
    );
  });

  it("prefers explicit newSeries authors over the book's fallback authors", async () => {
    const { authorsService, repository, service } = buildService({
      createByNormalized: series({ id: SERIES_ID }),
      findByNormalized: null,
    });
    authorsService.resolveReferences.mockResolvedValue([{ id: AUTHOR_A, name: "Sarah J. Maas" }]);

    await service.resolveForBook(
      {
        fallbackAuthorIds: [AUTHOR_B],
        newSeries: {
          authors: [{ id: AUTHOR_A }],
          genres: [],
          name: "Throne of Glass",
          status: "unknown",
        },
        userId: USER_ID,
      },
      TX,
    );

    expect(repository.createByNormalized).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: [AUTHOR_A] }),
      TX,
    );
  });

  it("does not link any authors when resolving an existing series by id", async () => {
    const { repository, service } = buildService({ findOwnedById: series() });

    await service.resolveForBook(
      {
        fallbackAuthorIds: [AUTHOR_A],
        seriesId: SERIES_ID,
        userId: USER_ID,
      },
      TX,
    );

    expect(repository.createByNormalized).not.toHaveBeenCalled();
  });
});

describe("SeriesService.search", () => {
  it("returns a paginator of mapped series views", async () => {
    const { service } = buildService({
      searchOwned: [
        seriesWithCount(2, {
          description: "saga",
          id: SERIES_ID,
          status: "ongoing",
          totalBooks: 3,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page).toEqual({
      items: [
        {
          ageCategories: [],
          authors: [],
          averagePages: null,
          averageRating: null,
          booksInSeries: 2,
          covers: [],
          createdAt: "2026-02-01T10:00:00.000Z",
          description: "saga",
          finishedInSeries: 0,
          formats: [],
          genres: [],
          hasFavoriteBook: false,
          hasPublicationYears: false,
          hasPublisher: false,
          id: SERIES_ID,
          languages: [],
          lastActivityAt: "2026-02-02T11:00:00.000Z",
          missingPartNumbers: [],
          name: "Throne of Glass",
          nextBook: null,
          ownership: { ownedCount: 0, total: 0 },
          pagesCount: null,
          readingInSeries: 0,
          status: "ongoing",
          tags: [],
          totalBooks: 3,
        },
      ],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 1,
    });
  });

  it("maps a series whose books carry a gap, a publisher and a publication year", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          bookCount: 2,
          books: [
            bookRow({
              id: "part-1",
              ownershipStatus: "owned",
              partNumber: 1,
              publicationYear: 2012,
              publisherId: "publisher-vivat",
              readingStatus: "finished",
            }),
            bookRow({ id: "part-3", partNumber: 3 }),
          ],
          id: SERIES_ID,
          status: "ongoing",
          totalBooks: 3,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items).toEqual([
      {
        ageCategories: ["not_specified"],
        authors: [],
        averagePages: null,
        averageRating: null,
        booksInSeries: 2,
        covers: [],
        createdAt: "2026-02-01T10:00:00.000Z",
        description: null,
        finishedInSeries: 1,
        formats: [],
        genres: [],
        hasFavoriteBook: false,
        hasPublicationYears: true,
        hasPublisher: true,
        id: SERIES_ID,
        languages: ["ukrainian"],
        lastActivityAt: "2026-02-02T11:00:00.000Z",
        missingPartNumbers: [2],
        name: "Throne of Glass",
        nextBook: {
          cover: null,
          id: "part-3",
          ownershipStatus: "none",
          partNumber: 3,
          title: "Book",
        },
        ownership: { ownedCount: 1, total: 2 },
        pagesCount: null,
        readingInSeries: 0,
        status: "ongoing",
        tags: [],
        totalBooks: 3,
      },
    ]);
  });

  it("maps the aggregates of the loaded books onto the view", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          bookCount: 3,
          books: [
            bookRow({
              ageCategory: "18_plus",
              formats: ["ebook"],
              id: "part-1",
              language: "english",
              ownershipStatus: "borrowed_from_someone",
              pagesCount: 100,
              partNumber: 1,
              rating: 7,
              readingStatus: "finished",
              tags: [{ id: "tag-zebra", name: "zebra" }],
            }),
            bookRow({
              ageCategory: "6_plus",
              formats: ["paper", "ebook"],
              id: "part-2",
              isFavorite: true,
              language: "ukrainian",
              ownershipStatus: "owned",
              pagesCount: 200,
              partNumber: 2,
              rating: 8,
              readingStatus: "reading",
              tags: [
                { id: "tag-alpha", name: "alpha" },
                { id: "tag-zebra", name: "zebra" },
              ],
            }),
            bookRow({
              ageCategory: "12_plus",
              formats: ["audiobook"],
              id: "part-3",
              language: "other",
              ownershipStatus: "want_to_buy",
              pagesCount: null,
              partNumber: 3,
            }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items).toEqual([
      {
        ageCategories: ["6_plus", "12_plus", "18_plus"],
        authors: [],
        averagePages: 150,
        averageRating: 7.5,
        booksInSeries: 3,
        covers: [],
        createdAt: "2026-02-01T10:00:00.000Z",
        description: null,
        finishedInSeries: 1,
        formats: ["paper", "ebook", "audiobook"],
        genres: [],
        hasFavoriteBook: true,
        hasPublicationYears: false,
        hasPublisher: false,
        id: SERIES_ID,
        languages: ["ukrainian", "english", "other"],
        lastActivityAt: "2026-02-02T11:00:00.000Z",
        missingPartNumbers: [],
        name: "Throne of Glass",
        nextBook: {
          cover: null,
          id: "part-2",
          ownershipStatus: "owned",
          partNumber: 2,
          title: "Book",
        },
        ownership: { ownedCount: 1, total: 3 },
        pagesCount: 300,
        readingInSeries: 1,
        status: "unknown",
        tags: [
          { id: "tag-alpha", name: "alpha" },
          { id: "tag-zebra", name: "zebra" },
        ],
        totalBooks: null,
      },
    ]);
  });

  it("leaves a rated series average null when no loaded book carries a rating", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ id: "part-1", partNumber: 1 }),
            bookRow({ id: "part-2", partNumber: 2, rating: null }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.averageRating).toBeNull();
  });

  it("reports no missing part numbers when the loaded parts are contiguous", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ id: "part-1", partNumber: 1 }),
            bookRow({ id: "part-2", partNumber: 2 }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.missingPartNumbers).toEqual([]);
  });

  it("reports hasPublisher false when no loaded book carries a publisher", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [bookRow({ id: "part-1", partNumber: 1, publisherId: null })],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.hasPublisher).toBe(false);
  });

  it("reports hasPublicationYears false when no loaded book carries a publication year", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [bookRow({ id: "part-1", partNumber: 1, publicationYear: null })],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.hasPublicationYears).toBe(false);
  });

  it("maps the ownership status of the next book onto the view", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({
              id: "part-1",
              ownershipStatus: "borrowed_from_someone",
              partNumber: 1,
              readingStatus: "not_started",
            }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.nextBook?.ownershipStatus).toBe("borrowed_from_someone");
  });

  it("maps the live linked-book count onto booksInSeries", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(4)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items).toEqual([expect.objectContaining({ booksInSeries: 4 })]);
  });

  it("maps the loaded finished-book count onto finishedInSeries", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(4, {}, 2)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items).toEqual([
      expect.objectContaining({ booksInSeries: 4, finishedInSeries: 2 }),
    ]);
  });

  it("maps a series with no linked books to a zero count", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(0)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items).toEqual([
      expect.objectContaining({ booksInSeries: 0, finishedInSeries: 0 }),
    ]);
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchOwned: [] });

    await service.search(USER_ID, {
      pageNumber: 3,
      pageSize: 20,
      search: "throne",
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(repository.searchOwned).toHaveBeenCalledWith({
      query: expect.objectContaining({ search: "throne" }),
      skip: 40,
      take: 20,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith({
      query: expect.objectContaining({ search: "throne" }),
      userId: USER_ID,
    });
  });

  it("forwards the requested authorIds to the repository search and count", async () => {
    const authorIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"];
    const { repository, service } = buildService({ searchOwned: [] });

    await service.search(USER_ID, {
      authorIds,
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(repository.searchOwned).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ authorIds }) }),
    );
    expect(repository.countOwned).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ authorIds }) }),
    );
  });
});

describe("SeriesService.search covers", () => {
  it("builds covers ordered by part number only for books that have a cover", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ coverMedia: coverAsset("media-2"), id: "book-2", partNumber: 2 }),
            bookRow({ coverMedia: coverAsset("media-1"), id: "book-1", partNumber: 1 }),
            bookRow({ coverMedia: null, id: "book-3", partNumber: 3 }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.covers).toEqual([
      { bookId: "book-1", cover: mediaView("media-1"), title: "Book" },
      { bookId: "book-2", cover: mediaView("media-2"), title: "Book" },
    ]);
  });

  it("returns an empty covers array when no book has a cover", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ coverMedia: null, id: "book-1", partNumber: 1 }),
            bookRow({ coverMedia: null, id: "book-2", partNumber: 2 }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.covers).toEqual([]);
  });

  it("caps covers at three when more than three books have a cover", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ coverMedia: coverAsset("media-1"), id: "book-1", partNumber: 1 }),
            bookRow({ coverMedia: coverAsset("media-2"), id: "book-2", partNumber: 2 }),
            bookRow({ coverMedia: coverAsset("media-3"), id: "book-3", partNumber: 3 }),
            bookRow({ coverMedia: coverAsset("media-4"), id: "book-4", partNumber: 4 }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.covers.map((cover) => cover.bookId)).toEqual([
      "book-1",
      "book-2",
      "book-3",
    ]);
  });

  it("orders books with a null part number after the numbered ones", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ coverMedia: coverAsset("media-null"), id: "book-null", partNumber: null }),
            bookRow({ coverMedia: coverAsset("media-1"), id: "book-1", partNumber: 1 }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.covers.map((cover) => cover.bookId)).toEqual(["book-1", "book-null"]);
  });
});

describe("SeriesService nextBook cover", () => {
  it("attaches the resolved cover to the next book in the search response", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({
              coverMedia: coverAsset("media-1"),
              id: "book-1",
              partNumber: 1,
              readingStatus: "reading",
            }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.nextBook).toEqual({
      cover: mediaView("media-1"),
      id: "book-1",
      ownershipStatus: "none",
      partNumber: 1,
      title: "Book",
    });
  });

  it("leaves the next book cover null when the next book has none", async () => {
    const { service } = buildService({
      searchOwned: [
        ownedWithCount({
          books: [
            bookRow({ coverMedia: null, id: "book-1", partNumber: 1, readingStatus: "reading" }),
          ],
          id: SERIES_ID,
        }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sort: SERIES_SORT_DEFAULT,
      tab: "all",
    });

    expect(page.items[0]?.nextBook?.cover).toBeNull();
  });

  it("attaches the resolved cover to the next book in the overview topUnfinished", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(0),
      findAllOwned: vi.fn().mockResolvedValue([
        ownedWithCount({
          books: [
            bookRow({ id: "done-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({
              coverMedia: coverAsset("media-9"),
              id: "next-2",
              partNumber: 2,
              readingStatus: "reading",
            }),
          ],
          id: SERIES_ID,
        }),
      ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.topUnfinished[0]?.nextBook).toEqual({
      cover: mediaView("media-9"),
      id: "next-2",
      ownershipStatus: "none",
      partNumber: 2,
      title: "Book",
    });
  });
});

describe("SeriesService.create", () => {
  it("returns the mapped view when the name is free", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(
        ownedWithCount({
          id: SERIES_ID,
          name: "Throne of Glass",
          status: "ongoing",
          totalBooks: 3,
        }),
      ),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const { service } = makeService({ repository });

    const view = await service.create(USER_ID, {
      genres: [],
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });

    expect(view).toMatchObject({
      id: SERIES_ID,
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });
  });

  it("passes the normalized name and mapped data to the repository", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const { service } = makeService({ repository });

    await service.create(USER_ID, {
      description: "saga",
      genres: ["fantasy"],
      name: "Throne OF Glass",
      status: "ongoing",
      totalBooks: 5,
    });

    expect(repository.create).toHaveBeenCalledWith({
      authorIds: [],
      data: {
        description: "saga",
        genres: ["fantasy"],
        name: "Throne OF Glass",
        normalizedName: "throne of glass",
        status: "ongoing",
        totalBooks: 5,
      },
      userId: USER_ID,
    });
  });

  it("defaults the description and total books to null when omitted", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const { service } = makeService({ repository });

    await service.create(USER_ID, { genres: [], name: "Throne of Glass", status: "unknown" });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null, totalBooks: null }),
      }),
    );
  });

  it("throws ConflictError and never inserts when the normalized name is taken", async () => {
    const repository = {
      create: vi.fn(),
      findByNormalized: vi.fn().mockResolvedValue(series({ id: OTHER_ID })),
    };
    const { service } = makeService({ repository });

    await expect(
      service.create(USER_ID, { genres: [], name: "Throne of Glass", status: "unknown" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps a unique violation raced by a concurrent insert into a ConflictError", async () => {
    const findByNormalized = vi.fn().mockResolvedValue(null);
    const repository = {
      create: vi.fn().mockRejectedValue(uniqueConstraintError()),
      findByNormalized,
    };
    const { service } = makeService({ repository });

    await expect(
      service.create(USER_ID, { genres: [], name: "Throne of Glass", status: "unknown" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(findByNormalized).toHaveBeenCalledTimes(1);
  });

  it("resolves the provided author references before creating the series", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const resolveReferences = vi
      .fn()
      .mockResolvedValue([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Sarah J. Maas" }]);
    const { service } = makeService({ repository, resolveReferences });

    await service.create(USER_ID, {
      authors: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      genres: [],
      name: "Throne of Glass",
      status: "unknown",
    });

    expect(resolveReferences).toHaveBeenCalledWith({
      references: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      userId: USER_ID,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] }),
    );
  });

  it("threads the provided genres into the created series and returns them", async () => {
    const repository = {
      create: vi
        .fn()
        .mockResolvedValue(ownedWithCount({ genres: ["fantasy", "romance"], id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const { service } = makeService({ repository });

    const view = await service.create(USER_ID, {
      genres: ["fantasy", "romance"],
      name: "Throne of Glass",
      status: "unknown",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ genres: ["fantasy", "romance"] }),
      }),
    );
    expect(view.genres).toEqual(["fantasy", "romance"]);
  });

  it("defaults genres to an empty array in the returned view", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const { service } = makeService({ repository });

    const view = await service.create(USER_ID, {
      genres: [],
      name: "Throne of Glass",
      status: "unknown",
    });

    expect(view.genres).toEqual([]);
  });

  it("validates the genres against the catalog before creating", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const assertGenresSelectable = vi.fn().mockResolvedValue(undefined);
    const { service } = makeService({ assertGenresSelectable, repository });

    await service.create(USER_ID, {
      genres: ["fantasy", "romance"],
      name: "Throne of Glass",
      status: "unknown",
    });

    expect(assertGenresSelectable).toHaveBeenCalledWith(USER_ID, ["fantasy", "romance"]);
  });

  it("propagates a BadRequestError and never inserts when a genre is not in the catalog", async () => {
    const repository = {
      create: vi.fn(),
      findByNormalized: vi.fn().mockResolvedValue(null),
    };
    const assertGenresSelectable = vi.fn().mockRejectedValue(new BadRequestError("Invalid genres"));
    const { service } = makeService({ assertGenresSelectable, repository });

    await expect(
      service.create(USER_ID, { genres: ["nope"], name: "Throne of Glass", status: "unknown" }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SeriesService.update", () => {
  it("throws NotFoundError when the series is not owned by the user", async () => {
    const repository = { findOwnedWithCountById: vi.fn().mockResolvedValue(null) };
    const { service } = makeService({ repository });

    await expect(service.update(USER_ID, SERIES_ID, { name: "New" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ValidationError when totalBooks is below the current book count", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(
        ownedWithCount({
          bookCount: 3,
          books: [
            bookRow({ id: "b1", partNumber: 1 }),
            bookRow({ id: "b2", partNumber: 2 }),
            bookRow({ id: "b3", partNumber: 3 }),
          ],
          id: SERIES_ID,
        }),
      ),
      updateOwned: vi.fn(),
    };
    const { service } = makeService({ repository });

    await expect(service.update(USER_ID, SERIES_ID, { totalBooks: 2 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("throws ValidationError when totalBooks is below an existing part number", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(
        ownedWithCount({
          bookCount: 1,
          books: [bookRow({ id: "b1", partNumber: 5 })],
          id: SERIES_ID,
        }),
      ),
      updateOwned: vi.fn(),
    };
    const { service } = makeService({ repository });

    await expect(service.update(USER_ID, SERIES_ID, { totalBooks: 3 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the new name belongs to another series", async () => {
    const repository = {
      findByNormalized: vi.fn().mockResolvedValue(series({ id: OTHER_ID })),
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn(),
    };
    const { service } = makeService({ repository });

    await expect(service.update(USER_ID, SERIES_ID, { name: "Taken" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("allows renaming a series to its own current name", async () => {
    const repository = {
      findByNormalized: vi.fn().mockResolvedValue(series({ id: SERIES_ID })),
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi
        .fn()
        .mockResolvedValue(ownedWithCount({ id: SERIES_ID, name: "Throne of Glass" })),
    };
    const { service } = makeService({ repository });

    const view = await service.update(USER_ID, SERIES_ID, { name: "Throne of Glass" });

    expect(view.name).toBe("Throne of Glass");
    expect(repository.updateOwned).toHaveBeenCalledTimes(1);
  });

  it("clears the description and total books when passed null", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
    };
    const { service } = makeService({ repository });

    await service.update(USER_ID, SERIES_ID, { description: null, totalBooks: null });

    expect(repository.updateOwned).toHaveBeenCalledWith(USER_ID, SERIES_ID, {
      authorIds: undefined,
      fields: { description: null, totalBooks: null },
    });
  });

  it("replaces the authors when an authors list is provided", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
    };
    const resolveReferences = vi
      .fn()
      .mockResolvedValue([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Sarah J. Maas" }]);
    const { service } = makeService({ repository, resolveReferences });

    await service.update(USER_ID, SERIES_ID, {
      authors: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    });

    expect(repository.updateOwned).toHaveBeenCalledWith(USER_ID, SERIES_ID, {
      authorIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      fields: {},
    });
  });

  it("returns the fresh view for an empty patch without touching name or authors", async () => {
    const repository = {
      findByNormalized: vi.fn(),
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi
        .fn()
        .mockResolvedValue(ownedWithCount({ id: SERIES_ID, name: "Throne of Glass" })),
    };
    const resolveReferences = vi.fn();
    const { service } = makeService({ repository, resolveReferences });

    const view = await service.update(USER_ID, SERIES_ID, {});

    expect(view).toMatchObject({ id: SERIES_ID, name: "Throne of Glass" });
    expect(repository.updateOwned).toHaveBeenCalledWith(USER_ID, SERIES_ID, {
      authorIds: undefined,
      fields: {},
    });
    expect(repository.findByNormalized).not.toHaveBeenCalled();
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it("maps a unique violation from the update into a ConflictError", async () => {
    const repository = {
      findByNormalized: vi.fn().mockResolvedValue(null),
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn().mockRejectedValue(uniqueConstraintError()),
    };
    const { service } = makeService({ repository });

    await expect(service.update(USER_ID, SERIES_ID, { name: "New" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("writes the genres field and returns the replaced genres when provided", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi
        .fn()
        .mockResolvedValue(ownedWithCount({ genres: ["fantasy"], id: SERIES_ID })),
    };
    const { service } = makeService({ repository });

    const view = await service.update(USER_ID, SERIES_ID, { genres: ["fantasy"] });

    expect(repository.updateOwned).toHaveBeenCalledWith(USER_ID, SERIES_ID, {
      authorIds: undefined,
      fields: { genres: ["fantasy"] },
    });
    expect(view.genres).toEqual(["fantasy"]);
  });

  it("omits the genres field from the update when genres are not provided", async () => {
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
    };
    const { service } = makeService({ repository });

    await service.update(USER_ID, SERIES_ID, { status: "completed" });

    expect(repository.updateOwned).toHaveBeenCalledWith(USER_ID, SERIES_ID, {
      authorIds: undefined,
      fields: { status: "completed" },
    });
  });

  it("validates the genres against the catalog before writing them", async () => {
    const assertGenresSelectable = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi
        .fn()
        .mockResolvedValue(ownedWithCount({ genres: ["fantasy"], id: SERIES_ID })),
    };
    const { service } = makeService({ assertGenresSelectable, repository });

    await service.update(USER_ID, SERIES_ID, { genres: ["fantasy"] });

    expect(assertGenresSelectable).toHaveBeenCalledWith(USER_ID, ["fantasy"]);
  });

  it("propagates a BadRequestError and never updates when a genre is not in the catalog", async () => {
    const assertGenresSelectable = vi.fn().mockRejectedValue(new BadRequestError("Invalid genres"));
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn(),
    };
    const { service } = makeService({ assertGenresSelectable, repository });

    await expect(service.update(USER_ID, SERIES_ID, { genres: ["nope"] })).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("does not validate genres when the patch omits them", async () => {
    const assertGenresSelectable = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findOwnedWithCountById: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
      updateOwned: vi.fn().mockResolvedValue(ownedWithCount({ id: SERIES_ID })),
    };
    const { service } = makeService({ assertGenresSelectable, repository });

    await service.update(USER_ID, SERIES_ID, { status: "completed" });

    expect(assertGenresSelectable).not.toHaveBeenCalled();
  });
});

describe("SeriesService.overview", () => {
  it("counts fully read and unfinished series and passes through the linked book total", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(7),
      findAllOwned: vi.fn().mockResolvedValue([
        ownedWithCount({
          books: [
            bookRow({ id: "fr-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "fr-2", partNumber: 2, readingStatus: "finished" }),
          ],
          id: "series-fully-read",
        }),
        ownedWithCount({
          books: [
            bookRow({ id: "uf-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "uf-2", partNumber: 2, readingStatus: "reading" }),
          ],
          id: "series-unfinished",
        }),
        ownedWithCount({ books: [], id: "series-empty" }),
      ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview).toMatchObject({
      booksInSeries: 7,
      booksLeftInUnfinishedSeries: 1,
      finishedBooksInSeries: 3,
      fullyReadSeries: 1,
      totalSeries: 3,
      unfinishedSeries: 1,
    });
  });

  it("aggregates finished books across all series and unread books only for unfinished ones", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(5),
      findAllOwned: vi.fn().mockResolvedValue([
        ownedWithCount({
          books: [
            bookRow({ id: "done-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "done-2", partNumber: 2, readingStatus: "finished" }),
          ],
          id: "series-done",
        }),
        ownedWithCount({
          books: [
            bookRow({ id: "wip-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "wip-2", partNumber: 2, readingStatus: "reading" }),
            bookRow({ id: "wip-3", partNumber: 3, readingStatus: "not_started" }),
          ],
          id: "series-wip",
        }),
      ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.finishedBooksInSeries).toBe(3);
    expect(overview.booksLeftInUnfinishedSeries).toBe(2);
  });

  it("tallies the status counts across every series", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(0),
      findAllOwned: vi
        .fn()
        .mockResolvedValue([
          ownedWithCount({ id: "s1", status: "completed" }),
          ownedWithCount({ id: "s2", status: "ongoing" }),
          ownedWithCount({ id: "s3", status: "ongoing" }),
          ownedWithCount({ id: "s4", status: "unknown" }),
        ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.statusCounts).toEqual({ completed: 1, ongoing: 2, unknown: 1 });
  });

  it("orders topUnfinished by progress descending", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(0),
      findAllOwned: vi.fn().mockResolvedValue([
        ownedWithCount({
          books: [
            bookRow({ id: "low-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "low-2", partNumber: 2, readingStatus: "reading" }),
          ],
          id: "series-low",
        }),
        ownedWithCount({
          books: [
            bookRow({ id: "high-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({ id: "high-2", partNumber: 2, readingStatus: "finished" }),
            bookRow({ id: "high-3", partNumber: 3, readingStatus: "reading" }),
          ],
          id: "series-high",
        }),
      ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.topUnfinished.map((entry) => entry.id)).toEqual(["series-high", "series-low"]);
  });

  it("breaks a progress tie by the most recent activity", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(0),
      findAllOwned: vi.fn().mockResolvedValue([
        ownedWithCount({
          books: [
            bookRow({ id: "old-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({
              id: "old-2",
              partNumber: 2,
              readingStatus: "reading",
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
          ],
          id: "series-old",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        ownedWithCount({
          books: [
            bookRow({ id: "recent-1", partNumber: 1, readingStatus: "finished" }),
            bookRow({
              id: "recent-2",
              partNumber: 2,
              readingStatus: "reading",
              updatedAt: new Date("2026-06-01T00:00:00.000Z"),
            }),
          ],
          id: "series-recent",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ]),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.topUnfinished.map((entry) => entry.id)).toEqual([
      "series-recent",
      "series-old",
    ]);
  });

  it("caps topUnfinished at three entries", async () => {
    const repository = {
      countBooksInSeries: vi.fn().mockResolvedValue(0),
      findAllOwned: vi.fn().mockResolvedValue(
        Array.from({ length: 4 }, (unused, index) =>
          ownedWithCount({
            books: [
              bookRow({ id: `s${index}-1`, partNumber: 1, readingStatus: "finished" }),
              bookRow({ id: `s${index}-2`, partNumber: 2, readingStatus: "reading" }),
            ],
            id: `series-${index}`,
          }),
        ),
      ),
    };
    const { service } = makeService({ repository });

    const overview = await service.overview(USER_ID);

    expect(overview.topUnfinished).toHaveLength(3);
  });
});

describe("SeriesService.getById", () => {
  it("throws NotFoundError when the series is not owned by the user", async () => {
    const repository = { findOwnedDetailsById: vi.fn().mockResolvedValue(null) };
    const { service } = makeService({ repository });

    await expect(service.getById(USER_ID, SERIES_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("orders the books by part number ascending with nulls last", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            { id: "part-2", partNumber: 2 },
            { id: "part-null", partNumber: null },
            { id: "part-1", partNumber: 1 },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books.map((book) => book.id)).toEqual(["part-1", "part-2", "part-null"]);
  });

  it("breaks a part number tie by the earliest createdAt", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            { createdAt: new Date("2026-03-01T00:00:00.000Z"), id: "later", partNumber: null },
            { createdAt: new Date("2026-01-01T00:00:00.000Z"), id: "earlier", partNumber: null },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books.map((book) => book.id)).toEqual(["earlier", "later"]);
  });

  it("exposes a null rating for unrated books and the computed stats", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            {
              id: "part-1",
              pagesCount: 300,
              partNumber: 1,
              rating: 8,
              readingStatus: "finished",
            },
            { id: "part-2", pagesCount: 200, partNumber: 2, readingStatus: "reading" },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books[1]?.rating).toBeNull();
    expect(details.stats).toEqual({
      averagePages: 250,
      averageRating: 8,
      booksCount: 2,
      favoriteBook: null,
      finishedCount: 1,
      lastFinishedAt: null,
      pagesCount: 500,
      readingCount: 1,
      readingDurationDays: null,
      readPagesCount: 300,
      readPagesPartial: false,
      startedAt: null,
      unreadCount: 0,
    });
  });

  it("builds the media cover for books that have one and null for those that do not", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            { coverMedia: { id: "media-1" }, id: "with-cover", partNumber: 1 },
            { coverMedia: null, id: "without-cover", partNumber: 2 },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books[0]?.cover).toEqual(mediaView("media-1"));
    expect(details.books[1]?.cover).toBeNull();
  });

  it("maps the card fields onto each series book", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            {
              ageCategory: "12_plus",
              formats: ["paper", "ebook"],
              genres: ["fantasy", "romance"],
              id: "part-1",
              partNumber: 1,
              publicationYear: 2018,
              queuePosition: 2,
              tags: [{ id: "tag-1", name: "epic" }],
            },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books[0]).toMatchObject({
      ageCategory: "12_plus",
      formats: ["paper", "ebook"],
      genres: ["fantasy", "romance"],
      isInReadingQueue: true,
      publicationYear: 2018,
      tags: [{ id: "tag-1", name: "epic" }],
    });
  });

  it("marks a book with no queue position as not in the reading queue", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [{ id: "part-1", partNumber: 1, queuePosition: null }],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.books[0]?.isInReadingQueue).toBe(false);
  });

  it("dedupes the series publishers by id and sorts them by name", async () => {
    const repository = {
      findOwnedDetailsById: vi.fn().mockResolvedValue(
        detailedSeries({
          books: [
            { id: "part-1", partNumber: 1, publisher: { id: "pub-vivat", name: "Vivat" } },
            { id: "part-2", partNumber: 2, publisher: { id: "pub-abab", name: "A-BA-BA-HA" } },
            { id: "part-3", partNumber: 3, publisher: { id: "pub-vivat", name: "Vivat" } },
            { id: "part-4", partNumber: 4, publisher: null },
          ],
          id: SERIES_ID,
        }),
      ),
    };
    const { service } = makeService({ repository });

    const details = await service.getById(USER_ID, SERIES_ID);

    expect(details.publishers).toEqual([
      { id: "pub-abab", name: "A-BA-BA-HA" },
      { id: "pub-vivat", name: "Vivat" },
    ]);
  });
});
