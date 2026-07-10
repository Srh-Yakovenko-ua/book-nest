import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { PublisherModel } from "../../../generated/prisma/models.js";
import type {
  PublishersRepository,
  PublisherWithPrimaryNames,
} from "../infrastructure/publishers.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { PublishersService } from "./publishers.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHER_ID = "22222222-2222-4222-8222-222222222222";
const GLOBAL_ID = "33333333-3333-4333-8333-333333333333";

function buildService(overrides: {
  findByNormalized?: Nullable<PublisherModel>;
  findVisibleById?: Nullable<PublisherModel>;
  findVisibleByIds?: PublisherWithPrimaryNames[];
  recentPublisherIds?: string[];
  searchVisible?: PublisherWithPrimaryNames[];
  upsertByNormalized?: Error | PublisherModel;
}): {
  repository: {
    countVisible: ReturnType<typeof vi.fn>;
    findByNormalized: ReturnType<typeof vi.fn>;
    findVisibleById: ReturnType<typeof vi.fn>;
    findVisibleByIds: ReturnType<typeof vi.fn>;
    recentPublisherIds: ReturnType<typeof vi.fn>;
    searchVisible: ReturnType<typeof vi.fn>;
    upsertByNormalized: ReturnType<typeof vi.fn>;
  };
  service: PublishersService;
} {
  const upsertByNormalized = vi.fn();
  if (overrides.upsertByNormalized instanceof Error) {
    upsertByNormalized.mockRejectedValue(overrides.upsertByNormalized);
  } else {
    upsertByNormalized.mockResolvedValue(overrides.upsertByNormalized ?? publisher());
  }

  const searchVisible = overrides.searchVisible ?? [];
  const repository = {
    countVisible: vi.fn().mockResolvedValue(searchVisible.length),
    findByNormalized: vi.fn().mockResolvedValue(overrides.findByNormalized ?? null),
    findVisibleById: vi.fn().mockResolvedValue(overrides.findVisibleById ?? null),
    findVisibleByIds: vi.fn().mockResolvedValue(overrides.findVisibleByIds ?? []),
    recentPublisherIds: vi.fn().mockResolvedValue(overrides.recentPublisherIds ?? []),
    searchVisible: vi.fn().mockResolvedValue(searchVisible),
    upsertByNormalized,
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
    searchText: "penguin",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    websiteUrl: null,
    wikidataId: null,
    ...overrides,
  };
}

function publisherWithNames(
  overrides: Partial<PublisherWithPrimaryNames> = {},
): PublisherWithPrimaryNames {
  const base = publisher(overrides);
  return {
    ...base,
    names: overrides.names ?? [
      {
        id: `${base.id}-name`,
        isPrimary: true,
        locale: "uk",
        name: base.name,
        normalizedName: base.normalizedName,
        publisherId: base.id,
      },
    ],
  };
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
  it("reuses the matching publisher and does not upsert a new one", async () => {
    const { repository, service } = buildService({
      findByNormalized: publisher({ id: GLOBAL_ID }),
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Penguin" });

    expect(id).toBe(GLOBAL_ID);
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });

  it("matches an existing publisher case-insensitively and whitespace-collapsed", async () => {
    const { repository, service } = buildService({
      findByNormalized: publisher({ id: GLOBAL_ID }),
    });

    await service.resolveOrCreate(USER_ID, { name: "  PENGUIN   Books  " });

    expect(repository.findByNormalized).toHaveBeenCalledWith(USER_ID, "penguin books", undefined);
  });

  it("upserts a custom publisher with the user id when no match exists", async () => {
    const created = publisher({ id: PUBLISHER_ID, userId: USER_ID });
    const { repository, service } = buildService({
      findByNormalized: null,
      upsertByNormalized: created,
    });

    const id = await service.resolveOrCreate(USER_ID, { name: "Penguin" });

    expect(id).toBe(PUBLISHER_ID);
    expect(repository.upsertByNormalized).toHaveBeenCalledWith(
      {
        locale: "uk",
        name: "Penguin",
        normalizedName: "penguin",
        userId: USER_ID,
      },
      undefined,
    );
  });

  it("propagates errors raised by the upsert", async () => {
    const { service } = buildService({
      findByNormalized: null,
      upsertByNormalized: new Error("connection lost"),
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
    expect(repository.upsertByNormalized).not.toHaveBeenCalled();
  });
});

describe("PublishersService.recent", () => {
  it("returns an empty array and skips the lookup when the user has no recent publishers", async () => {
    const { repository, service } = buildService({ recentPublisherIds: [] });

    const result = await service.recent({ limit: 8, locale: "uk", userId: USER_ID });

    expect(result).toEqual([]);
    expect(repository.findVisibleByIds).not.toHaveBeenCalled();
  });

  it("maps rows to views and preserves the recency order returned by the repository", async () => {
    const { service } = buildService({
      findVisibleByIds: [
        publisherWithNames({ id: GLOBAL_ID, name: "Vintage", userId: null }),
        publisherWithNames({ id: PUBLISHER_ID, name: "My Press", userId: USER_ID }),
      ],
      recentPublisherIds: [PUBLISHER_ID, GLOBAL_ID],
    });

    const result = await service.recent({ limit: 8, locale: "uk", userId: USER_ID });

    expect(result.map((publisher) => publisher.id)).toEqual([PUBLISHER_ID, GLOBAL_ID]);
    expect(result.map((publisher) => publisher.name)).toEqual(["My Press", "Vintage"]);
  });

  it("drops ids whose publisher row is no longer visible", async () => {
    const { service } = buildService({
      findVisibleByIds: [
        publisherWithNames({ id: PUBLISHER_ID, name: "My Press", userId: USER_ID }),
      ],
      recentPublisherIds: [PUBLISHER_ID, GLOBAL_ID],
    });

    const result = await service.recent({ limit: 8, locale: "uk", userId: USER_ID });

    expect(result.map((publisher) => publisher.id)).toEqual([PUBLISHER_ID]);
  });

  it("resolves the display name to the requested locale", async () => {
    const { service } = buildService({
      findVisibleByIds: [
        publisherWithNames({
          id: GLOBAL_ID,
          name: "Vydavnytstvo Stary Lev",
          names: [
            {
              id: "name-en",
              isPrimary: true,
              locale: "en",
              name: "Vydavnytstvo Stary Lev",
              normalizedName: "vydavnytstvo stary lev",
              publisherId: GLOBAL_ID,
            },
            {
              id: "name-uk",
              isPrimary: true,
              locale: "uk",
              name: "Видавництво Старого Лева",
              normalizedName: "видавництво старого лева",
              publisherId: GLOBAL_ID,
            },
          ],
          userId: null,
        }),
      ],
      recentPublisherIds: [GLOBAL_ID],
    });

    const english = await service.recent({ limit: 8, locale: "en", userId: USER_ID });

    expect(english[0]?.name).toBe("Vydavnytstvo Stary Lev");
  });

  it("forwards the limit to the repository", async () => {
    const { repository, service } = buildService({ recentPublisherIds: [] });

    await service.recent({ limit: 5, locale: "uk", userId: USER_ID });

    expect(repository.recentPublisherIds).toHaveBeenCalledWith({ limit: 5, userId: USER_ID });
  });
});

describe("PublishersService.search", () => {
  it("returns a paginator whose items mark user rows custom and global rows not custom", async () => {
    const { service } = buildService({
      searchVisible: [
        publisherWithNames({ id: PUBLISHER_ID, name: "My Press", userId: USER_ID }),
        publisherWithNames({ id: GLOBAL_ID, name: "Vintage", userId: null }),
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
        id: PUBLISHER_ID,
        isCustom: true,
        name: "My Press",
      }),
      expect.objectContaining({
        id: GLOBAL_ID,
        isCustom: false,
        name: "Vintage",
      }),
    ]);
  });

  it("resolves the display name to the requested locale and falls back to the canonical name", async () => {
    const { service } = buildService({
      searchVisible: [
        publisherWithNames({
          id: GLOBAL_ID,
          name: "Vydavnytstvo Stary Lev",
          names: [
            {
              id: "name-en",
              isPrimary: true,
              locale: "en",
              name: "Vydavnytstvo Stary Lev",
              normalizedName: "vydavnytstvo stary lev",
              publisherId: GLOBAL_ID,
            },
            {
              id: "name-uk",
              isPrimary: true,
              locale: "uk",
              name: "Видавництво Старого Лева",
              normalizedName: "видавництво старого лева",
              publisherId: GLOBAL_ID,
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

    expect(ukrainian.items[0]?.name).toBe("Видавництво Старого Лева");
    expect(english.items[0]?.name).toBe("Vydavnytstvo Stary Lev");
  });

  it("falls back to the canonical name when no localized name exists", async () => {
    const { service } = buildService({
      searchVisible: [
        publisherWithNames({
          id: GLOBAL_ID,
          name: "Penguin",
          names: [
            {
              id: "name-en",
              isPrimary: true,
              locale: "en",
              name: "Penguin",
              normalizedName: "penguin",
              publisherId: GLOBAL_ID,
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

    expect(ukrainian.items[0]?.name).toBe("Penguin");
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService({ searchVisible: [] });

    await service.search(USER_ID, {
      locale: "uk",
      pageNumber: 2,
      pageSize: 15,
      search: "penguin",
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
