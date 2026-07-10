import type {
  LoanBookPreview,
  LoanListItemView,
  LoansQuery,
  LoansSummaryView,
  Paginator,
} from "@app/shared";

import { LoanTypeSchema, normalizeSearch, OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { getLoanUiStatus, loanDateBounds } from "../domain/loan-ui-status.js";
import { LoansRepository, type LoanWithBook } from "../infrastructure/loans.repository.js";

const log = createLogger("loans.view");

@Injectable()
export class LoansService {
  constructor(
    private readonly loansRepository: LoansRepository,
    private readonly mediaService: MediaService,
  ) {}

  async list({
    query,
    userId,
  }: {
    query: LoansQuery;
    userId: string;
  }): Promise<Paginator<LoanListItemView>> {
    const { soonEnd, today } = loanDateBounds(new Date());
    const search = normalizeSearch(query.search);
    const filter = {
      filter: query.filter,
      search,
      soonEnd,
      today,
      type: query.type,
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.loansRepository.listLoans({
        ...filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        sort: query.sort,
        take: query.pageSize,
      }),
      this.loansRepository.countLoans(filter),
    ]);

    return buildPaginator({
      items: items.map((loan) => this.toListItemView(loan, today)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async summary({ userId }: { userId: string }): Promise<LoansSummaryView> {
    const { today, weekEnd, weekStart } = loanDateBounds(new Date());
    const counts = await this.loansRepository.summary({ today, userId, weekEnd, weekStart });

    return {
      borrowedCount: counts.borrowedCount,
      lentCount: counts.lentCount,
      overdueCount: counts.overdueCount,
      returnThisWeek: counts.returnThisWeek,
      withoutReturnDate: counts.withoutReturnDate,
      withReminder: counts.withReminder,
    };
  }

  private coverViewOf(coverMedia: LoanWithBook["book"]["coverMedia"]): LoanBookPreview["cover"] {
    if (coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(coverMedia);
    } catch (error) {
      log.warn({ err: error, mediaId: coverMedia.id }, "failed to build loan cover view");
      return null;
    }
  }

  private toBookPreview(book: LoanWithBook["book"]): LoanBookPreview {
    return {
      cover: this.coverViewOf(book.coverMedia),
      firstAuthorName: book.firstAuthorName,
      id: book.id,
      originalTitle: book.originalTitle,
      ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
      publisher:
        book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
      title: book.title,
    };
  }

  private toListItemView(loan: LoanWithBook, today: Date): LoanListItemView {
    return {
      book: this.toBookPreview(loan.book),
      contact: loan.contact,
      createdAt: loan.createdAt.toISOString(),
      expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
      id: loan.id,
      loanDate: toNullableIsoDate(loan.loanDate),
      loanUiStatus: getLoanUiStatus({ expectedReturnDate: loan.expectedReturnDate, today }),
      note: loan.note,
      personName: loan.personName,
      remindToReturn: loan.remindToReturn,
      type: LoanTypeSchema.parse(loan.type),
      updatedAt: loan.updatedAt.toISOString(),
    };
  }
}
