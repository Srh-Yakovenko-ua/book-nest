import { describe, expect, it, vi } from "vitest";

import type { AuthorModel } from "../../../generated/prisma/models.js";
import type {
  AuthorsRepository,
  AuthorWithPrimaryNames,
} from "../infrastructure/authors.repository.js";
import type {
  OpenLibraryAuthorDetail,
  OpenLibraryClient,
} from "../infrastructure/open-library.client.js";
import type { WikidataAuthorFacts, WikidataClient } from "../infrastructure/wikidata.client.js";

import { HttpError, NotFoundError } from "../../../core/exceptions/errors.js";
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
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: null,
    searchText: "frank herbert",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    wikidataId: null,
    ...overrides,
  };
}

function authorWithNames(overrides: Partial<AuthorWithPrimaryNames> = {}): AuthorWithPrimaryNames {
  const base = author(overrides);
  return {
    ...base,
    names: overrides.names ?? [
      {
        authorId: base.id,
        id: `${base.id}-name`,
        isPrimary: true,
        locale: "uk",
        name: base.name,
        normalizedName: base.normalizedName,
      },
    ],
  };
}

function buildService(overrides: {
  create?: AuthorWithPrimaryNames | Error;
  findByNormalized?: AuthorModel | null;
  findByNormalizedRetry?: AuthorModel | null;
  findVisibleById?: AuthorModel | null;
  searchVisible?: AuthorWithPrimaryNames[];
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
    create.mockResolvedValue(overrides.create ?? authorWithNames());
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

  const wikidataClient = {
    getAuthorFactsByQid: vi.fn().mockResolvedValue(null),
  };

  const service = new AuthorsService(
    repository as unknown as AuthorsRepository,
    openLibraryClient as unknown as OpenLibraryClient,
    wikidataClient as unknown as WikidataClient,
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
    const created = authorWithNames({ id: AUTHOR_ID, userId: USER_ID });
    const { repository, service } = buildService({ create: created, findByNormalized: null });

    const id = await service.resolveOrCreate(USER_ID, { name: "Frank Herbert" });

    expect(id).toBe(AUTHOR_ID);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, {
      locale: "uk",
      name: "Frank Herbert",
      normalizedName: "frank herbert",
    });
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
        authorWithNames({ id: AUTHOR_ID, name: "My Author", userId: USER_ID }),
        authorWithNames({ id: GLOBAL_ID, name: "George Orwell", userId: null }),
      ],
    });

    const page = await service.search(USER_ID, {
      locale: "uk",
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
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

  it("resolves the display name to the requested locale and falls back to the canonical name", async () => {
    const { service } = buildService({
      searchVisible: [
        authorWithNames({
          id: GLOBAL_ID,
          name: "Taras Shevchenko",
          names: [
            {
              authorId: GLOBAL_ID,
              id: "name-en",
              isPrimary: true,
              locale: "en",
              name: "Taras Shevchenko",
              normalizedName: "taras shevchenko",
            },
            {
              authorId: GLOBAL_ID,
              id: "name-uk",
              isPrimary: true,
              locale: "uk",
              name: "Тарас Шевченко",
              normalizedName: "тарас шевченко",
            },
          ],
          userId: null,
        }),
      ],
    });

    const ukrainian = await service.search(USER_ID, {
      locale: "uk",
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
    });
    const english = await service.search(USER_ID, {
      locale: "en",
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
    });

    expect(ukrainian.items[0]?.name).toBe("Тарас Шевченко");
    expect(english.items[0]?.name).toBe("Taras Shevchenko");
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchVisible: [] });

    await service.search(USER_ID, {
      locale: "uk",
      pageNumber: 3,
      pageSize: 20,
      search: "orwell",
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

const OPEN_LIBRARY_KEY = "OL23919A";

function authorDetail(overrides: Partial<OpenLibraryAuthorDetail> = {}): OpenLibraryAuthorDetail {
  return {
    bio: "An English novelist.",
    birthYear: 1903,
    name: "George Orwell",
    photoUrl: "https://covers.openlibrary.org/a/id/12345-L.jpg",
    wikidataId: "Q3335",
    ...overrides,
  };
}

function buildMaterializeService(overrides: {
  createGlobal?: AuthorModel | Error;
  detail?: null | OpenLibraryAuthorDetail;
  facts?: null | WikidataAuthorFacts;
  findGlobal?: AuthorModel | null;
  findGlobalByNormalizedName?: AuthorModel | null;
  findGlobalByWikidataId?: AuthorModel | null;
  findGlobalRetry?: AuthorModel | null;
}): {
  createGlobal: ReturnType<typeof vi.fn>;
  findGlobalByNormalizedName: ReturnType<typeof vi.fn>;
  findGlobalByWikidataId: ReturnType<typeof vi.fn>;
  getAuthorByKey: ReturnType<typeof vi.fn>;
  getAuthorFactsByQid: ReturnType<typeof vi.fn>;
  service: AuthorsService;
} {
  const findGlobalByOpenLibraryKey = vi.fn().mockResolvedValue(overrides.findGlobal ?? null);
  if (overrides.findGlobalRetry !== undefined) {
    findGlobalByOpenLibraryKey
      .mockResolvedValueOnce(overrides.findGlobal ?? null)
      .mockResolvedValueOnce(overrides.findGlobalRetry);
  }

  const findGlobalByWikidataId = vi
    .fn()
    .mockResolvedValue(overrides.findGlobalByWikidataId ?? null);
  const findGlobalByNormalizedName = vi
    .fn()
    .mockResolvedValue(overrides.findGlobalByNormalizedName ?? null);

  const createGlobal = vi.fn();
  if (overrides.createGlobal instanceof Error) {
    createGlobal.mockRejectedValue(overrides.createGlobal);
  } else {
    createGlobal.mockResolvedValue(overrides.createGlobal ?? author({ userId: null }));
  }

  const getAuthorByKey = vi
    .fn()
    .mockResolvedValue(overrides.detail === undefined ? authorDetail() : overrides.detail);
  const getAuthorFactsByQid = vi.fn().mockResolvedValue(overrides.facts ?? null);

  const repository = {
    createGlobal,
    findGlobalByNormalizedName,
    findGlobalByOpenLibraryKey,
    findGlobalByWikidataId,
  } as unknown as AuthorsRepository;
  const openLibraryClient = { getAuthorByKey } as unknown as OpenLibraryClient;
  const wikidataClient = { getAuthorFactsByQid } as unknown as WikidataClient;

  const service = new AuthorsService(repository, openLibraryClient, wikidataClient);

  return {
    createGlobal,
    findGlobalByNormalizedName,
    findGlobalByWikidataId,
    getAuthorByKey,
    getAuthorFactsByQid,
    service,
  };
}

describe("AuthorsService.materializeFromOpenLibrary", () => {
  it("returns the existing global author without fetching when the key is already stored", async () => {
    const existing = author({ id: GLOBAL_ID, openLibraryKey: OPEN_LIBRARY_KEY, userId: null });
    const { getAuthorByKey, service } = buildMaterializeService({ findGlobal: existing });

    const result = await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(result.id).toBe(GLOBAL_ID);
    expect(getAuthorByKey).not.toHaveBeenCalled();
  });

  it("creates a global author enriched with wikidata country and years", async () => {
    const { createGlobal, service } = buildMaterializeService({
      detail: authorDetail({ birthYear: null }),
      facts: { birthYear: 1903, countryCode: "GB", deathYear: 1950 },
    });

    await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(createGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        birthYear: 1903,
        countryCode: "GB",
        deathYear: 1950,
        name: "George Orwell",
        normalizedName: "george orwell",
        openLibraryKey: OPEN_LIBRARY_KEY,
        searchText: "george orwell",
        wikidataId: "Q3335",
      }),
      [{ isPrimary: true, locale: "en", name: "George Orwell", normalizedName: "george orwell" }],
    );
  });

  it("prefers the open library birth year over the wikidata one when both are present", async () => {
    const { createGlobal, service } = buildMaterializeService({
      detail: authorDetail({ birthYear: 1903 }),
      facts: { birthYear: 1900, countryCode: "GB", deathYear: 1950 },
    });

    await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(createGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ birthYear: 1903 }),
      expect.any(Array),
    );
  });

  it("creates the global author with null country and years when wikidata returns nothing", async () => {
    const { createGlobal, service } = buildMaterializeService({
      detail: authorDetail({ birthYear: null }),
      facts: null,
    });

    await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(createGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ birthYear: null, countryCode: null, deathYear: null }),
      expect.any(Array),
    );
  });

  it("does not query wikidata when the open library author has no wikidata id", async () => {
    const { getAuthorFactsByQid, service } = buildMaterializeService({
      detail: authorDetail({ wikidataId: null }),
    });

    await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(getAuthorFactsByQid).not.toHaveBeenCalled();
  });

  it("throws a 502 open_library_unavailable error when open library returns null", async () => {
    const { service } = buildMaterializeService({ detail: null });

    await expect(service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY)).rejects.toMatchObject({
      code: "open_library_unavailable",
      status: 502,
    });
  });

  it("throws an HttpError when open library returns null", async () => {
    const { service } = buildMaterializeService({ detail: null });

    await expect(service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY)).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("resolves to the winning row when createGlobal hits a concurrent unique violation", async () => {
    const winner = author({ id: GLOBAL_ID, openLibraryKey: OPEN_LIBRARY_KEY, userId: null });
    const { service } = buildMaterializeService({
      createGlobal: uniqueConstraintError(),
      findGlobalRetry: winner,
    });

    const result = await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(result.id).toBe(GLOBAL_ID);
  });

  it("rethrows non-unique errors from createGlobal", async () => {
    const { service } = buildMaterializeService({ createGlobal: new Error("connection lost") });

    await expect(service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY)).rejects.toThrow(
      "connection lost",
    );
  });

  it("reuses the global author sharing a wikidata id under a different open library key", async () => {
    const existing = author({ id: GLOBAL_ID, openLibraryKey: "OL999A", userId: null });
    const { createGlobal, service } = buildMaterializeService({
      detail: authorDetail({ wikidataId: "Q3335" }),
      findGlobalByWikidataId: existing,
    });

    const result = await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(result.id).toBe(GLOBAL_ID);
    expect(createGlobal).not.toHaveBeenCalled();
  });

  it("recovers by wikidata id when createGlobal hits a unique violation on wikidata", async () => {
    const winner = author({ id: GLOBAL_ID, openLibraryKey: "OL999A", userId: null });
    const { service } = buildMaterializeService({
      createGlobal: uniqueConstraintError(),
      detail: authorDetail({ wikidataId: "Q3335" }),
      findGlobalByWikidataId: winner,
    });

    const result = await service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY);

    expect(result.id).toBe(GLOBAL_ID);
  });

  it("rethrows the unique violation when no existing global author can be found", async () => {
    const { service } = buildMaterializeService({
      createGlobal: uniqueConstraintError(),
      detail: authorDetail({ wikidataId: "Q3335" }),
    });

    await expect(service.materializeFromOpenLibrary(OPEN_LIBRARY_KEY)).rejects.toThrow(
      "Unique constraint failed",
    );
  });
});
