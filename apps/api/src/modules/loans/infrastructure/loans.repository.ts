import type { LoanFilter, LoanSort, LoanType } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const loanBookInclude = {
  include: { book: { include: { coverMedia: true, publisher: true } } },
} satisfies Prisma.BookLoanDefaultArgs;

export type LoansFilterInput = {
  filter: LoanFilter;
  search: string | undefined;
  soonEnd: Date;
  today: Date;
  type: LoanType | undefined;
  userId: string;
};

export type LoanSummaryCounts = {
  borrowedCount: number;
  lentCount: number;
  overdueCount: number;
  returnThisWeek: number;
  withoutReturnDate: number;
  withReminder: number;
};

export type LoanWithBook = Prisma.BookLoanGetPayload<typeof loanBookInclude>;

type ListLoansInput = LoansFilterInput & {
  skip: number;
  sort: LoanSort;
  take: number;
};

type SummaryInput = {
  today: Date;
  userId: string;
  weekEnd: Date;
  weekStart: Date;
};

@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  countLoans(input: LoansFilterInput): Promise<number> {
    return this.prisma.bookLoan.count({ where: buildLoansWhere(input) });
  }

  listLoans({ skip, sort, take, ...filter }: ListLoansInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildLoansWhere(filter),
      ...loanBookInclude,
    });
  }

  async summary({ today, userId, weekEnd, weekStart }: SummaryInput): Promise<LoanSummaryCounts> {
    const base: Prisma.BookLoanWhereInput = { status: "active", userId };

    const [
      borrowedCount,
      lentCount,
      overdueCount,
      returnThisWeek,
      withReminder,
      withoutReturnDate,
    ] = await Promise.all([
      this.prisma.bookLoan.count({ where: { ...base, type: "borrowed_from_someone" } }),
      this.prisma.bookLoan.count({ where: { ...base, type: "lent_to_someone" } }),
      this.prisma.bookLoan.count({ where: { ...base, expectedReturnDate: { lt: today } } }),
      this.prisma.bookLoan.count({
        where: { ...base, expectedReturnDate: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.bookLoan.count({ where: { ...base, remindToReturn: true } }),
      this.prisma.bookLoan.count({ where: { ...base, expectedReturnDate: null } }),
    ]);

    return {
      borrowedCount,
      lentCount,
      overdueCount,
      returnThisWeek,
      withoutReturnDate,
      withReminder,
    };
  }
}

const ID_TIEBREAKER: Prisma.BookLoanOrderByWithRelationInput = { id: "asc" };

const RETURN_DATE_ORDER: Prisma.BookLoanOrderByWithRelationInput[] = [
  { expectedReturnDate: { nulls: "last", sort: "asc" } },
  { loanDate: { nulls: "last", sort: "desc" } },
  ID_TIEBREAKER,
];

const LOAN_SORT_ORDER_BY: Record<LoanSort, Prisma.BookLoanOrderByWithRelationInput[]> = {
  author: [{ book: { firstAuthorName: "asc" } }, ID_TIEBREAKER],
  loan_date: [{ loanDate: { nulls: "last", sort: "desc" } }, ID_TIEBREAKER],
  overdue_first: RETURN_DATE_ORDER,
  person: [{ personName: "asc" }, ID_TIEBREAKER],
  return_date: RETURN_DATE_ORDER,
  return_soonest: RETURN_DATE_ORDER,
  title: [{ book: { title: "asc" } }, ID_TIEBREAKER],
};

function applyLoanFilter({
  filter,
  soonEnd,
  today,
  where,
}: {
  filter: LoanFilter;
  soonEnd: Date;
  today: Date;
  where: Prisma.BookLoanWhereInput;
}): void {
  switch (filter) {
    case "all":
      return;
    case "has_reminder":
      where.remindToReturn = true;
      return;
    case "no_return_date":
      where.expectedReturnDate = null;
      return;
    case "overdue":
      where.expectedReturnDate = { lt: today };
      return;
    case "return_soon":
      where.expectedReturnDate = { gte: today, lte: soonEnd };
      return;
    case "without_reminder":
      where.remindToReturn = false;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildLoanSearchConditions(search: string): Prisma.BookLoanWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  return [
    { book: { title: contains } },
    { book: { originalTitle: contains } },
    { book: { firstAuthorName: contains } },
    { personName: contains },
    { contact: contains },
    { note: contains },
  ];
}

function buildLoansWhere({
  filter,
  search,
  soonEnd,
  today,
  type,
  userId,
}: LoansFilterInput): Prisma.BookLoanWhereInput {
  const where: Prisma.BookLoanWhereInput = { status: "active", userId };

  if (type !== undefined) {
    where.type = type;
  }

  applyLoanFilter({ filter, soonEnd, today, where });

  if (search !== undefined) {
    where.OR = buildLoanSearchConditions(search);
  }

  return where;
}
