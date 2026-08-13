import type {
  LoanBookPreview,
  LoanDirectionSummary,
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

const SIDEBAR_LOANS_LIMIT = 5;

type DirectionLoanLists = Pick<LoanDirectionSummary, "longHeldLoans" | "upcomingReturns">;

const EMPTY_DIRECTION_COUNTS = {
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
} satisfies Omit<LoanDirectionSummary, "longHeldLoans" | "upcomingReturns">;

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

    const [counts, borrowedLoans, lentLoans] = await Promise.all([
      this.loansRepository.summary({ longHeldBefore, soonEnd, today, userId }),
      this.sidebarLoans({ longHeldBefore, today, type: "borrowed_from_someone", userId }),
      this.sidebarLoans({ longHeldBefore, today, type: "lent_to_someone", userId }),
    ]);

    return {
      borrowed: toDirectionSummary(counts, "borrowed_from_someone", borrowedLoans),
      lent: toDirectionSummary(counts, "lent_to_someone", lentLoans),
    };
  }

  private async sidebarLoans({
    longHeldBefore,
    today,
    type,
    userId,
  }: {
    longHeldBefore: Date;
    today: Date;
    type: LoanType;
    userId: string;
  }): Promise<DirectionLoanLists> {
    const [longHeldLoans, upcomingReturns] = await Promise.all([
      this.loansRepository.longHeldLoans({
        loanedBefore: longHeldBefore,
        take: SIDEBAR_LOANS_LIMIT,
        type,
        userId,
      }),
      this.loansRepository.upcomingReturns({ take: SIDEBAR_LOANS_LIMIT, today, type, userId }),
    ]);

    return {
      longHeldLoans: longHeldLoans.map((loan) => this.toListItemView(loan, today)),
      upcomingReturns: upcomingReturns.map((loan) => this.toListItemView(loan, today)),
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

function toDirectionSummary(
  counts: LoanDirectionCounts[],
  type: LoanType,
  loans: DirectionLoanLists,
): LoanDirectionSummary {
  const row = counts.find((candidate) => candidate.type === type);
  if (row === undefined) {
    return { ...EMPTY_DIRECTION_COUNTS, ...loans };
  }

  return {
    earliestLoanDate: row.earliestLoanDate,
    longHeldCount: row.longHeldCount,
    longHeldLoans: loans.longHeldLoans,
    nearestReturnDate: row.nearestReturnDate,
    noReturnDateCount: row.noReturnDateCount,
    noReturnDatePeopleCount: row.noReturnDatePeopleCount,
    oldestOverdueReturnDate: row.oldestOverdueReturnDate,
    overdueCount: row.overdueCount,
    peopleCount: row.peopleCount,
    returningSoonCount: row.returningSoonCount,
    totalCount: row.totalCount,
    upcomingReturns: loans.upcomingReturns,
  };
}
