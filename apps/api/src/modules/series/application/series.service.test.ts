import { describe, expect, it, vi } from "vitest";

import type { SeriesModel } from "../../../generated/prisma/models.js";
import type { SeriesRepository, SeriesWithBookCount } from "../infrastructure/series.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
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

  const service = new SeriesService(repository as unknown as SeriesRepository);

  return { repository, service };
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
): SeriesWithBookCount {
  return { ...series(overrides), _count: { books: booksInSeries } };
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

    const id = await service.resolveForBook(USER_ID, { seriesId: SERIES_ID });

    expect(id).toBe(SERIES_ID);
  });

  it("throws NotFoundError when the id is not owned by the user", async () => {
    const { service } = buildService({ findOwnedById: null });

    await expect(service.resolveForBook(USER_ID, { seriesId: SERIES_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("does not create a new series when resolving by id", async () => {
    const { repository, service } = buildService({ findOwnedById: series() });

    await service.resolveForBook(USER_ID, { seriesId: SERIES_ID });

    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SeriesService.resolveForBook by newSeries", () => {
  it("reuses the matching series and ignores the extra fields", async () => {
    const { repository, service } = buildService({
      findByNormalized: series({ id: OTHER_ID }),
    });

    const id = await service.resolveForBook(USER_ID, {
      newSeries: { name: "Throne of Glass", status: "completed", totalBooks: 8 },
    });

    expect(id).toBe(OTHER_ID);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("matches an existing series case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({ findByNormalized: series({ id: OTHER_ID }) });

    await service.resolveForBook(USER_ID, {
      newSeries: { name: "  Throne   OF Glass ", status: "unknown" },
    });

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "throne of glass");
  });

  it("creates a series with the provided fields when no match exists", async () => {
    const created = series({ id: SERIES_ID });
    const { repository, service } = buildService({ create: created, findByNormalized: null });

    const id = await service.resolveForBook(USER_ID, {
      newSeries: { description: "saga", name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
    });

    expect(id).toBe(SERIES_ID);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, {
      description: "saga",
      name: "Throne of Glass",
      normalizedName: "throne of glass",
      status: "ongoing",
      totalBooks: 3,
    });
  });

  it("resolves to the row a concurrent insert created on a unique violation", async () => {
    const winner = series({ id: OTHER_ID });
    const { repository, service } = buildService({
      create: uniqueConstraintError(),
      findByNormalized: null,
      findByNormalizedRetry: winner,
    });

    const id = await service.resolveForBook(USER_ID, {
      newSeries: { name: "Throne of Glass", status: "unknown" },
    });

    expect(id).toBe(OTHER_ID);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { service } = buildService({
      create: new Error("connection lost"),
      findByNormalized: null,
    });

    await expect(
      service.resolveForBook(USER_ID, {
        newSeries: { name: "Throne of Glass", status: "unknown" },
      }),
    ).rejects.toThrow("connection lost");
  });

  it("throws NotFoundError when neither id nor newSeries is provided", async () => {
    const { service } = buildService({});

    await expect(service.resolveForBook(USER_ID, {})).rejects.toBeInstanceOf(NotFoundError);
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
          booksInSeries: 2,
          description: "saga",
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

  it("maps a series with no linked books to a zero count", async () => {
    const { service } = buildService({ searchOwned: [seriesWithCount(0)] });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
    });

    expect(page.items).toEqual([expect.objectContaining({ booksInSeries: 0 })]);
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchOwned: [] });

    await service.search(USER_ID, {
      pageNumber: 3,
      pageSize: 20,
      search: "throne",
    });

    expect(repository.searchOwned).toHaveBeenCalledWith({
      query: "throne",
      skip: 40,
      take: 20,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith(USER_ID, "throne");
  });
});
