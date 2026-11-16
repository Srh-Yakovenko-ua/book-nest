import type {
  LoanBookPreview,
  LoanHistoryDetailView,
  LoanHistoryListItemView,
  LoanHistoryOverviewQuery,
  LoanHistoryOverviewView,
  LoanHistoryPeopleQuery,
  LoanHistoryPeopleView,
  LoanHistoryPersonOption,
  LoanHistoryPersonStats,
  LoanHistoryQuery,
  Nullable,
  PaginatedLoanHistory,
  UpdateLoanHistoryInput,
} from "@app/shared";

import { LoanTypeSchema, normalizeSearch, OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { isBefore, parseISO } from "date-fns";

import type {
  CompletedLoanWithBook,
  LoanHistoryPersonCountsRow,
  LoanHistoryPersonOptionRow,
  LoanHistoryScope,
} from "../infrastructure/loan-history.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toIsoDate, toNullableIsoDate, toZonedDayStart } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { deriveLoanHistoryOutcome } from "../domain/loan-history-result.js";
import { resolveHistoryLoanPerson } from "../domain/loan-person.js";
import { LoanHistoryRepository } from "../infrastructure/loan-history.repository.js";

const TOP_PEOPLE_LIMIT = 5;

const LOAN_HISTORY_MESSAGE = {
  notFound: "Completed loan not found",
  returnedBeforeLoan: "Returned date cannot be earlier than the loan date",
} as const;

@Injectable()
export class LoanHistoryService {
  constructor(
    private readonly loanHistoryRepository: LoanHistoryRepository,
    private readonly mediaService: MediaService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async correct({
    input,
    loanId,
    userId,
  }: {
    input: UpdateLoanHistoryInput;
    loanId: string;
    userId: string;
  }): Promise<LoanHistoryDetailView> {
    const loan = await this.requireCompletedLoan({ loanId, userId });
    const timeZone = await this.readerTimeZone(userId);
    const returnedAt = toCorrectedReturnedAt({
      loanDate: loan.loanDate,
      returnedDate: input.returnedDate,
      timeZone,
    });

    const corrected = await this.loanHistoryRepository.correct({
      loanId,
      note: input.note,
      returnedAt,
      userId,
    });
    if (corrected === 0) {
      throw new NotFoundError(LOAN_HISTORY_MESSAGE.notFound);
    }

    return this.toDetailView({
      loan: await this.requireCompletedLoan({ loanId, userId }),
      timeZone,
    });
  }

  async detail({
    loanId,
    userId,
  }: {
    loanId: string;
    userId: string;
  }): Promise<LoanHistoryDetailView> {
    const loan = await this.requireCompletedLoan({ loanId, userId });
    const timeZone = await this.readerTimeZone(userId);
    return this.toDetailView({ loan, timeZone });
  }

  async list({
    query,
    userId,
  }: {
    query: LoanHistoryQuery;
    userId: string;
  }): Promise<PaginatedLoanHistory> {
    const timeZone = await this.readerTimeZone(userId);
    const { items, resultCounts, totalCount } = await this.loanHistoryRepository.listHistory({
      ...toHistoryScope({ query, timeZone, userId }),
      result: query.result,
      search: normalizeSearch(query.search),
      sort: query.sort,
      ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
    });

    return {
      ...buildPaginator({
        items: items.map((loan) => this.toListItemView({ loan, timeZone })),
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        totalCount,
      }),
      resultCounts,
    };
  }

  async overview({
    query,
    userId,
  }: {
    query: LoanHistoryOverviewQuery;
    userId: string;
  }): Promise<LoanHistoryOverviewView> {
    const timeZone = await this.readerTimeZone(userId);
    const scope = toHistoryScope({ query, timeZone, userId });
    const [row, topPeople] = await Promise.all([
      this.loanHistoryRepository.overview(scope),
      this.loanHistoryRepository.topPeople({
        ...toHistoryFacetScope({ query, timeZone, userId }),
        take: TOP_PEOPLE_LIMIT,
      }),
    ]);

    const onTimePercent = toOnTimePercent({
      lateCount: row.lateCount,
      onTimeCount: row.onTimeCount,
    });
    const averageDurationDays = toAverage({
      divisor: row.durationCount,
      sum: row.totalDurationDays,
    });

    return {
      duration: {
        averageDays: averageDurationDays,
        longestDays: row.longestDurationDays,
        shortestDays: row.shortestDurationDays,
      },
      reliability: {
        lateCount: row.lateCount,
        noDueDateCount: row.noDueDateCount,
        onTimeCount: row.onTimeCount,
        onTimePercent,
      },
      summary: {
        averageDelayDays: toAverage({ divisor: row.lateCount, sum: row.totalDelayDays }),
        averageDurationDays,
        borrowedCount: row.borrowedCount,
        durationCount: row.durationCount,
        lateCount: row.lateCount,
        lentCount: row.lentCount,
        noDueDateCount: row.noDueDateCount,
        onTimeCount: row.onTimeCount,
        onTimePercent,
        totalCompleted: row.totalCompleted,
      },
      topPeople: topPeople.map((row) => toPersonStats(row)),
    };
  }

  async people({
    query,
    userId,
  }: {
    query: LoanHistoryPeopleQuery;
    userId: string;
  }): Promise<LoanHistoryPeopleView> {
    const timeZone = await this.readerTimeZone(userId);
    const rows = await this.loanHistoryRepository.people({
      ...toHistoryFacetScope({ query, timeZone, userId }),
      limit: query.limit,
      search: normalizeSearch(query.search),
    });
    return { items: rows.map((row) => toPersonOption(row)) };
  }

  private async readerTimeZone(userId: string): Promise<string> {
    const { timezone } = await this.userSettingsContextService.resolve(userId);
    return timezone;
  }

  private async requireCompletedLoan({
    loanId,
    userId,
  }: {
    loanId: string;
    userId: string;
  }): Promise<CompletedLoanWithBook> {
    const loan = await this.loanHistoryRepository.findCompletedById({ loanId, userId });
    if (loan === null) {
      throw new NotFoundError(LOAN_HISTORY_MESSAGE.notFound);
    }
    return loan;
  }

  private toBookPreview(book: CompletedLoanWithBook["book"]): LoanBookPreview {
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

  private toDetailView({
    loan,
    timeZone,
  }: {
    loan: CompletedLoanWithBook;
    timeZone: string;
  }): LoanHistoryDetailView {
    return {
      ...this.toListItemView({ loan, timeZone }),
      contact: resolveHistoryLoanPerson(loan).contact,
      createdAt: loan.createdAt.toISOString(),
      note: loan.note,
      updatedAt: loan.updatedAt.toISOString(),
    };
  }

  private toListItemView({
    loan,
    timeZone,
  }: {
    loan: CompletedLoanWithBook;
    timeZone: string;
  }): LoanHistoryListItemView {
    const { delayDays, durationDays, historyResult, returnedDate } = deriveLoanHistoryOutcome({
      expectedReturnDate: loan.expectedReturnDate,
      loanDate: loan.loanDate,
      returnedAt: loan.returnedAt,
      timeZone,
    });
    const person = resolveHistoryLoanPerson(loan);

    return {
      book: this.toBookPreview(loan.book),
      delayDays,
      durationDays,
      expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
      historyResult,
      id: loan.id,
      loanContactId: person.loanContactId,
      loanDate: toNullableIsoDate(loan.loanDate),
      personName: person.personName,
      returnedAt: loan.returnedAt.toISOString(),
      returnedDate,
      type: LoanTypeSchema.parse(loan.type),
    };
  }
}

function toAverage({ divisor, sum }: { divisor: number; sum: Nullable<number> }): Nullable<number> {
  return divisor === 0 || sum === null ? null : Math.round(sum / divisor);
}

function toCorrectedReturnedAt({
  loanDate,
  returnedDate,
  timeZone,
}: {
  loanDate: Nullable<Date>;
  returnedDate: string | undefined;
  timeZone: string;
}): Date | undefined {
  if (returnedDate === undefined) {
    return undefined;
  }

  if (loanDate !== null && isBefore(parseISO(returnedDate), parseISO(toIsoDate(loanDate)))) {
    throw new BadRequestError(LOAN_HISTORY_MESSAGE.returnedBeforeLoan, {
      fields: [{ field: "returnedDate", message: LOAN_HISTORY_MESSAGE.returnedBeforeLoan }],
    });
  }
  return toZonedDayStart({ isoDate: returnedDate, timeZone });
}

function toHistoryFacetScope({
  query,
  timeZone,
  userId,
}: {
  query: Pick<
    LoanHistoryQuery,
    "loanDateFrom" | "loanDateTo" | "returnedFrom" | "returnedTo" | "type"
  >;
  timeZone: string;
  userId: string;
}): Omit<LoanHistoryScope, "contactId"> {
  return {
    loanDateFrom: query.loanDateFrom,
    loanDateTo: query.loanDateTo,
    returnedFrom: query.returnedFrom,
    returnedTo: query.returnedTo,
    timeZone,
    type: query.type,
    userId,
  };
}

function toHistoryScope({
  query,
  timeZone,
  userId,
}: {
  query: Pick<
    LoanHistoryQuery,
    "contactId" | "loanDateFrom" | "loanDateTo" | "returnedFrom" | "returnedTo" | "type"
  >;
  timeZone: string;
  userId: string;
}): LoanHistoryScope {
  return { ...toHistoryFacetScope({ query, timeZone, userId }), contactId: query.contactId };
}

function toOnTimePercent({
  lateCount,
  onTimeCount,
}: {
  lateCount: number;
  onTimeCount: number;
}): Nullable<number> {
  const withDueDateCount = onTimeCount + lateCount;
  return withDueDateCount === 0 ? null : Math.round((onTimeCount / withDueDateCount) * 100);
}

function toPersonOption(row: LoanHistoryPersonOptionRow): LoanHistoryPersonOption {
  return { contactId: row.contactId, personName: row.name, totalCount: row.totalCount };
}

function toPersonStats(row: LoanHistoryPersonCountsRow): LoanHistoryPersonStats {
  return {
    borrowedCount: row.borrowedCount,
    contactId: row.contactId,
    lentCount: row.lentCount,
    personName: row.name,
    totalCount: row.totalCount,
  };
}
