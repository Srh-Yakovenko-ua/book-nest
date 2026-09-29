import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { MediaService } from "../../media/index.js";
import type { PublisherOverviewRepository } from "../infrastructure/publisher-overview.repository.js";
import type { PublishersRepository } from "../infrastructure/publishers.repository.js";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { PublishersService } from "./publishers.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";

type MergeRepositoryOverrides = {
  deleteWithNames?: Error | number;
  findById?: Nullable<PublisherModel>;
  findVisibleById?: Nullable<PublisherModel>;
  reassignBooks?: number;
};

function buildService(overrides: MergeRepositoryOverrides = {}): {
  calls: string[];
  repository: {
    deleteWithNames: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findVisibleById: ReturnType<typeof vi.fn>;
    reassignBooks: ReturnType<typeof vi.fn>;
  };
  service: PublishersService;
} {
  const calls: string[] = [];

  const deleteOutcome = overrides.deleteWithNames ?? 1;
  const repository = {
    deleteWithNames: vi.fn(() => {
      calls.push("deleteWithNames");
      return deleteOutcome instanceof Error
        ? Promise.reject(deleteOutcome)
        : Promise.resolve(deleteOutcome);
    }),
    findById: vi.fn(() =>
      Promise.resolve(
        overrides.findById === undefined ? publisher({ id: SOURCE_ID }) : overrides.findById,
      ),
    ),
    findVisibleById: vi.fn(() =>
      Promise.resolve(
        overrides.findVisibleById === undefined
          ? publisher({ id: TARGET_ID, userId: null })
          : overrides.findVisibleById,
      ),
    ),
    reassignBooks: vi.fn(() => {
      calls.push("reassignBooks");
      return Promise.resolve(overrides.reassignBooks ?? 0);
    }),
  };

  const transactionRunner = {
    run: vi.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn({} as Prisma.TransactionClient),
    ),
  };

  const service = new PublishersService(
    repository as unknown as PublishersRepository,
    transactionRunner as unknown as TransactionRunner,
    {} as PublisherOverviewRepository,
    {} as MediaService,
  );

  return { calls, repository, service };
}

function foreignKeyViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
    clientVersion: "7.8.0",
    code: "P2003",
  });
}

function merge(service: PublishersService): Promise<unknown> {
  return service.mergeCustom({
    sourcePublisherId: SOURCE_ID,
    targetPublisherId: TARGET_ID,
    userId: USER_ID,
  });
}

function publisher(overrides: Partial<PublisherModel> = {}): PublisherModel {
  return {
    countryCode: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    foundedYear: null,
    id: SOURCE_ID,
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

describe("PublishersService.mergeCustom success", () => {
  it("reports the target and how many books moved", async () => {
    const { service } = buildService({ reassignBooks: 3 });

    const result = await merge(service);

    expect(result).toEqual({ movedBooksCount: 3, targetPublisherId: TARGET_ID });
  });

  it("reassigns the books before deleting the source publisher", async () => {
    const { calls, service } = buildService({ reassignBooks: 2 });

    await merge(service);

    expect(calls).toEqual(["reassignBooks", "deleteWithNames"]);
  });

  it("scopes the reassignment to the current user and the two publishers", async () => {
    const { repository, service } = buildService({ reassignBooks: 1 });

    await merge(service);

    expect(repository.reassignBooks).toHaveBeenCalledWith(
      { sourcePublisherId: SOURCE_ID, targetPublisherId: TARGET_ID, userId: USER_ID },
      {},
    );
    expect(repository.deleteWithNames).toHaveBeenCalledWith(SOURCE_ID, {});
  });

  it("reports zero moved books when the source publisher has none", async () => {
    const { service } = buildService({ reassignBooks: 0 });

    const result = await merge(service);

    expect(result).toEqual({ movedBooksCount: 0, targetPublisherId: TARGET_ID });
  });
});

describe("PublishersService.mergeCustom validation", () => {
  it("rejects merging a publisher into itself without touching the repository", async () => {
    const { repository, service } = buildService();

    const rejection = service.mergeCustom({
      sourcePublisherId: SOURCE_ID,
      targetPublisherId: SOURCE_ID,
      userId: USER_ID,
    });

    await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
    await expect(rejection).rejects.toMatchObject({ code: "PUBLISHER_MERGE_SAME_PUBLISHER" });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.reassignBooks).not.toHaveBeenCalled();
  });

  it("rejects a global source publisher with a forbidden error", async () => {
    const { repository, service } = buildService({
      findById: publisher({ id: SOURCE_ID, userId: null }),
    });

    await expect(merge(service)).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.reassignBooks).not.toHaveBeenCalled();
  });

  it("hides a source publisher owned by another user behind the same not-found error", async () => {
    const { repository, service } = buildService({
      findById: publisher({ id: SOURCE_ID, userId: OTHER_USER_ID }),
    });

    await expect(merge(service)).rejects.toThrowError(new NotFoundError("Publisher not found"));
    expect(repository.reassignBooks).not.toHaveBeenCalled();
  });

  it("rejects a missing source publisher with the same not-found error", async () => {
    const { service } = buildService({ findById: null });

    await expect(merge(service)).rejects.toThrowError(new NotFoundError("Publisher not found"));
  });

  it("rejects a target that is not visible to the current user", async () => {
    const { repository, service } = buildService({ findVisibleById: null });

    await expect(merge(service)).rejects.toThrowError(new NotFoundError("Publisher not found"));
    expect(repository.reassignBooks).not.toHaveBeenCalled();
    expect(repository.deleteWithNames).not.toHaveBeenCalled();
  });
});

describe("PublishersService.mergeCustom conflicts", () => {
  it("maps a foreign key violation on the delete to a has-books conflict", async () => {
    const { service } = buildService({ deleteWithNames: foreignKeyViolation() });
    const rejection = merge(service);

    await expect(rejection).rejects.toBeInstanceOf(ConflictError);
    await expect(rejection).rejects.toMatchObject({ code: "PUBLISHER_HAS_BOOKS" });
  });

  it("keeps an unexpected repository error unmapped", async () => {
    const { service } = buildService({ deleteWithNames: new Error("boom") });

    await expect(merge(service)).rejects.toThrowError(new Error("boom"));
  });

  it("rejects when the source publisher vanished before the delete", async () => {
    const { service } = buildService({ deleteWithNames: 0 });

    await expect(merge(service)).rejects.toThrowError(new NotFoundError("Publisher not found"));
  });
});
