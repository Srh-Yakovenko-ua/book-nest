import type {
  BookQuotesView,
  CreateQuoteInput,
  Nullable,
  Paginator,
  QuoteDeletionResult,
  QuotesFacetsQuery,
  QuotesFacetsView,
  QuotesQuery,
  QuotesSummaryView,
  QuoteView,
  UpdateQuoteInput,
} from "@app/shared";

import { normalizeSearch, toQuoteBookIds } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { normalizeOptionalQuoteText } from "../domain/quote-text.js";
import { toQuoteView } from "../domain/quote.mapper.js";
import { buildQuotesFacets, toAuthorFacets, toBookFacets } from "../domain/quotes-facets.js";
import { buildQuotesSummary } from "../domain/quotes-summary.js";
import {
  type OwnedBook,
  type QuotesDatasetInput,
  QuotesRepository,
  type QuoteUpdateData,
  type QuoteWithBook,
  type QuoteWriteData,
} from "../infrastructure/quotes.repository.js";
import { QuoteLifecycleService } from "./quote-lifecycle.service.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const QUOTE_NOT_FOUND_MESSAGE = "Quote not found";
const PAGE_EXCEEDS_BOOK_MESSAGE = "Page must not exceed the book's page count";

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotesRepository: QuotesRepository,
    private readonly mediaService: MediaService,
    private readonly lifecycleService: QuoteLifecycleService,
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

    return this.toView(created);
  }

  async deleteForBook({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<QuoteDeletionResult> {
    await this.findOwnedBookOrThrow(userId, bookId);
    await this.findOwnedQuoteOrThrow({ bookId, quoteId, userId });

    return this.lifecycleService.softDelete({ quoteId, userId });
  }

  async facets({
    query,
    userId,
  }: {
    query: QuotesFacetsQuery;
    userId: string;
  }): Promise<QuotesFacetsView> {
    const dataset = toQuotesDataset(query, userId);

    const [counts, bookCounts, authorBookCounts] = await Promise.all([
      this.quotesRepository.filterCounts(dataset),
      this.quotesRepository.bookQuoteCounts({ ...dataset, bookIds: undefined }),
      this.quotesRepository.bookQuoteCounts({ ...dataset, authorIds: undefined }),
    ]);

    const links = await this.quotesRepository.authorQuoteLinks(
      authorBookCounts.map((entry) => entry.bookId),
    );

    return buildQuotesFacets({
      authors: toAuthorFacets({ bookCounts: authorBookCounts, links }),
      books: toBookFacets(bookCounts),
      counts,
    });
  }

  async list({
    query,
    userId,
  }: {
    query: QuotesQuery;
    userId: string;
  }): Promise<Paginator<QuoteView>> {
    const filter = { ...toQuotesDataset(query, userId), filter: query.filter };

    const [items, totalCount] = await Promise.all([
      this.quotesRepository.list({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.quotesRepository.count(filter),
    ]);

    return buildPaginator({
      items: items.map((quote) => this.toView(quote)),
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
      items: quotes.map((quote) => this.toView(quote)),
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
    const quote = await this.findOwnedQuoteOrThrow({ bookId, quoteId, userId });
    this.assertPageWithinBook(input.page, quote.book.pagesCount);

    const updated = await this.quotesRepository.update({ data: toUpdateData(input), quoteId });

    return this.toView(updated);
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

  private toView(quote: QuoteWithBook): QuoteView {
    return toQuoteView({ cover: this.mediaService.buildViewOrNull(quote.book.coverMedia), quote });
  }
}

function toQuotesDataset(query: QuotesFacetsQuery, userId: string): QuotesDatasetInput {
  return {
    authorIds: query.author,
    bookIds: toQuoteBookIds(query),
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
    search: normalizeSearch(query.q),
    userId,
  };
}

function toUpdateData(input: UpdateQuoteInput): QuoteUpdateData {
  const data: QuoteUpdateData = {};
  if (input.chapter !== undefined) {
    data.chapter = normalizeOptionalQuoteText(input.chapter);
  }
  if (input.comment !== undefined) {
    data.comment = normalizeOptionalQuoteText(input.comment);
  }
  if (input.isFavorite !== undefined) {
    data.isFavorite = input.isFavorite;
  }
  if (input.isSpoiler !== undefined) {
    data.isSpoiler = input.isSpoiler;
  }
  if (input.page !== undefined) {
    data.page = input.page;
  }
  if (input.text !== undefined) {
    data.text = input.text;
  }
  return data;
}

function toWriteData(input: CreateQuoteInput): QuoteWriteData {
  return {
    chapter: normalizeOptionalQuoteText(input.chapter),
    comment: normalizeOptionalQuoteText(input.comment),
    isFavorite: input.isFavorite,
    isSpoiler: input.isSpoiler,
    page: input.page ?? null,
    text: input.text,
  };
}
