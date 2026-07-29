import type { PaginatedTrashedQuotes, QuoteDeletionResult, TrashedQuotesQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedQuoteView } from "../domain/trashed-quote.mapper.js";
import { QuotesRepository } from "../infrastructure/quotes.repository.js";
import { QuotePurgeScheduler } from "./quote-purge.scheduler.js";

const QUOTE_NOT_FOUND_MESSAGE = "Quote not found";

@Injectable()
export class QuoteLifecycleService {
  constructor(
    private readonly quotesRepository: QuotesRepository,
    private readonly purgeScheduler: QuotePurgeScheduler,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedQuotesQuery;
    userId: string;
  }): Promise<PaginatedTrashedQuotes> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.quotesRepository.listTrashed({ skip, take, userId }),
      this.quotesRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map(toTrashedQuoteView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ quoteId, userId }: { quoteId: string; userId: string }): Promise<void> {
    const quote = await this.quotesRepository.findForPurge({ quoteId, userId });
    if (quote === null || quote.deletedAt === null) {
      return;
    }

    await this.quotesRepository.hardDeleteIfTrashed({
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
      quoteId,
      userId,
    });
  }

  async restore({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<void> {
    const restored = await this.quotesRepository.restore({ bookId, quoteId, userId });
    if (restored === 0) {
      throw new NotFoundError(QUOTE_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.cancel(quoteId);
  }

  async softDelete({
    quoteId,
    userId,
  }: {
    quoteId: string;
    userId: string;
  }): Promise<QuoteDeletionResult> {
    const deletedAt = new Date();
    const affected = await this.quotesRepository.softDelete({ deletedAt, quoteId, userId });
    if (affected === 0) {
      throw new NotFoundError(QUOTE_NOT_FOUND_MESSAGE);
    }

    await this.purgeScheduler.schedule({ quoteId, userId });

    return {
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
      quoteId,
    };
  }
}
