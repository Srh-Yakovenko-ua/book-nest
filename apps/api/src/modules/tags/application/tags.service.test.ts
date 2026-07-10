import { describe, expect, it, vi } from "vitest";

import type { TagModel } from "../../../generated/prisma/models.js";
import type { TagsRepository } from "../infrastructure/tags.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { TagsService } from "./tags.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TAG_ID = "33333333-3333-4333-8333-333333333333";

function buildService(): {
  repository: {
    countOwned: ReturnType<typeof vi.fn>;
    deleteOwned: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    searchOwned: ReturnType<typeof vi.fn>;
    upsertByNormalized: ReturnType<typeof vi.fn>;
  };
  service: TagsService;
} {
  const repository = {
    countOwned: vi.fn().mockResolvedValue(0),
    deleteOwned: vi.fn().mockResolvedValue(0),
    findByNormalized: vi.fn().mockResolvedValue(null),
    searchOwned: vi.fn().mockResolvedValue([]),
    upsertByNormalized: vi.fn(),
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

  it("returns the row the upsert resolves when no prior match exists", async () => {
    const { repository, service } = buildService();
    repository.findByNormalized.mockResolvedValue(null);
    repository.upsertByNormalized.mockResolvedValue(tag({ id: OTHER_TAG_ID }));

    const ids = await service.resolveOrCreateMany(USER_ID, ["dark academia"]);

    expect(ids).toEqual([OTHER_TAG_ID]);
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
