import type {
  LoanBookPreview,
  LoanDirectionStats,
  LoanListItemView,
  LoansQuery,
  LoansSummaryView,
  LoanType,
  Paginator,
} from "@app/shared";

import {
  LOAN_STATS_WINDOWS,
  LoanTypeSchema,
  normalizeSearch,
  OwnershipStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { subDays } from "date-fns";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { getLoanUiStatus, loanDateBounds } from "../domain/loan-ui-status.js";
import {
  type LoanDirectionCounts,
  LoansRepository,
  type LoanWithBook,
} from "../infrastructure/loans.repository.js";

const EMPTY_DIRECTION_STATS: LoanDirectionStats = {
  earliestLoanDate: null,
  longHeldCount: 0,
  nearestReturnDate: null,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  totalCount: 0,
};

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
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
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
    const { soonEnd, today } = loanDateBounds(new Date());
    const longHeldBefore = subDays(today, LOAN_STATS_WINDOWS.longHeldDays);
    const counts = await this.loansRepository.summary({
      longHeldBefore,
      soonEnd,
      today,
      userId,
    });

    return {
      borrowed: toDirectionStats(counts, "borrowed_from_someone"),
      lent: toDirectionStats(counts, "lent_to_someone"),
    };
  }

  private toBookPreview(book: LoanWithBook["book"]): LoanBookPreview {
    return {
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
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

function toDirectionStats(counts: LoanDirectionCounts[], type: LoanType): LoanDirectionStats {
  const row = counts.find((candidate) => candidate.type === type);
  if (row === undefined) {
    return EMPTY_DIRECTION_STATS;
  }

  return {
    earliestLoanDate: row.earliestLoanDate,
    longHeldCount: row.longHeldCount,
    nearestReturnDate: row.nearestReturnDate,
    noReturnDateCount: row.noReturnDateCount,
    noReturnDatePeopleCount: row.noReturnDatePeopleCount,
    oldestOverdueReturnDate: row.oldestOverdueReturnDate,
    overdueCount: row.overdueCount,
    peopleCount: row.peopleCount,
    returningSoonCount: row.returningSoonCount,
    totalCount: row.totalCount,
  };
}
