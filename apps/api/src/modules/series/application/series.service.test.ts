import { describe, expect, it, vi } from "vitest";

import type { SeriesModel } from "../../../generated/prisma/models.js";
import type {
  SeriesRepository,
  SeriesWithBookCount,
  SeriesWithDetails,
} from "../infrastructure/series.repository.js";

import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { SeriesService } from "./series.service.js";

type BookRowInput = {
  createdAt?: Date;
  id?: string;
  partNumber?: null | number;
  readingStatus?: string;
  title?: string;
  updatedAt?: Date;
};

type DetailBookInput = {
  authors?: { id: string; name: string }[];
  createdAt?: Date;
  id: string;
  isFavorite?: boolean;
  originalTitle?: null | string;
  ownershipStatus?: string;
  pagesCount?: null | number;
  partNumber: null | number;
  rating?: null | number;
  readingStatus?: string;
  title?: string;
  updatedAt?: Date;
};

type RepoMock = Partial<Record<keyof SeriesRepository, ReturnType<typeof vi.fn>>>;

function bookRow(overrides: BookRowInput = {}): SeriesWithBookCount["books"][number] {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    id: "book-1",
    partNumber: 1,
    readingStatus: "not_started",
    title: "Book",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  };
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
      authors: (book.authors ?? []).map((author, index) => ({
        author: { id: author.id, name: author.name },
        position: index,
      })),
      createdAt: book.createdAt ?? new Date("2026-02-01T10:00:00.000Z"),
      id: book.id,
      isFavorite: book.isFavorite ?? false,
      originalTitle: book.originalTitle ?? null,
      ownershipStatus: book.ownershipStatus ?? "none",
      pagesCount: book.pagesCount ?? null,
      partNumber: book.partNumber,
      readingProgress:
        book.rating === undefined ? null : { currentPage: null, rating: book.rating },
      readingStatus: book.readingStatus ?? "not_started",
      title: book.title ?? "Book",
      updatedAt: book.updatedAt ?? new Date("2026-02-01T10:00:00.000Z"),
    })),
  } as unknown as SeriesWithDetails;
}

function makeService(options: {
  repository: RepoMock;
  resolveReferences?: ReturnType<typeof vi.fn>;
}): {
  authorsService: { resolveReferences: ReturnType<typeof vi.fn> };
  service: SeriesService;
} {
  const resolveReferences = options.resolveReferences ?? vi.fn().mockResolvedValue([]);
  const authorsService = { resolveReferences };
  const service = new SeriesService(
    options.repository as unknown as SeriesRepository,
    authorsService as unknown as AuthorsService,
  );
  return { authorsService, service };
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

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SERIES_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function buildService(overrides: {
  create?: Error | SeriesModel;
  findByNormalized?: null | SeriesModel;
  findByNormalizedRetry?: null | SeriesModel;
  findOwnedById?: null | SeriesModel;
  searchOwned?: SeriesWithBookCount[];
}): {
  authorsService: {
    resolveReferences: ReturnType<typeof vi.fn>;
  };
  repository: {
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    searchOwned: ReturnType<typeof vi.fn>;
  };
  service: SeriesService;
} {
  const create = vi.fn();
  if (overrides.create instanceof Error) {
    create.mockRejectedValue(overrides.create);
  } else {
    create.mockResolvedValue(overrides.create ?? series());
  }

  const findByNormalized = vi.fn().mockResolvedValue(overrides.findByNormalized ?? null);
  if (overrides.findByNormalizedRetry !== undefined) {
    findByNormalized
      .mockResolvedValueOnce(overrides.findByNormalized ?? null)
      .mockResolvedValueOnce(overrides.findByNormalizedRetry);
  }

  const searchOwned = overrides.searchOwned ?? [];
  const repository = {
    countOwned: vi.fn().mockResolvedValue(searchOwned.length),
    create,
    findByNormalized,
    findOwnedById: vi.fn().mockResolvedValue(overrides.findOwnedById ?? null),
    searchOwned: vi.fn().mockResolvedValue(searchOwned),
  };

  const authorsService = {
    resolveReferences: vi.fn().mockResolvedValue([]),
  };

  const service = new SeriesService(
    repository as unknown as SeriesRepository,
    authorsService as unknown as AuthorsService,
  );

  return { authorsService, repository, service };
}

function series(overrides: Partial<SeriesModel> = {}): SeriesModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    description: null,
    id: SERIES_ID,
    name: "Throne of Glass",
    normalizedName: "throne of glass",
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
    books: Array.from({ length: finishedInSeries }, (unused, index) => ({
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      id: `b-${index}`,
      partNumber: index + 1,
      readingStatus: "finished",
      title: `Book ${index}`,
      updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    })),
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

    const resolved = await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID });

    expect(resolved.id).toBe(SERIES_ID);
  });

  it("returns the total books when an owned series is found", async () => {
    const { service } = buildService({ findOwnedById: series({ id: SERIES_ID, totalBooks: 3 }) });

    const resolved = await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID });

    expect(resolved.totalBooks).toBe(3);
  });

  it("throws NotFoundError when the id is not owned by the user", async () => {
    const { service } = buildService({ findOwnedById: null });

    await expect(
      service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not create a new series when resolving by id", async () => {
    const { repository, service } = buildService({ findOwnedById: series() });

    await service.resolveForBook({ seriesId: SERIES_ID, userId: USER_ID });

    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SeriesService.resolveForBook by newSeries", () => {
  it("reuses the matching series and ignores the extra fields", async () => {
    const { repository, service } = buildService({
      findByNormalized: series({ id: OTHER_ID }),
    });

    const resolved = await service.resolveForBook({
      newSeries: { name: "Throne of Glass", status: "completed", totalBooks: 8 },
      userId: USER_ID,
    });

    expect(resolved.id).toBe(OTHER_ID);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("matches an existing series case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({ findByNormalized: series({ id: OTHER_ID }) });

    await service.resolveForBook({
      newSeries: { name: "  Throne   OF Glass ", status: "unknown" },
      userId: USER_ID,
    });

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "throne of glass");
  });

  it("creates a series with the provided fields when no match exists", async () => {
    const created = series({ id: SERIES_ID });
    const { repository, service } = buildService({ create: created, findByNormalized: null });

    const resolved = await service.resolveForBook({
      newSeries: { description: "saga", name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
      userId: USER_ID,
    });

    expect(resolved.id).toBe(SERIES_ID);
    expect(repository.create).toHaveBeenCalledWith({
      authorIds: [],
      data: {
        description: "saga",
        name: "Throne of Glass",
        normalizedName: "throne of glass",
        status: "ongoing",
        totalBooks: 3,
      },
      userId: USER_ID,
    });
  });

  it("resolves to the row a concurrent insert created on a unique violation", async () => {
    const winner = series({ id: OTHER_ID });
    const { repository, service } = buildService({
      create: uniqueConstraintError(),
      findByNormalized: null,
      findByNormalizedRetry: winner,
    });

    const resolved = await service.resolveForBook({
      newSeries: { name: "Throne of Glass", status: "unknown" },
      userId: USER_ID,
    });

    expect(resolved.id).toBe(OTHER_ID);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { service } = buildService({
      create: new Error("connection lost"),
      findByNormalized: null,
    });

    await expect(
      service.resolveForBook({
        newSeries: { name: "Throne of Glass", status: "unknown" },
        userId: USER_ID,
      }),
    ).rejects.toThrow("connection lost");
  });

  it("throws NotFoundError when neither id nor newSeries is provided", async () => {
    const { service } = buildService({});

    await expect(service.resolveForBook({ userId: USER_ID })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SeriesService.resolveForBook author linking", () => {
  const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("links the resolved newSeries authors to the created series in resolver order", async () => {
    const { authorsService, repository, service } = buildService({
      create: series({ id: SERIES_ID }),
      findByNormalized: null,
    });
    authorsService.resolveReferences.mockResolvedValue([
      { id: AUTHOR_A, name: "Sarah J. Maas" },
      { id: AUTHOR_B, name: "Leigh Bardugo" },
    ]);

    await service.resolveForBook({
      newSeries: {
        authors: [{ id: AUTHOR_A }, { id: AUTHOR_B }],
        name: "Throne of Glass",
        status: "unknown",
      },
      userId: USER_ID,
    });

    expect(authorsService.resolveReferences).toHaveBeenCalledWith({
      references: [{ id: AUTHOR_A }, { id: AUTHOR_B }],
      userId: USER_ID,
    });
    expect(repository.create).toHaveBeenCalledWith({
      authorIds: [AUTHOR_A, AUTHOR_B],
      data: expect.objectContaining({ name: "Throne of Glass", normalizedName: "throne of glass" }),
      userId: USER_ID,
    });
  });

  it("falls back to the book's authors when newSeries omits an authors field", async () => {
    const { authorsService, repository, service } = buildService({
      create: series({ id: SERIES_ID }),
      findByNormalized: null,
    });

    await service.resolveForBook({
      fallbackAuthorIds: [AUTHOR_A, AUTHOR_B],
      newSeries: { name: "Throne of Glass", status: "unknown" },
      userId: USER_ID,
    });

    expect(authorsService.resolveReferences).toHaveBeenCalledWith({
      references: [],
      userId: USER_ID,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: [AUTHOR_A, AUTHOR_B] }),
    );
  });

  it("prefers explicit newSeries authors over the book's fallback authors", async () => {
    const { authorsService, repository, service } = buildService({
      create: series({ id: SERIES_ID }),
      findByNormalized: null,
    });
    authorsService.resolveReferences.mockResolvedValue([{ id: AUTHOR_A, name: "Sarah J. Maas" }]);

    await service.resolveForBook({
      fallbackAuthorIds: [AUTHOR_B],
      newSeries: { authors: [{ id: AUTHOR_A }], name: "Throne of Glass", status: "unknown" },
      userId: USER_ID,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: [AUTHOR_A] }),
    );
  });

  it("does not link any authors when resolving an existing series by id", async () => {
    const { repository, service } = buildService({ findOwnedById: series() });

    await service.resolveForBook({
      fallbackAuthorIds: [AUTHOR_A],
      seriesId: SERIES_ID,
      userId: USER_ID,
    });

    expect(repository.create).not.toHaveBeenCalled();
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
    });

    expect(page).toEqual({
      items: [
        {
          authors: [],
          booksInSeries: 2,
          createdAt: "2026-02-01T10:00:00.000Z",
          description: "saga",
          finishedInSeries: 0,
          id: SERIES_ID,
          lastActivityAt: "2026-02-02T11:00:00.000Z",
          name: "Throne of Glass",
          nextBook: null,
          readingInSeries: 0,
          status: "ongoing",
          totalBooks: 3,
        },
      ],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 1,
    });
  });

  it("maps the live linked-book count onto booksInSeries", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(4)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
    });

    expect(page.items).toEqual([expect.objectContaining({ booksInSeries: 4 })]);
  });

  it("maps the loaded finished-book count onto finishedInSeries", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(4, {}, 2)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
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
    });

    expect(repository.searchOwned).toHaveBeenCalledWith({
      authorIds: undefined,
      query: "throne",
      skip: 40,
      take: 20,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith({
      authorIds: undefined,
      query: "throne",
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
    });

    expect(repository.searchOwned).toHaveBeenCalledWith(expect.objectContaining({ authorIds }));
    expect(repository.countOwned).toHaveBeenCalledWith(expect.objectContaining({ authorIds }));
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
      name: "Throne OF Glass",
      status: "ongoing",
      totalBooks: 5,
    });

    expect(repository.create).toHaveBeenCalledWith({
      authorIds: [],
      data: {
        description: "saga",
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

    await service.create(USER_ID, { name: "Throne of Glass", status: "unknown" });

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
      service.create(USER_ID, { name: "Throne of Glass", status: "unknown" }),
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
      service.create(USER_ID, { name: "Throne of Glass", status: "unknown" }),
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
      fullyReadSeries: 1,
      totalSeries: 3,
      unfinishedSeries: 1,
    });
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
      averageRating: 8,
      booksCount: 2,
      finishedCount: 1,
      pagesCount: 500,
      readingCount: 1,
      unreadCount: 0,
    });
  });
});
