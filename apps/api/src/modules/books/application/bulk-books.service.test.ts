import type {
  BulkListsInput,
  BulkOwnershipStatusInput,
  BulkReadingStatusInput,
  BulkTagsInput,
} from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { ListsService } from "../../lists/application/lists.service.js";
import type { TagsService } from "../../tags/application/tags.service.js";
import type { BulkBooksRepository } from "../infrastructure/bulk-books.repository.js";

import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BulkBooksService } from "./bulk-books.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_A = "22222222-2222-4222-8222-222222222201";
const BOOK_B = "22222222-2222-4222-8222-222222222202";
const TAG_ID = "33333333-3333-4333-8333-333333333301";
const LIST_ID = "44444444-4444-4444-8444-444444444401";
const MEDIA_ID = "55555555-5555-4555-8555-555555555501";

type BulkRepository = {
  addTags: ReturnType<typeof vi.fn>;
  addToLists: ReturnType<typeof vi.fn>;
  addToReadingQueue: ReturnType<typeof vi.fn>;
  deleteOwned: ReturnType<typeof vi.fn>;
  findOwnedIds: ReturnType<typeof vi.fn>;
  setFavorite: ReturnType<typeof vi.fn>;
  setOwnershipStatus: ReturnType<typeof vi.fn>;
  setReadingStatus: ReturnType<typeof vi.fn>;
};

function buildService(
  overrides: {
    addTags?: number;
    addToLists?: number;
    addToReadingQueue?: number;
    deleteAffected?: number;
    deleteCoverMediaIds?: string[];
    listIds?: string[];
    ownedBookIds?: string[];
    setFavorite?: number;
    setOwnershipStatus?: number;
    setReadingStatus?: number;
    tagIds?: string[];
  } = {},
): {
  bulkBooksRepository: BulkRepository;
  coverCleanup: { deleteIfOrphaned: ReturnType<typeof vi.fn> };
  listsService: { resolveListsForBook: ReturnType<typeof vi.fn> };
  service: BulkBooksService;
  tagsService: { resolveOrCreateMany: ReturnType<typeof vi.fn> };
} {
  const bulkBooksRepository: BulkRepository = {
    addTags: vi.fn().mockResolvedValue(overrides.addTags ?? 0),
    addToLists: vi.fn().mockResolvedValue(overrides.addToLists ?? 0),
    addToReadingQueue: vi.fn().mockResolvedValue(overrides.addToReadingQueue ?? 0),
    deleteOwned: vi.fn().mockResolvedValue({
      affected: overrides.deleteAffected ?? 0,
      coverMediaIds: overrides.deleteCoverMediaIds ?? [],
    }),
    findOwnedIds: vi.fn().mockResolvedValue(overrides.ownedBookIds ?? [BOOK_A]),
    setFavorite: vi.fn().mockResolvedValue(overrides.setFavorite ?? 0),
    setOwnershipStatus: vi.fn().mockResolvedValue(overrides.setOwnershipStatus ?? 0),
    setReadingStatus: vi.fn().mockResolvedValue(overrides.setReadingStatus ?? 0),
  };
  const tagsService = {
    resolveOrCreateMany: vi.fn().mockResolvedValue(overrides.tagIds ?? []),
  };
  const listsService = {
    resolveListsForBook: vi.fn().mockResolvedValue(overrides.listIds ?? []),
  };
  const coverCleanup = {
    deleteIfOrphaned: vi.fn().mockResolvedValue(undefined),
  };

  const service = new BulkBooksService(
    bulkBooksRepository as unknown as BulkBooksRepository,
    tagsService as unknown as TagsService,
    listsService as unknown as ListsService,
    coverCleanup as unknown as BookCoverCleanup,
  );

  return { bulkBooksRepository, coverCleanup, listsService, service, tagsService };
}

describe("BulkBooksService.addTags", () => {
  it("returns zero affected and skips the repository when no tags resolve", async () => {
    const { bulkBooksRepository, service } = buildService({ ownedBookIds: [BOOK_A], tagIds: [] });
    const input: BulkTagsInput = { bookIds: [BOOK_A], tags: [] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(bulkBooksRepository.addTags).not.toHaveBeenCalled();
  });

  it("creates no tags and skips the repository when no books are owned", async () => {
    const { bulkBooksRepository, service, tagsService } = buildService({
      ownedBookIds: [],
      tagIds: [TAG_ID],
    });
    const input: BulkTagsInput = { bookIds: [BOOK_A], tags: ["dark academia"] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(tagsService.resolveOrCreateMany).not.toHaveBeenCalled();
    expect(bulkBooksRepository.addTags).not.toHaveBeenCalled();
  });

  it("passes the owned book ids and resolved tag ids to the repository", async () => {
    const { bulkBooksRepository, service, tagsService } = buildService({
      addTags: 2,
      ownedBookIds: [BOOK_A, BOOK_B],
      tagIds: [TAG_ID],
    });
    const input: BulkTagsInput = { bookIds: [BOOK_A, BOOK_B], tags: ["dark academia"] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(USER_ID, ["dark academia"]);
    expect(bulkBooksRepository.addTags).toHaveBeenCalledWith({
      bookIds: [BOOK_A, BOOK_B],
      tagIds: [TAG_ID],
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 2 });
  });
});

describe("BulkBooksService.addToLists", () => {
  it("returns zero affected and skips the repository when no lists resolve", async () => {
    const { bulkBooksRepository, service } = buildService({ listIds: [], ownedBookIds: [BOOK_A] });
    const input: BulkListsInput = { bookIds: [BOOK_A] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(bulkBooksRepository.addToLists).not.toHaveBeenCalled();
  });

  it("creates no lists and skips the repository when no books are owned", async () => {
    const { bulkBooksRepository, listsService, service } = buildService({
      listIds: [LIST_ID],
      ownedBookIds: [],
    });
    const input: BulkListsInput = { bookIds: [BOOK_A], newLists: [{ name: "Summer" }] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(listsService.resolveListsForBook).not.toHaveBeenCalled();
    expect(bulkBooksRepository.addToLists).not.toHaveBeenCalled();
  });

  it("passes the owned book ids and resolved list ids to the repository", async () => {
    const { bulkBooksRepository, listsService, service } = buildService({
      addToLists: 1,
      listIds: [LIST_ID],
      ownedBookIds: [BOOK_A],
    });
    const input: BulkListsInput = { bookIds: [BOOK_A], listIds: [LIST_ID] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(USER_ID, {
      listIds: [LIST_ID],
      newLists: undefined,
    });
    expect(bulkBooksRepository.addToLists).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      listIds: [LIST_ID],
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 1 });
  });
});

describe("BulkBooksService.addToReadingQueue", () => {
  it("queues with the default normal priority and returns the affected count", async () => {
    const { bulkBooksRepository, service } = buildService({ addToReadingQueue: 2 });

    const result = await service.addToReadingQueue({
      input: { bookIds: [BOOK_A, BOOK_B] },
      userId: USER_ID,
    });

    expect(bulkBooksRepository.addToReadingQueue).toHaveBeenCalledWith({
      bookIds: [BOOK_A, BOOK_B],
      queuePriority: "normal",
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 2 });
  });
});

describe("BulkBooksService.setFavorite", () => {
  it("forwards the favorite flag and returns the affected count", async () => {
    const { bulkBooksRepository, service } = buildService({ setFavorite: 3 });

    const result = await service.setFavorite({
      input: { bookIds: [BOOK_A], isFavorite: true },
      userId: USER_ID,
    });

    expect(bulkBooksRepository.setFavorite).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      isFavorite: true,
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 3 });
  });
});

describe("BulkBooksService.setReadingStatus", () => {
  it("clears progress when the new status does not use reading progress", async () => {
    const { bulkBooksRepository, service } = buildService({ setReadingStatus: 1 });
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "not_started" };

    await service.setReadingStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setReadingStatus).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      clearProgress: true,
      readingStatus: "not_started",
      userId: USER_ID,
    });
  });

  it("keeps progress when the new status uses reading progress", async () => {
    const { bulkBooksRepository, service } = buildService({ setReadingStatus: 1 });
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "reading" };

    await service.setReadingStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setReadingStatus).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      clearProgress: false,
      readingStatus: "reading",
      userId: USER_ID,
    });
  });
});

describe("BulkBooksService.setOwnershipStatus", () => {
  it("clears every conditional block when the new status uses none of them", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "none" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      clearDelivery: true,
      clearLoan: true,
      clearPurchase: true,
      ownershipStatus: "none",
      userId: USER_ID,
    });
  });

  it("keeps the purchase block when the new status is owned", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "owned" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: true, clearLoan: true, clearPurchase: false }),
    );
  });

  it("keeps the delivery block when the new status is in_transit", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "in_transit" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: false, clearLoan: true, clearPurchase: true }),
    );
  });

  it("keeps the purchase block when the new status is want_to_buy", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "want_to_buy" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: true, clearLoan: true, clearPurchase: false }),
    );
  });

  it("keeps the loan block when the new status is a loan status", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = {
      bookIds: [BOOK_A],
      ownershipStatus: "borrowed_from_someone",
    };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: true, clearLoan: false, clearPurchase: true }),
    );
  });
});

describe("BulkBooksService.delete", () => {
  it("delegates cover cleanup for each removed cover media id", async () => {
    const { coverCleanup, service } = buildService({
      deleteAffected: 1,
      deleteCoverMediaIds: [MEDIA_ID],
    });

    const result = await service.delete({ input: { bookIds: [BOOK_A] }, userId: USER_ID });

    expect(coverCleanup.deleteIfOrphaned).toHaveBeenCalledWith({
      mediaId: MEDIA_ID,
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 1 });
  });

  it("returns the affected count and attempts no cover cleanup when nothing was deleted", async () => {
    const { coverCleanup, service } = buildService({
      deleteAffected: 0,
      deleteCoverMediaIds: [],
    });

    const result = await service.delete({ input: { bookIds: [BOOK_A] }, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(coverCleanup.deleteIfOrphaned).not.toHaveBeenCalled();
  });
});
