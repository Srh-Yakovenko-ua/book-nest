import { describe, expect, it, vi } from "vitest";

import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { PublishersRepository } from "../infrastructure/publishers.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { PublishersService } from "./publishers.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHER_ID = "22222222-2222-4222-8222-222222222222";
const GLOBAL_ID = "33333333-3333-4333-8333-333333333333";

function buildService(overrides: {
  create?: Error | PublisherModel;
  findByNormalized?: null | PublisherModel;
  findByNormalizedRetry?: null | PublisherModel;
  findVisibleById?: null | PublisherModel;
  searchVisible?: PublisherModel[];
}): {
  repository: {
    countVisible: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findVisibleById: ReturnType<typeof vi.fn>;
    searchVisible: ReturnType<typeof vi.fn>;
  };
  service: PublishersService;
} {
  const create = vi.fn();
  if (overrides.create instanceof Error) {
    create.mockRejectedValue(overrides.create);
  } else {
    create.mockResolvedValue(overrides.create ?? publisher());
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

  const service = new PublishersService(repository as unknown as PublishersRepository);

  return { repository, service };
}

function publisher(overrides: Partial<PublisherModel> = {}): PublisherModel {
  return {
    countryCode: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    foundedYear: null,
    id: PUBLISHER_ID,
    logoAttribution: null,
    logoLicense: null,
    logoLicenseUrl: null,
    logoUrl: null,
    name: "Penguin",
    normalizedName: "penguin",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    websiteUrl: null,
    wikidataId: null,
    ...overrides,
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

describe("PublishersService.resolveOrCreate by id", () => {
  it("returns the id when an existing visible publisher is found", async () => {
    const { service } = buildService({ findVisibleById: publisher({ id: PUBLISHER_ID }) });

    const id = await service.resolveOrCreate(USER_ID, { id: PUBLISHER_ID });

    expect(id).toBe(PUBLISHER_ID);
  });

  it("throws NotFoundError when the id is not visible to the user", async () => {
    const { service } = buildService({ findVisibleById: null });

    await expect(service.resolveOrCreate(USER_ID, { id: PUBLISHER_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("PublishersService.resolveOrCreate by name", () => {
  it("reuses the matching publisher and does not create a new one", async () => {
    const { repository, service } = buildService({
      findByNormalized: publisher({ id: GLOBAL_ID }),
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Penguin" });

    expect(id).toBe(GLOBAL_ID);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("matches an existing publisher case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({
      findByNormalized: publisher({ id: GLOBAL_ID }),
    });

    await service.resolveOrCreate(USER_ID, { name: "  PENGUIN   Books  " });

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "penguin books");
  });

  it("creates a custom publisher with the user id when no match exists", async () => {
    const created = publisher({ id: PUBLISHER_ID, userId: USER_ID });
    const { repository, service } = buildService({ create: created, findByNormalized: null });

    const id = await service.resolveOrCreate(USER_ID, { name: "Penguin" });

    expect(id).toBe(PUBLISHER_ID);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, "Penguin", "penguin");
  });

  it("resolves to the row a concurrent insert created when create hits a unique violation", async () => {
    const winner = publisher({ id: GLOBAL_ID, userId: USER_ID });
    const { repository, service } = buildService({
      create: uniqueConstraintError(),
      findByNormalized: null,
      findByNormalizedRetry: winner,
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Penguin" });

    expect(id).toBe(GLOBAL_ID);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { service } = buildService({
      create: new Error("connection lost"),
      findByNormalized: null,
    });

    await expect(service.resolveOrCreate(USER_ID, { name: "Penguin" })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("PublishersService.resolveOrCreate without input", () => {
  it("returns null when neither id nor name is provided", async () => {
    const { repository, service } = buildService({});

    const id = await service.resolveOrCreate(USER_ID, {});

    expect(id).toBeNull();
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("PublishersService.search", () => {
  it("returns a paginator whose items mark user rows custom and global rows not custom", async () => {
    const { service } = buildService({
      searchVisible: [
        publisher({ id: PUBLISHER_ID, name: "My Press", userId: USER_ID }),
        publisher({ id: GLOBAL_ID, name: "Vintage", userId: null }),
      ],
    });

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: undefined,
      sortDirection: "desc",
    });

    expect(page).toEqual({
      items: [
        {
          countryCode: null,
          foundedYear: null,
          id: PUBLISHER_ID,
          isCustom: true,
          logoAttribution: null,
          logoLicense: null,
          logoLicenseUrl: null,
          logoUrl: null,
          name: "My Press",
          websiteUrl: null,
        },
        {
          countryCode: null,
          foundedYear: null,
          id: GLOBAL_ID,
          isCustom: false,
          logoAttribution: null,
          logoLicense: null,
          logoLicenseUrl: null,
          logoUrl: null,
          name: "Vintage",
          websiteUrl: null,
        },
      ],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 2,
    });
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchVisible: [] });

    await service.search(USER_ID, {
      pageNumber: 2,
      pageSize: 15,
      search: "penguin",
      sortDirection: "desc",
    });

    expect(repository.searchVisible).toHaveBeenCalledWith({
      query: "penguin",
      skip: 15,
      take: 15,
      userId: USER_ID,
    });
    expect(repository.countVisible).toHaveBeenCalledWith(USER_ID, "penguin");
  });
});
