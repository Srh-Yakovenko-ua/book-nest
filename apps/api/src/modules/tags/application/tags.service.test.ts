import { describe, expect, it, vi } from "vitest";

import type { TagModel } from "../../../generated/prisma/models.js";
import type { TagsRepository } from "../infrastructure/tags.repository.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { TagsService } from "./tags.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TAG_ID = "33333333-3333-4333-8333-333333333333";

function buildService(): {
  repository: {
    countOwned: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    searchOwned: ReturnType<typeof vi.fn>;
  };
  service: TagsService;
} {
  const repository = {
    countOwned: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findByNormalized: vi.fn().mockResolvedValue(null),
    searchOwned: vi.fn().mockResolvedValue([]),
  };

  const service = new TagsService(repository as unknown as TagsRepository);

  return { repository, service };
}

function tag(overrides: Partial<TagModel> = {}): TagModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    id: TAG_ID,
    name: "dark academia",
    normalizedName: "dark academia",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

describe("TagsService.resolveOrCreateMany", () => {
  it("reuses an existing tag without creating a new one", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates a new tag when no match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, "dark academia", "dark academia");
  });

  it("dedups the input by normalized name so a repeated tag counts once", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockResolvedValue(tag({ id: TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["Dark Academia", "  dark   academia "]);

    expect(ids).toEqual([TAG_ID]);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(USER_ID, "Dark Academia", "dark academia");
  });

  it("resolves each distinct tag to its own id", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create
      .mockResolvedValueOnce(tag({ id: TAG_ID, name: "dark academia" }))
      .mockResolvedValueOnce(
        tag({ id: OTHER_TAG_ID, name: "slow burn", normalizedName: "slow burn" }),
      );

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia", "slow burn"]);

    expect(ids).toEqual([TAG_ID, OTHER_TAG_ID]);
  });

  it("rereads the winning row when create hits a unique violation", async () => {
    const { repository, service } = buildService();
    const winner = tag({ id: OTHER_TAG_ID });
    repository.findByNormalized.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    repository.create.mockRejectedValue(uniqueConstraintError());

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([OTHER_TAG_ID]);
    expect(repository.findByNormalized).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-unique errors from create", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.create.mockRejectedValue(new Error("connection lost"));

    await expect(service.resolveOrCreateMany(USER_ID, ["dark academia"])).rejects.toThrow(
      "connection lost",
    );
  });

  it("returns an empty array for no tags", async () => {
    const { repository, service } = buildService();

    const ids = await service.resolveOrCreateMany(USER_ID, []);

    expect(ids).toEqual([]);
    expect(repository.create).not.toHaveBeenCalled();
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
