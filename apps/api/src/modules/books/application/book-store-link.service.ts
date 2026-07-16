import type {
  BookStoreLinksView,
  BookStoreLinkView,
  CreateBookStoreLinkInput,
  UpdateBookStoreLinkInput,
} from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK, STORE_LINK_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";
import type {
  StoreLinkUpdateData,
  StoreLinkWriteData,
} from "../infrastructure/book-store-link.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { computeBestOffer } from "../domain/best-offer.js";
import { toBookStoreLinkView } from "../domain/book-store-link.mapper.js";
import { BookStoreLinkRepository } from "../infrastructure/book-store-link.repository.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const LINK_NOT_FOUND_MESSAGE = "Store link not found";
const DUPLICATE_URL_MESSAGE = "This book already has a store link with the same URL";
const MAX_LINKS_MESSAGE = "This book has reached the maximum number of store links";

type AddLinkArgs = { bookId: string; input: CreateBookStoreLinkInput; userId: string };

type DeleteLinkArgs = { bookId: string; linkId: string; userId: string };

type EditLinkArgs = {
  bookId: string;
  input: UpdateBookStoreLinkInput;
  linkId: string;
  userId: string;
};

type GetBookStoreLinksArgs = { bookId: string; userId: string };

@Injectable()
export class BookStoreLinkService {
  constructor(
    private readonly bookStoreLinkRepository: BookStoreLinkRepository,
    private readonly booksRepository: BooksRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async addLink({ bookId, input, userId }: AddLinkArgs): Promise<BookStoreLinkView> {
    await this.assertBookOwned({ bookId, userId });
    const data = toCreateData(input);

    const created = await this.transactionRunner.run(async (tx) => {
      const linkCount = await this.bookStoreLinkRepository.countByBook({
        bookId,
        client: tx,
        userId,
      });
      if (linkCount >= MAX_STORE_LINKS_PER_BOOK) {
        throw new ConflictError(MAX_LINKS_MESSAGE, {
          code: STORE_LINK_ERROR_CODES.MAX_LINKS_REACHED,
        });
      }

      const duplicate = await this.bookStoreLinkRepository.findByBookAndUrl({
        bookId,
        client: tx,
        url: data.url,
      });
      if (duplicate !== null) {
        throw new ConflictError(DUPLICATE_URL_MESSAGE, {
          code: STORE_LINK_ERROR_CODES.DUPLICATE_URL,
        });
      }

      return this.createLink({ bookId, client: tx, data, userId });
    });

    return toBookStoreLinkView(created);
  }

  async deleteLink({ bookId, linkId, userId }: DeleteLinkArgs): Promise<void> {
    const existing = await this.bookStoreLinkRepository.findOwnedById({ id: linkId, userId });
    if (existing === null || existing.bookId !== bookId) {
      throw new NotFoundError(LINK_NOT_FOUND_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.LINK_NOT_FOUND,
      });
    }

    const removed = await this.bookStoreLinkRepository.deleteById({ id: linkId, userId });
    if (removed === 0) {
      throw new NotFoundError(LINK_NOT_FOUND_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.LINK_NOT_FOUND,
      });
    }
  }

  async editLink({ bookId, input, linkId, userId }: EditLinkArgs): Promise<BookStoreLinkView> {
    const existing = await this.bookStoreLinkRepository.findOwnedById({ id: linkId, userId });
    if (existing === null || existing.bookId !== bookId) {
      throw new NotFoundError(LINK_NOT_FOUND_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.LINK_NOT_FOUND,
      });
    }

    const data = toUpdateData(input);

    if (data.url !== undefined && data.url !== existing.url) {
      const duplicate = await this.bookStoreLinkRepository.findByBookAndUrl({
        bookId,
        url: data.url,
      });
      if (duplicate !== null && duplicate.id !== linkId) {
        throw new ConflictError(DUPLICATE_URL_MESSAGE, {
          code: STORE_LINK_ERROR_CODES.DUPLICATE_URL,
        });
      }
    }

    const updated = await this.updateLink({ data, id: linkId, userId });
    return toBookStoreLinkView(updated);
  }

  async getBookStoreLinks({ bookId, userId }: GetBookStoreLinksArgs): Promise<BookStoreLinksView> {
    await this.assertBookOwned({ bookId, userId });
    const links = await this.bookStoreLinkRepository.listByBook({ bookId, userId });

    return {
      bestOffer: computeBestOffer({ links }),
      storeLinks: links.map(toBookStoreLinkView),
    };
  }

  private async assertBookOwned({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<void> {
    const owned = await this.booksRepository.existsOwned({ bookId, userId });
    if (!owned) {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.BOOK_NOT_FOUND,
      });
    }
  }

  private async createLink({
    bookId,
    client,
    data,
    userId,
  }: {
    bookId: string;
    client: Prisma.TransactionClient;
    data: StoreLinkWriteData;
    userId: string;
  }): Promise<BookStoreLinkModel> {
    try {
      return await this.bookStoreLinkRepository.create({ bookId, client, data, userId });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(DUPLICATE_URL_MESSAGE, {
          code: STORE_LINK_ERROR_CODES.DUPLICATE_URL,
        });
      }
      throw error;
    }
  }

  private async updateLink({
    data,
    id,
    userId,
  }: {
    data: StoreLinkUpdateData;
    id: string;
    userId: string;
  }): Promise<BookStoreLinkModel> {
    try {
      return await this.bookStoreLinkRepository.update({ data, id, userId });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(DUPLICATE_URL_MESSAGE, {
          code: STORE_LINK_ERROR_CODES.DUPLICATE_URL,
        });
      }
      throw error;
    }
  }
}

function toCreateData(input: CreateBookStoreLinkInput): StoreLinkWriteData {
  return {
    currency: input.currency ?? null,
    price: input.price ?? null,
    storeName: input.storeName,
    url: input.url,
  };
}

function toUpdateData(input: UpdateBookStoreLinkInput): StoreLinkUpdateData {
  const data: StoreLinkUpdateData = {};
  if (input.currency !== undefined) {
    data.currency = input.currency;
  }
  if (input.price !== undefined) {
    data.price = input.price;
  }
  if (input.storeName !== undefined) {
    data.storeName = input.storeName;
  }
  if (input.url !== undefined) {
    data.url = input.url;
  }
  return data;
}
