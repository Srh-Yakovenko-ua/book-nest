import type { BookView, CreateLoanInput, LoanDirection, OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema, ownershipStatusUsesLoan } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { computeLoanChange } from "../domain/loan-transition.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BooksService } from "./books.service.js";

const BORROW_REQUIRES_NONE_MESSAGE = 'Book must have ownership status "none" to be borrowed';
const LEND_REQUIRES_OWNED_MESSAGE = 'Book must have ownership status "owned" to be lent';
const RETURN_REQUIRES_LOAN_MESSAGE = "Book must be borrowed or lent to be returned";

@Injectable()
export class BookLoanService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly booksService: BooksService,
  ) {}

  async createLoan(userId: string, bookId: string, input: CreateLoanInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertLoanPrecondition(book, input.direction);

    const patch = computeLoanChange({ fields: input, kind: "create", today: this.todayIso() });
    await this.booksRepository.applyLoanChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
  }

  async returnLoan(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE);
    }

    const patch = computeLoanChange({ kind: "return", ownershipStatus });
    await this.booksRepository.applyLoanChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
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
