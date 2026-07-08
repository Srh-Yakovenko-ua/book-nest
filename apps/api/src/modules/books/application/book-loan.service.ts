import type { BookView, CreateLoanInput, LoanDirection, OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema, ownershipStatusUsesLoan } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { computeLoanChange } from "../domain/loan-transition.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BORROW_REQUIRES_NONE_MESSAGE = 'Book must have ownership status "none" to be borrowed';
const LEND_REQUIRES_OWNED_MESSAGE = 'Book must have ownership status "owned" to be lent';
const RETURN_REQUIRES_LOAN_MESSAGE = "Book must be borrowed or lent to be returned";
const ACTIVE_LOAN_EXISTS_MESSAGE = "This book already has an active loan";

@Injectable()
export class BookLoanService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async createLoan(userId: string, bookId: string, input: CreateLoanInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertLoanPrecondition(book, input.direction);

    const patch = computeLoanChange({ fields: input, kind: "create", today: this.todayIso() });
    try {
      await this.booksRepository.applyLoanChange(userId, bookId, patch);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(ACTIVE_LOAN_EXISTS_MESSAGE);
      }
      throw error;
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async returnLoan(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE);
    }

    const patch = computeLoanChange({ kind: "return", now: new Date(), ownershipStatus });
    await this.booksRepository.applyLoanChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private assertLoanPrecondition(book: BookWithRelations, direction: LoanDirection): void {
    const required: OwnershipStatus = direction === "borrowed" ? "none" : "owned";
    if (book.ownershipStatus !== required) {
      throw new ConflictError(
        direction === "borrowed" ? BORROW_REQUIRES_NONE_MESSAGE : LEND_REQUIRES_OWNED_MESSAGE,
      );
    }
  }

  private todayIso(): string {
    return toIsoDate(new Date());
  }
}
