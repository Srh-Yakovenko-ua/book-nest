import type { BookView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { GuardedChangeOutcome } from "../infrastructure/books.repository.js";
import type { BooksRepository } from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { computeOwnershipChange } from "../domain/ownership-transition.js";
import { BookStoreLinkRepository } from "../infrastructure/book-store-link.repository.js";
import { BookOwnershipService } from "./book-ownership.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";

const VIEW = { id: BOOK_ID } as unknown as BookView;

function setup(ownershipStatus: string, outcome: GuardedChangeOutcome = "applied") {
  const findOwnedByIdOrThrow = vi.fn().mockResolvedValue({ ownershipStatus });
  const applyOwnershipChange = vi.fn().mockResolvedValue(outcome);
  const booksRepository = {
    applyOwnershipChange,
    findOwnedByIdOrThrow,
  } as unknown as BooksRepository;
  const loadView = vi.fn().mockResolvedValue(VIEW);
  const viewAssembler = { loadView } as unknown as BookViewAssembler;

  const storeLinkRepository = {
    acquireBookStoreLinkLock: vi.fn().mockResolvedValue(undefined),
    countByBook: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({}),
    findByBookAndUrl: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as BookStoreLinkRepository;
  const transactionRunner = {
    run: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
  } as unknown as TransactionRunner;

  const service = new BookOwnershipService(
    booksRepository,
    storeLinkRepository,
    transactionRunner,
    viewAssembler,
  );

  return { applyOwnershipChange, loadView, service, storeLinkRepository };
}

describe("BookOwnershipService.removeFromWishlist", () => {
  it("transitions a want-to-buy book to none and returns the reloaded view", async () => {
    const { applyOwnershipChange, loadView, service } = setup("want_to_buy");

    const result = await service.removeFromWishlist({ bookId: BOOK_ID, userId: USER_ID });

    expect(applyOwnershipChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      {
        book: { ownershipStatus: "none", wishlistAddedAt: null },
        purchaseInfo: "delete",
      },
      { expectedStatuses: ["want_to_buy"] },
    );
    expect(loadView).toHaveBeenCalledWith({ bookId: BOOK_ID, userId: USER_ID });
    expect(result).toBe(VIEW);
  });

  it("applies the same ownership patch as remove-owned", async () => {
    const { applyOwnershipChange, service } = setup("want_to_buy");

    await service.removeFromWishlist({ bookId: BOOK_ID, userId: USER_ID });

    expect(applyOwnershipChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      computeOwnershipChange({ kind: "remove-owned" }),
      { expectedStatuses: ["want_to_buy"] },
    );
  });

  it("surfaces a NOT_IN_WISHLIST conflict when the guarded write loses the status race", async () => {
    const { service } = setup("want_to_buy", "status-conflict");

    const result = service.removeFromWishlist({ bookId: BOOK_ID, userId: USER_ID });

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({ code: "NOT_IN_WISHLIST" });
  });

  it("surfaces a NotFoundError when the guarded write finds the book gone", async () => {
    const { service } = setup("want_to_buy", "not-found");

    await expect(
      service.removeFromWishlist({ bookId: BOOK_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(["owned", "none", "in_transit"])(
    "throws a NOT_IN_WISHLIST conflict when the book is %s and leaves the book untouched",
    async (ownershipStatus) => {
      const { applyOwnershipChange, service } = setup(ownershipStatus);

      const result = service.removeFromWishlist({ bookId: BOOK_ID, userId: USER_ID });

      await expect(result).rejects.toBeInstanceOf(ConflictError);
      await expect(result).rejects.toMatchObject({ code: "NOT_IN_WISHLIST" });
      expect(applyOwnershipChange).not.toHaveBeenCalled();
    },
  );
});

describe("BookOwnershipService.markBought", () => {
  it("throws a NOT_IN_WISHLIST conflict when the book is no longer in the wishlist", async () => {
    const { applyOwnershipChange, service } = setup("owned");

    const result = service.markBought(USER_ID, BOOK_ID, {});

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({ code: "NOT_IN_WISHLIST" });
    expect(applyOwnershipChange).not.toHaveBeenCalled();
  });
});
