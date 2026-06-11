import { describe, expect, it, vi } from "vitest";

import type { AuthorModel } from "../../../generated/prisma/models.js";
import type { AuthorsRepository } from "../infrastructure/authors.repository.js";
import type { OpenLibraryClient } from "../infrastructure/open-library.client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthorsService } from "./authors.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const GLOBAL_ID = "33333333-3333-4333-8333-333333333333";

function author(overrides: Partial<AuthorModel> = {}): AuthorModel {
  return {
    bio: null,
    birthYear: null,
    countryCode: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    deathYear: null,
    id: AUTHOR_ID,
    name: "Frank Herbert",
    normalizedName: "frank herbert",
    openLibraryKey: null,
    photoUrl: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    wikidataId: null,
    ...overrides,
  };
}

function buildService(overrides: {
  create?: AuthorModel | Error;
  findByNormalized?: AuthorModel | null;
  findByNormalizedRetry?: AuthorModel | null;
  findVisibleById?: AuthorModel | null;
  searchVisible?: AuthorModel[];
}): {
  repository: {
    countVisible: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findVisibleById: ReturnType<typeof vi.fn>;
    searchVisible: ReturnType<typeof vi.fn>;
  };
  service: AuthorsService;
} {
  const create = vi.fn();
  if (overrides.create instanceof Error) {
    create.mockRejectedValue(overrides.create);
  } else {
    create.mockResolvedValue(overrides.create ?? author());
  }

  const findByNormalized = vi.fn().mockResolvedValue(overrides.findByNormalized ?? null);
  if (overrides.findByNormalizedRetry !== undefined) {
    findByNormalized
      .mockResolvedValueOnce(overrides.findByNormalized ?? null)
      .mockResolvedValueOnce(overrides.findByNormalizedRetry);
  }

  const searchVisible = overrides.searchVisible ?? [];
  const repository = {
    countVisible: vi.fn().mockResolvedValue(searchVisible.length),
    create,
    findByNormalized,
    findVisibleById: vi.fn().mockResolvedValue(overrides.findVisibleById ?? null),
    searchVisible: vi.fn().mockResolvedValue(searchVisible),
  };

  const openLibraryClient = {
    searchAuthors: vi.fn().mockResolvedValue([]),
  };

  const service = new AuthorsService(
    repository as unknown as AuthorsRepository,
    openLibraryClient as unknown as OpenLibraryClient,
  );

  return { repository, service };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

describe("AuthorsService.resolveOrCreate by id", () => {
  it("returns the id when an existing visible author is found", async () => {
    const { service } = buildService({ findVisibleById: author({ id: AUTHOR_ID }) });

    const id = await service.resolveOrCreate(USER_ID, { id: AUTHOR_ID });

    expect(id).toBe(AUTHOR_ID);
  });

  it("throws NotFoundError when the id is not visible to the user", async () => {
    const { service } = buildService({ findVisibleById: null });

    await expect(service.resolveOrCreate(USER_ID, { id: AUTHOR_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("does not create a new author when resolving by id", async () => {
    const { repository, service } = buildService({ findVisibleById: author() });

    await service.resolveOrCreate(USER_ID, { id: AUTHOR_ID });

    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("AuthorsService.resolveOrCreate by name", () => {
  it("reuses the matching author and does not create a new one", async () => {
    const { repository, service } = buildService({
      findByNormalized: author({ id: GLOBAL_ID }),
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Frank Herbert" });

    expect(id).toBe(GLOBAL_ID);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("matches an existing author case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({
      findByNormalized: author({ id: GLOBAL_ID }),
    });

    await service.resolveOrCreate(USER_ID, { name: "  FRANK   herbert  " });

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "frank herbert");
  });

  it("creates a custom author with the user id when no match exists", async () => {
    const created = author({ id: AUTHOR_ID, userId: USER_ID });
    const { repository, service } = buildService({ create: created, findByNormalized: null });

    const id = await service.resolveOrCreate(USER_ID, { name: "Frank Herbert" });

    expect(id).toBe(AUTHOR_ID);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, "Frank Herbert", "frank herbert");
  });

  it("resolves to the row a concurrent insert created when create hits a unique violation", async () => {
    const winner = author({ id: GLOBAL_ID, userId: USER_ID });
    const { repository, service } = buildService({
      create: uniqueConstraintError(),
      findByNormalized: null,
      findByNormalizedRetry: winner,
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Frank Herbert" });

    expect(id).toBe(GLOBAL_ID);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { service } = buildService({
      create: new Error("connection lost"),
      findByNormalized: null,
    });

    await expect(service.resolveOrCreate(USER_ID, { name: "Frank Herbert" })).rejects.toThrow(
      "connection lost",
    );
  });

  it("throws NotFoundError when neither id nor name is provided", async () => {
    const { service } = buildService({});

    await expect(service.resolveOrCreate(USER_ID, {})).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("AuthorsService.search", () => {
  it("returns a paginator whose items mark user rows custom and global rows not custom", async () => {
    const { service } = buildService({
      searchVisible: [
        author({ id: AUTHOR_ID, name: "My Author", userId: USER_ID }),
        author({ id: GLOBAL_ID, name: "George Orwell", userId: null }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sortDirection: "desc",
    });

    expect(page.totalCount).toBe(2);
    expect(page.items).toEqual([
      expect.objectContaining({
        id: AUTHOR_ID,
        isCustom: true,
        name: "My Author",
      }),
      expect.objectContaining({
        id: GLOBAL_ID,
        isCustom: false,
        name: "George Orwell",
      }),
    ]);
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchVisible: [] });

    await service.search(USER_ID, {
      pageNumber: 3,
      pageSize: 20,
      search: "orwell",
      sortDirection: "desc",
    });

    expect(repository.searchVisible).toHaveBeenCalledWith({
      query: "orwell",
      skip: 40,
      take: 20,
      userId: USER_ID,
    });
    expect(repository.countVisible).toHaveBeenCalledWith(USER_ID, "orwell");
  });
});
