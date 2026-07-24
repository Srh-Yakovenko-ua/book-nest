import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { LibraryStatsRow } from "../domain/publisher-library.mapper.js";
import type { PublishersRepository } from "../infrastructure/publishers.repository.js";

import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/exceptions/errors.js";
import { PublishersService } from "./publishers.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const PUBLISHER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";

type RepositoryMock = {
  aggregateLibrary: ReturnType<typeof vi.fn>;
  aggregateLibraryDetail: ReturnType<typeof vi.fn>;
  countBooks: ReturnType<typeof vi.fn>;
  countLibrary: ReturnType<typeof vi.fn>;
  deleteWithNames: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByNormalized: ReturnType<typeof vi.fn>;
  summaryCounts: ReturnType<typeof vi.fn>;
  summaryPriceTotals: ReturnType<typeof vi.fn>;
  updateCustom: ReturnType<typeof vi.fn>;
  updatePrimaryName: ReturnType<typeof vi.fn>;
};

type ServiceOverrides = {
  aggregateLibrary?: LibraryStatsRow[];
  aggregateLibraryDetail?: Nullable<LibraryStatsRow>;
  countBooks?: number;
  countLibrary?: number;
  findById?: Nullable<PublisherModel>;
  findByNormalized?: Nullable<PublisherModel>;
  updateCustom?: PublisherModel;
};

function buildService(overrides: ServiceOverrides = {}): {
  repository: RepositoryMock;
  service: PublishersService;
  txClient: Prisma.TransactionClient;
} {
  const txClient = {} as Prisma.TransactionClient;
  const repository: RepositoryMock = {
    aggregateLibrary: vi.fn().mockResolvedValue(overrides.aggregateLibrary ?? []),
    aggregateLibraryDetail: vi.fn().mockResolvedValue(overrides.aggregateLibraryDetail ?? null),
    countBooks: vi.fn().mockResolvedValue(overrides.countBooks ?? 0),
    countLibrary: vi.fn().mockResolvedValue(overrides.countLibrary ?? 0),
    deleteWithNames: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(overrides.findById ?? null),
    findByNormalized: vi.fn().mockResolvedValue(overrides.findByNormalized ?? null),
    summaryCounts: vi.fn(),
    summaryPriceTotals: vi.fn(),
    updateCustom: vi.fn().mockResolvedValue(overrides.updateCustom ?? publisher()),
    updatePrimaryName: vi.fn().mockResolvedValue(undefined),
  };

  const transactionRunner = {
    run: vi.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(txClient)),
  };

  const service = new PublishersService(
    repository as unknown as PublishersRepository,
    transactionRunner as unknown as TransactionRunner,
  );

  return { repository, service, txClient };
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
    name: "My Press",
    normalizedName: "my press",
    searchText: "my press",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    websiteUrl: null,
    wikidataId: null,
    ...overrides,
  };
}

function statsRow(overrides: Partial<LibraryStatsRow> = {}): LibraryStatsRow {
  return {
    averageRating: null,
    booksCount: 3,
    countryCode: null,
    foundedYear: null,
    id: PUBLISHER_ID,
    isCustom: true,
    lastBookAddedAt: null,
    lastBookReadAt: null,
    name: "My Press",
    queueCount: 0,
    ratedBooksCount: 0,
    readCount: 0,
    readingCount: 0,
    seriesCount: 0,
    wantToBuyCount: 0,
    wantToReadCount: 0,
    websiteUrl: null,
    ...overrides,
  };
}

describe("PublishersService.deleteCustom", () => {
  it("throws NotFoundError when the publisher does not exist", async () => {
    const { service } = buildService({ findById: null });

    await expect(
      service.deleteCustom({ publisherId: PUBLISHER_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError when the publisher is global", async () => {
    const { service } = buildService({ findById: publisher({ userId: null }) });

    await expect(
      service.deleteCustom({ publisherId: PUBLISHER_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when the publisher belongs to another user", async () => {
    const { service } = buildService({ findById: publisher({ userId: OTHER_USER_ID }) });

    await expect(
      service.deleteCustom({ publisherId: PUBLISHER_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws a PUBLISHER_HAS_BOOKS conflict when the publisher still has linked books", async () => {
    const { repository, service } = buildService({ countBooks: 2, findById: publisher() });

    await expect(
      service.deleteCustom({ publisherId: PUBLISHER_ID, userId: USER_ID }),
    ).rejects.toMatchObject({ code: "PUBLISHER_HAS_BOOKS" });
    expect(repository.deleteWithNames).not.toHaveBeenCalled();
  });

  it("deletes the publisher with its names inside the transaction when it has no books", async () => {
    const { repository, service, txClient } = buildService({
      countBooks: 0,
      findById: publisher(),
    });

    await service.deleteCustom({ publisherId: PUBLISHER_ID, userId: USER_ID });

    expect(repository.deleteWithNames).toHaveBeenCalledWith(PUBLISHER_ID, txClient);
  });
});

describe("PublishersService.updateCustom", () => {
  const renameInput = {
    input: { name: "Renamed Press" },
    publisherId: PUBLISHER_ID,
    userId: USER_ID,
  };

  it("throws NotFoundError when the publisher does not exist", async () => {
    const { service } = buildService({ findById: null });

    await expect(service.updateCustom(renameInput)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError when the publisher is global", async () => {
    const { service } = buildService({ findById: publisher({ userId: null }) });

    await expect(service.updateCustom(renameInput)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when the publisher belongs to another user", async () => {
    const { service } = buildService({ findById: publisher({ userId: OTHER_USER_ID }) });

    await expect(service.updateCustom(renameInput)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws a PUBLISHER_DUPLICATE_NAME conflict when the new name collides with a different publisher", async () => {
    const { service } = buildService({
      findById: publisher(),
      findByNormalized: publisher({ id: OTHER_PUBLISHER_ID, name: "Renamed Press" }),
    });

    await expect(service.updateCustom(renameInput)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.updateCustom(renameInput)).rejects.toMatchObject({
      code: "PUBLISHER_DUPLICATE_NAME",
    });
  });

  it("allows a rename that resolves to the same publisher row", async () => {
    const { service } = buildService({
      aggregateLibraryDetail: statsRow({ name: "Renamed Press" }),
      findById: publisher(),
      findByNormalized: publisher({ id: PUBLISHER_ID }),
    });

    const detail = await service.updateCustom(renameInput);

    expect(detail.name).toBe("Renamed Press");
  });

  it("skips the duplicate-name check when no name is provided", async () => {
    const { repository, service } = buildService({
      aggregateLibraryDetail: statsRow(),
      findById: publisher(),
    });

    await service.updateCustom({
      input: { countryCode: "UA" },
      publisherId: PUBLISHER_ID,
      userId: USER_ID,
    });

    expect(repository.findByNormalized).not.toHaveBeenCalled();
  });

  it("updates the primary name only when a rename is requested", async () => {
    const { repository, service, txClient } = buildService({
      aggregateLibraryDetail: statsRow(),
      findById: publisher(),
    });

    await service.updateCustom(renameInput);

    expect(repository.updatePrimaryName).toHaveBeenCalledWith(
      { name: "Renamed Press", normalizedName: "renamed press", publisherId: PUBLISHER_ID },
      txClient,
    );
  });

  it("does not touch the primary name when only catalog fields change", async () => {
    const { repository, service } = buildService({
      aggregateLibraryDetail: statsRow(),
      findById: publisher(),
    });

    await service.updateCustom({
      input: { foundedYear: 1999 },
      publisherId: PUBLISHER_ID,
      userId: USER_ID,
    });

    expect(repository.updatePrimaryName).not.toHaveBeenCalled();
  });

  it("returns the recomputed library detail when the publisher has books", async () => {
    const { service } = buildService({
      aggregateLibraryDetail: statsRow({ booksCount: 4, name: "Renamed Press" }),
      findById: publisher(),
    });

    const detail = await service.updateCustom(renameInput);

    expect(detail).toMatchObject({ name: "Renamed Press", stats: { booksCount: 4 } });
  });

  it("falls back to the model with zeroed stats when the publisher has no books", async () => {
    const { service } = buildService({
      aggregateLibraryDetail: null,
      findById: publisher(),
      updateCustom: publisher({ name: "Renamed Press" }),
    });

    const detail = await service.updateCustom(renameInput);

    expect(detail).toMatchObject({ name: "Renamed Press", stats: { booksCount: 0 } });
  });
});

describe("PublishersService.libraryList", () => {
  const baseQuery = {
    geography: "all",
    locale: "uk",
    order: "desc",
    pageNumber: 1,
    pageSize: 10,
    sort: "booksCount",
    source: "all",
  } as const;

  it("treats an absent hasBooksToBuy flag as false", async () => {
    const { repository, service } = buildService();

    await service.libraryList({ query: { ...baseQuery }, userId: USER_ID });

    expect(repository.aggregateLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ hasBooksToBuy: false, hasRatedBooks: false, hasSeries: false }),
    );
  });

  it("forwards the having flags when they are explicitly true", async () => {
    const { repository, service } = buildService();

    await service.libraryList({
      query: { ...baseQuery, hasBooksToBuy: true, hasRatedBooks: true, hasSeries: true },
      userId: USER_ID,
    });

    expect(repository.aggregateLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ hasBooksToBuy: true, hasRatedBooks: true, hasSeries: true }),
    );
  });

  it("computes skip and take from the page coordinates", async () => {
    const { repository, service } = buildService();

    await service.libraryList({
      query: { ...baseQuery, pageNumber: 3, pageSize: 15 },
      userId: USER_ID,
    });

    expect(repository.aggregateLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 15 }),
    );
  });

  it("wraps the mapped rows in a paginator that reports the repository total", async () => {
    const { service } = buildService({
      aggregateLibrary: [statsRow({ booksCount: 5 })],
      countLibrary: 42,
    });

    const page = await service.libraryList({ query: { ...baseQuery }, userId: USER_ID });

    expect(page).toMatchObject({ page: 1, pageSize: 10, totalCount: 42 });
    expect(page.items[0]?.stats.booksCount).toBe(5);
  });
});
