import type {
  BookQuotesView,
  CreateQuoteInput,
  MediaView,
  Nullable,
  Paginator,
  QuotesQuery,
  QuotesSummaryView,
  QuoteView,
  UpdateQuoteInput,
} from "@app/shared";

import { normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { buildQuotesSummary } from "../domain/quotes-summary.js";
import {
  type OwnedBook,
  QuotesRepository,
  type QuoteWithBook,
  type QuoteWriteData,
} from "../infrastructure/quotes.repository.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const QUOTE_NOT_FOUND_MESSAGE = "Quote not found";
const PAGE_EXCEEDS_BOOK_MESSAGE = "Page must not exceed the book's page count";

const log = createLogger("quotes.view");

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotesRepository: QuotesRepository,
    private readonly mediaService: MediaService,
  ) {}

  async createForBook({
    bookId,
    input,
    userId,
  }: {
    bookId: string;
    input: CreateQuoteInput;
    userId: string;
  }): Promise<QuoteView> {
    const book = await this.findOwnedBookOrThrow(userId, bookId);
    this.assertPageWithinBook(input.page, book.pagesCount);

    const created = await this.quotesRepository.create({
      bookId,
      data: toWriteData(input),
      userId,
    });

    return this.toQuoteView(created);
  }

  async deleteForBook({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<void> {
    await this.findOwnedBookOrThrow(userId, bookId);
    await this.findOwnedQuoteOrThrow({ bookId, quoteId, userId });

    await this.quotesRepository.delete({ quoteId });
  }

  async list({
    query,
    userId,
  }: {
    query: QuotesQuery;
    userId: string;
  }): Promise<Paginator<QuoteView>> {
    const filter = {
      bookId: query.bookId,
      filter: query.filter,
      search: normalizeSearch(query.q),
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.quotesRepository.list({
        ...filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        sort: query.sort,
        take: query.pageSize,
      }),
      this.quotesRepository.count(filter),
    ]);

    return buildPaginator({
      items: items.map((quote) => this.toQuoteView(quote)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async listForBook({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookQuotesView> {
    await this.findOwnedBookOrThrow(userId, bookId);

    const [quotes, counts] = await Promise.all([
      this.quotesRepository.listForBook(userId, bookId),
      this.quotesRepository.bookCounts(userId, bookId),
    ]);

    return {
      favoritesCount: counts.favorites,
      items: quotes.map((quote) => this.toQuoteView(quote)),
      spoilerCount: counts.spoiler,
      totalCount: counts.total,
    };
  }

  async summary({ userId }: { userId: string }): Promise<QuotesSummaryView> {
    return buildQuotesSummary(await this.quotesRepository.summaryData(userId));
  }

  async updateForBook({
    bookId,
    input,
    quoteId,
    userId,
  }: {
    bookId: string;
    input: UpdateQuoteInput;
    quoteId: string;
    userId: string;
  }): Promise<QuoteView> {
    const book = await this.findOwnedBookOrThrow(userId, bookId);
    await this.findOwnedQuoteOrThrow({ bookId, quoteId, userId });
    this.assertPageWithinBook(input.page, book.pagesCount);

    const updated = await this.quotesRepository.update({ data: toWriteData(input), quoteId });

    return this.toQuoteView(updated);
  }

  private assertPageWithinBook(
    page: Nullable<number> | undefined,
    pagesCount: Nullable<number>,
  ): void {
    if (page === null || page === undefined || pagesCount === null) {
      return;
    }
    if (page > pagesCount) {
      throw new BadRequestError(PAGE_EXCEEDS_BOOK_MESSAGE, {
        fields: [{ field: "page", message: PAGE_EXCEEDS_BOOK_MESSAGE }],
      });
    }
  }

  private coverViewOf(coverMedia: QuoteWithBook["book"]["coverMedia"]): Nullable<MediaView> {
    if (coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(coverMedia);
    } catch (error) {
      log.warn({ err: error, mediaId: coverMedia.id }, "failed to build quote cover view");
      return null;
    }
  }

  private async findOwnedBookOrThrow(userId: string, bookId: string): Promise<OwnedBook> {
    const book = await this.quotesRepository.findOwnedBook(userId, bookId);
    if (book === null) {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
    return book;
  }

  private async findOwnedQuoteOrThrow({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<QuoteWithBook> {
    const quote = await this.quotesRepository.findOwnedQuote({ bookId, quoteId, userId });
    if (quote === null) {
      throw new NotFoundError(QUOTE_NOT_FOUND_MESSAGE);
    }
    return quote;
  }

  private toQuoteView(quote: QuoteWithBook): QuoteView {
    return {
      book: {
        cover: this.coverViewOf(quote.book.coverMedia),
        firstAuthorName: quote.book.firstAuthorName,
        id: quote.book.id,
        title: quote.book.title,
      },
      bookId: quote.bookId,
      chapter: quote.chapter,
      comment: quote.comment,
      createdAt: quote.createdAt.toISOString(),
      id: quote.id,
      isFavorite: quote.isFavorite,
      isSpoiler: quote.isSpoiler,
      page: quote.page,
      text: quote.text,
      updatedAt: quote.updatedAt.toISOString(),
    };
  }
}

function normalizeOptionalText(value: Nullable<string> | undefined): Nullable<string> {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toWriteData(input: CreateQuoteInput): QuoteWriteData {
  return {
    chapter: normalizeOptionalText(input.chapter),
    comment: normalizeOptionalText(input.comment),
    isFavorite: input.isFavorite,
    isSpoiler: input.isSpoiler,
    page: input.page ?? null,
    text: input.text,
  };
}
