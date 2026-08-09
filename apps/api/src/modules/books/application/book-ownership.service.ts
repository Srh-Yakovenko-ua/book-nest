import type {
  BookView,
  CreateBookStoreLinkInput,
  MarkBoughtInput,
  OwnershipStatus,
  WantToBuyInput,
} from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK, STORE_LINK_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { OwnershipChangePatch } from "../infrastructure/books.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { computeOwnershipChange } from "../domain/ownership-transition.js";
import { BookStoreLinkRepository } from "../infrastructure/book-store-link.repository.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const MARK_OWNED_MESSAGE =
  'Book must have ownership status "none" or "want_to_buy" to be marked as owned';
const REMOVE_OWNED_MESSAGE = 'Book must have ownership status "owned" to remove ownership';
const WANT_TO_BUY_MESSAGE = 'Book must have ownership status "none" to be marked as want to buy';
const MARK_BOUGHT_MESSAGE = 'Book must have ownership status "want_to_buy" to be marked as bought';
const STORE_LINK_LIMIT_MESSAGE = `A book can track at most ${MAX_STORE_LINKS_PER_BOOK} store links`;
const REMOVE_FROM_WISHLIST_MESSAGE =
  'Book must have ownership status "want_to_buy" to be removed from the wishlist';

@Injectable()
export class BookOwnershipService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookStoreLinkRepository: BookStoreLinkRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async markBought(userId: string, bookId: string, input: MarkBoughtInput): Promise<BookView> {
    const conflictError = new ConflictError(MARK_BOUGHT_MESSAGE, {
      code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
    });
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const date = input.purchasedAt ?? this.todayIso();
    const patch = computeOwnershipChange({ date, fields: input, kind: "mark-bought" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async markOwned(userId: string, bookId: string): Promise<BookView> {
    const conflictError = new ConflictError(MARK_OWNED_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "none" && book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "mark-owned" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["none", "want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeFromWishlist({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookView> {
    const conflictError = new ConflictError(REMOVE_FROM_WISHLIST_MESSAGE, {
      code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
    });
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "remove-from-wishlist" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeOwned(userId: string, bookId: string): Promise<BookView> {
    const conflictError = new ConflictError(REMOVE_OWNED_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "owned") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "remove-owned" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["owned"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async wantToBuy(userId: string, bookId: string, input: WantToBuyInput): Promise<BookView> {
    const conflictError = new ConflictError(WANT_TO_BUY_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "none") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "want-to-buy", now: new Date() });
    await this.transactionRunner.run(async (tx) => {
      const outcome = await this.booksRepository.applyOwnershipChange(
        userId,
        bookId,
        patch,
        { expectedStatuses: ["none"] },
        tx,
      );
      if (outcome === "not-found") {
        throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
      }
      if (outcome === "status-conflict") {
        throw conflictError;
      }
      if (input.storeLink !== undefined) {
        await this.upsertStoreLink({ bookId, client: tx, input: input.storeLink, userId });
      }
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async applyGuardedOwnershipChange({
    bookId,
    conflictError,
    expectedStatuses,
    patch,
    userId,
  }: {
    bookId: string;
    conflictError: ConflictError;
    expectedStatuses: OwnershipStatus[];
    patch: OwnershipChangePatch;
    userId: string;
  }): Promise<void> {
    const outcome = await this.booksRepository.applyOwnershipChange(userId, bookId, patch, {
      expectedStatuses,
    });
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
    if (outcome === "status-conflict") {
      throw conflictError;
    }
  }

  private todayIso(): string {
    return toIsoDate(new Date());
  }

  private async upsertStoreLink({
    bookId,
    client,
    input,
    userId,
  }: {
    bookId: string;
    client: Prisma.TransactionClient;
    input: CreateBookStoreLinkInput;
    userId: string;
  }): Promise<void> {
    await this.bookStoreLinkRepository.acquireBookStoreLinkLock({ bookId, client });

    const existing = await this.bookStoreLinkRepository.findByBookAndUrl({
      bookId,
      client,
      url: input.url,
    });
    if (existing !== null) {
      await this.bookStoreLinkRepository.update({
        client,
        data: { currency: input.currency ?? null, price: input.price ?? null },
        id: existing.id,
        userId,
      });
      return;
    }

    const count = await this.bookStoreLinkRepository.countByBook({ bookId, client, userId });
    if (count >= MAX_STORE_LINKS_PER_BOOK) {
      throw new ConflictError(STORE_LINK_LIMIT_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.MAX_LINKS_REACHED,
      });
    }

    await this.bookStoreLinkRepository.create({
      bookId,
      client,
      data: {
        currency: input.currency ?? null,
        price: input.price ?? null,
        storeName: input.storeName,
        url: input.url,
      },
      userId,
    });
  }
}
