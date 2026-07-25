import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { BooksRepository } from "../infrastructure/books.repository.js";
import { assertBookOwned } from "./assert-book-owned.js";

@Injectable()
export class BookAccessService {
  constructor(private readonly booksRepository: BooksRepository) {}

  assertOwned({
    bookId,
    notFoundCode,
    userId,
  }: {
    bookId: string;
    notFoundCode?: string;
    userId: string;
  }): Promise<void> {
    return assertBookOwned({
      bookId,
      booksRepository: this.booksRepository,
      notFoundCode,
      userId,
    });
  }

  findOwnedByIdOrThrow({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookWithRelations> {
    return this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
  }

  maxQueuePosition({
    client,
    userId,
  }: {
    client?: Prisma.TransactionClient;
    userId: string;
  }): Promise<number> {
    return this.booksRepository.maxQueuePosition(userId, client);
  }
}
