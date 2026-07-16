import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { TagModel } from "../../../generated/prisma/models.js";
import type { TagsRepository } from "../infrastructure/tags.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { TagsService } from "./tags.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TAG_ID = "33333333-3333-4333-8333-333333333333";

const FAKE_TX = {} as Prisma.TransactionClient;

function buildService(): {
  repository: {
    acquireCreateLock: ReturnType<typeof vi.fn>;
    countBooksByTag: ReturnType<typeof vi.fn>;
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteOwned: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findByNormalizedExcluding: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    listOwned: ReturnType<typeof vi.fn>;
    searchOwned: ReturnType<typeof vi.fn>;
    touchLastUsed: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsertByNormalized: ReturnType<typeof vi.fn>;
  };
  service: TagsService;
} {
  const repository = {
    acquireCreateLock: vi.fn().mockResolvedValue(undefined),
    countBooksByTag: vi.fn().mockResolvedValue([]),
    countOwned: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    deleteOwned: vi.fn().mockResolvedValue(0),
    findByNormalized: vi.fn().mockResolvedValue(null),
    findByNormalizedExcluding: vi.fn().mockResolvedValue(null),
    findOwnedById: vi.fn().mockResolvedValue(null),
    listOwned: vi.fn().mockResolvedValue([]),
    searchOwned: vi.fn().mockResolvedValue([]),
    touchLastUsed: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    upsertByNormalized: vi.fn(),
  };

  const transactionRunner = {
    run: vi.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(FAKE_TX)),
  };

  const service = new TagsService(
    repository as unknown as TagsRepository,
    transactionRunner as unknown as TransactionRunner,
  );

  return { repository, service };
}

function tag(overrides: Partial<TagModel> = {}): TagModel {
  return {
    color: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    description: null,
    id: TAG_ID,
    lastUsedAt: null,
    name: "dark academia",
    normalizedName: "dark academia",
    type: "custom",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function uniqueConstraintError(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "7.8.0",
    code: "P2002",
    meta: { target: ["user_id", "normalized_name"] },
  });
}

describe("TagsService.create", () => {
  it("creates a tag and returns the catalog view with the default type", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockResolvedValue(tag({ type: "custom" }));

    const view = await service.create(USER_ID, { name: "Dark Academia", type: "custom" });

    expect(view).toMatchObject({
      color: null,
      description: null,
      id: TAG_ID,
      lastUsedAt: null,
      name: "dark academia",
      normalizedName: "dark academia",
      type: "custom",
    });
    expect(repository.acquireCreateLock).toHaveBeenCalledWith(USER_ID, FAKE_TX);
    expect(repository.create).toHaveBeenCalledWith(
      {
        color: null,
        description: null,
        name: "Dark Academia",
        normalizedName: "dark academia",
        type: "custom",
        userId: USER_ID,
      },
      FAKE_TX,
    );
  });

  it("persists color and description when provided", async () => {
    const { repository, service } = buildService();
    repository.create.mockResolvedValue(
      tag({ color: "#A96E47", description: "moody university vibes", type: "atmosphere" }),
    );

    await service.create(USER_ID, {
      color: "#A96E47",
      description: "moody university vibes",
      name: "dark academia",
      type: "atmosphere",
    });

    expect(repository.create).toHaveBeenCalledWith(
      {
        color: "#A96E47",
        description: "moody university vibes",
        name: "dark academia",
        normalizedName: "dark academia",
        type: "atmosphere",
        userId: USER_ID,
      },
      FAKE_TX,
    );
  });

  it("throws ConflictError when a tag with the same normalized name exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(tag());

    await expect(
      service.create(USER_ID, { name: "Dark Academia", type: "custom" }),
    ).rejects.toThrow(ConflictError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps a unique constraint race to ConflictError", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockRejectedValue(uniqueConstraintError());

    await expect(
      service.create(USER_ID, { name: "Dark Academia", type: "custom" }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("TagsService.update", () => {
  it("throws NotFoundError when the tag is missing or owned by another user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    await expect(service.update(USER_ID, TAG_ID, { name: "renamed" })).rejects.toThrow(
      NotFoundError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("renames and checks duplicates excluding the current tag", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(tag({ normalizedName: "dark academia" }));
    repository.findByNormalizedExcluding.mockResolvedValue(null);
    repository.update.mockResolvedValue(
      tag({ name: "cozy mystery", normalizedName: "cozy mystery" }),
    );

    await service.update(USER_ID, TAG_ID, { name: "Cozy Mystery" });

    expect(repository.findByNormalizedExcluding).toHaveBeenCalledWith(
      { excludeId: TAG_ID, normalizedName: "cozy mystery", userId: USER_ID },
      FAKE_TX,
    );
    expect(repository.update).toHaveBeenCalledWith(
      {
        data: { name: "Cozy Mystery", normalizedName: "cozy mystery" },
        id: TAG_ID,
        userId: USER_ID,
      },
      FAKE_TX,
    );
  });

  it("throws ConflictError when the renamed normalized name is taken by another tag", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(tag({ normalizedName: "dark academia" }));
    repository.findByNormalizedExcluding.mockResolvedValue(tag({ id: OTHER_TAG_ID }));

    await expect(service.update(USER_ID, TAG_ID, { name: "Slow Burn" })).rejects.toThrow(
      ConflictError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("skips the duplicate check when only the casing changes", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(tag({ normalizedName: "dark academia" }));
    repository.update.mockResolvedValue(tag({ name: "Dark Academia" }));

    await service.update(USER_ID, TAG_ID, { name: "Dark Academia" });

    expect(repository.findByNormalizedExcluding).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      {
        data: { name: "Dark Academia", normalizedName: "dark academia" },
        id: TAG_ID,
        userId: USER_ID,
      },
      FAKE_TX,
    );
  });

  it("updates only the provided fields without touching the name", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(tag());
    repository.update.mockResolvedValue(tag({ type: "trope" }));

    await service.update(USER_ID, TAG_ID, { type: "trope" });

    expect(repository.findByNormalizedExcluding).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      { data: { type: "trope" }, id: TAG_ID, userId: USER_ID },
      FAKE_TX,
    );
  });

  it("clears color and description when they are set to null", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(tag({ color: "#A96E47", description: "old" }));
    repository.update.mockResolvedValue(tag({ color: null, description: null }));

    await service.update(USER_ID, TAG_ID, { color: null, description: null });

    expect(repository.update).toHaveBeenCalledWith(
      { data: { color: null, description: null }, id: TAG_ID, userId: USER_ID },
      FAKE_TX,
    );
  });
});

describe("TagsService.stats", () => {
  it("merges book counts into each owned tag and defaults missing counts to zero", async () => {
    const { repository, service } = buildService();
    repository.listOwned.mockResolvedValue([
      tag({
        description: "moody university vibes",
        id: TAG_ID,
        name: "dark academia",
        normalizedName: "dark academia",
      }),
      tag({ id: OTHER_TAG_ID, name: "slow burn", normalizedName: "slow burn" }),
    ]);
    repository.countBooksByTag.mockResolvedValue([{ count: 3, tagId: TAG_ID }]);

    const stats = await service.stats(USER_ID);

    expect(stats).toEqual([
      {
        booksCount: 3,
        color: null,
        description: "moody university vibes",
        id: TAG_ID,
        lastUsedAt: null,
        name: "dark academia",
        normalizedName: "dark academia",
        type: "custom",
      },
      {
        booksCount: 0,
        color: null,
        description: null,
        id: OTHER_TAG_ID,
        lastUsedAt: null,
        name: "slow burn",
        normalizedName: "slow burn",
        type: "custom",
      },
    ]);
  });
});

describe("TagsService.resolveOrCreateMany", () => {
  it("reuses an existing tag without creating a new one", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });

  it("upserts a new tag when no match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.upsertByNormalized).toHaveBeenCalledWith(
      { name: "dark academia", normalizedName: "dark academia", userId: USER_ID },
      undefined,
    );
  });

  it("dedups the input by normalized name so a repeated tag counts once", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["Dark Academia", "  dark   academia "]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.upsertByNormalized).toHaveBeenCalledTimes(1);
    expect(repository.upsertByNormalized).toHaveBeenCalledWith(
      { name: "Dark Academia", normalizedName: "dark academia", userId: USER_ID },
      undefined,
    );
  });

  it("resolves each distinct tag to its own id", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized
      .mockResolvedValueOnce(tag({ id: TAG_ID, name: "dark academia" }))
      .mockResolvedValueOnce(
        tag({ id: OTHER_TAG_ID, name: "slow burn", normalizedName: "slow burn" }),
      );

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia", "slow burn"]);

    expect(ids).toEqual([TAG_ID, OTHER_TAG_ID]);
  });

  it("stamps lastUsedAt on every resolved tag when a book is saved", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized
      .mockResolvedValueOnce(tag({ id: TAG_ID }))
      .mockResolvedValueOnce(tag({ id: OTHER_TAG_ID, normalizedName: "slow burn" }));

    await service.resolveOrCreateMany(USER_ID, ["dark academia", "slow burn"], FAKE_TX);

    expect(repository.touchLastUsed).toHaveBeenCalledWith(
      { tagIds: [TAG_ID, OTHER_TAG_ID], usedAt: expect.any(Date), userId: USER_ID },
      FAKE_TX,
    );
  });

  it("propagates errors raised by the upsert", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockRejectedValue(new Error("connection lost"));

    await expect(service.resolveOrCreateMany(USER_ID, ["dark academia"])).rejects.toThrow(
      "connection lost",
    );
  });

  it("returns an empty array for no tags", async () => {
    const { repository, service } = buildService();

    const ids = await service.resolveOrCreateMany(USER_ID, []);

    expect(ids).toEqual([]);
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });
});

describe("TagsService.search", () => {
  it("maps the page to a Paginator of TagView with the search term and coordinates", async () => {
    const { repository, service } = buildService();
    repository.searchOwned.mockResolvedValue([tag({ id: TAG_ID, name: "dark academia" })]);
    repository.countOwned.mockResolvedValue(1);

    const page = await service.search(USER_ID, {
      pageNumber: 1,
      pageSize: 10,
      search: "dark",
    });

    expect(page).toEqual({
      items: [{ id: TAG_ID, name: "dark academia" }],
      page: 1,
      pagesCount: 1,
      pageSize: 10,
      totalCount: 1,
    });
    expect(repository.searchOwned).toHaveBeenCalledWith({
      query: "dark",
      skip: 0,
      take: 10,
      userId: USER_ID,
    });
    expect(repository.countOwned).toHaveBeenCalledWith({ query: "dark", userId: USER_ID });
  });
});

describe("TagsService.delete", () => {
  it("deletes the owned tag when the repository removes a row", async () => {
    const { repository, service } = buildService();
    repository.deleteOwned.mockResolvedValue(1);

    await expect(service.delete(USER_ID, TAG_ID)).resolves.toBeUndefined();
    expect(repository.deleteOwned).toHaveBeenCalledWith(USER_ID, TAG_ID);
  });

  it("throws NotFoundError when no row is removed", async () => {
    const { repository, service } = buildService();
    repository.deleteOwned.mockResolvedValue(0);

    await expect(service.delete(USER_ID, TAG_ID)).rejects.toThrow(NotFoundError);
  });
});
