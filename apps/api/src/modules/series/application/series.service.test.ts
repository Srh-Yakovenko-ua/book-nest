import { describe, expect, it, vi } from "vitest";

import type { SeriesModel } from "../../../generated/prisma/models.js";
import type { SeriesRepository, SeriesWithBookCount } from "../infrastructure/series.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { SeriesService } from "./series.service.js";

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
    books: Array.from({ length: finishedInSeries }, (unused, index) => ({ id: `b-${index}` })),
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
          description: "saga",
          finishedInSeries: 0,
          id: SERIES_ID,
          name: "Throne of Glass",
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
