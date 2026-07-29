import type { LoanFilter, LoanSort, LoanType } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookTextSearchConditions } from "../../books/index.js";

const LOAN_STATUS_ACTIVE = "active";
const LOAN_TYPE_BORROWED = "borrowed_from_someone";
const LOAN_TYPE_LENT = "lent_to_someone";

const LoanSummaryCountsRowSchema = z.object({
  borrowedCount: z.number(),
  lentCount: z.number(),
  overdueCount: z.number(),
  returnThisWeek: z.number(),
  withoutReturnDate: z.number(),
  withReminder: z.number(),
});

const EMPTY_LOAN_COUNTS: z.infer<typeof LoanSummaryCountsRowSchema> = {
  borrowedCount: 0,
  lentCount: 0,
  overdueCount: 0,
  returnThisWeek: 0,
  withoutReturnDate: 0,
  withReminder: 0,
};

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
    const todayIso = toIsoDate(today);
    const weekStartIso = toIsoDate(weekStart);
    const weekEndIso = toIsoDate(weekEnd);

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_BORROWED}))::int AS "borrowedCount",
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_LENT}))::int AS "lentCount",
        (count(*) FILTER (WHERE loan.expected_return_date < ${todayIso}::date))::int AS "overdueCount",
        (count(*) FILTER (
          WHERE loan.expected_return_date >= ${weekStartIso}::date
            AND loan.expected_return_date <= ${weekEndIso}::date
        ))::int AS "returnThisWeek",
        (count(*) FILTER (WHERE loan.remind_to_return = true))::int AS "withReminder",
        (count(*) FILTER (WHERE loan.expected_return_date IS NULL))::int AS "withoutReturnDate"
      FROM book_loans loan
      JOIN books book ON book.id = loan.book_id
      WHERE loan.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
        AND loan.status = ${LOAN_STATUS_ACTIVE}
    `);

    return z.array(LoanSummaryCountsRowSchema).parse(rows)[0] ?? EMPTY_LOAN_COUNTS;
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
    ...buildBookTextSearchConditions(search).map((condition) => ({ book: condition })),
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
  const where: Prisma.BookLoanWhereInput = {
    book: SOFT_DELETE_SCOPE.active,
    status: "active",
    userId,
  };

  if (type !== undefined) {
    where.type = type;
  }

  applyLoanFilter({ filter, soonEnd, today, where });

  if (search !== undefined) {
    where.OR = buildLoanSearchConditions(search);
  }

  return where;
}
