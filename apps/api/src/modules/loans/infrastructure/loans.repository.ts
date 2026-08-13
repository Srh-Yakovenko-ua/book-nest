import type { LoanFilter, LoanSort, LoanType } from "@app/shared";

import { LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookTextSearchConditions } from "../../books/index.js";

const LOAN_STATUS_ACTIVE = "active";

const LoanDirectionCountsRowSchema = z.object({
  earliestLoanDate: z.string().nullable(),
  longHeldCount: z.number(),
  nearestReturnDate: z.string().nullable(),
  noReturnDateCount: z.number(),
  noReturnDatePeopleCount: z.number(),
  oldestOverdueReturnDate: z.string().nullable(),
  overdueCount: z.number(),
  peopleCount: z.number(),
  returningSoonCount: z.number(),
  totalCount: z.number(),
  type: LoanTypeSchema,
});

const loanBookInclude = {
  include: { book: { include: { coverMedia: true, publisher: true } } },
} satisfies Prisma.BookLoanDefaultArgs;

export type LoanDirectionCounts = z.infer<typeof LoanDirectionCountsRowSchema>;

export type LoansFilterInput = {
  filter: LoanFilter;
  search: string | undefined;
  soonEnd: Date;
  today: Date;
  type: LoanType | undefined;
  userId: string;
};

export type LoanWithBook = Prisma.BookLoanGetPayload<typeof loanBookInclude>;

type ListLoansInput = LoansFilterInput & {
  skip: number;
  sort: LoanSort;
  take: number;
};

type LongHeldLoansInput = {
  loanedBefore: Date;
  take: number;
  type: LoanType;
  userId: string;
};

type SummaryInput = {
  longHeldBefore: Date;
  soonEnd: Date;
  today: Date;
  userId: string;
};

type UpcomingReturnsInput = {
  take: number;
  today: Date;
  type: LoanType;
  userId: string;
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

  longHeldLoans({ loanedBefore, take, type, userId }: LongHeldLoansInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_DATE_ASC_ORDER,
      take,
      where: {
        ...buildActiveLoansWhere({ type, userId }),
        loanDate: { lte: loanedBefore },
      },
      ...loanBookInclude,
    });
  }

  async summary({
    longHeldBefore,
    soonEnd,
    today,
    userId,
  }: SummaryInput): Promise<LoanDirectionCounts[]> {
    const todayIso = toIsoDate(today);
    const soonEndIso = toIsoDate(soonEnd);
    const longHeldBeforeIso = toIsoDate(longHeldBefore);

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        loan.type AS "type",
        (count(*))::int AS "totalCount",
        (count(DISTINCT loan.person_name))::int AS "peopleCount",
        (count(*) FILTER (
          WHERE loan.expected_return_date >= ${todayIso}::date
            AND loan.expected_return_date <= ${soonEndIso}::date
        ))::int AS "returningSoonCount",
        to_char(
          min(loan.expected_return_date) FILTER (
            WHERE loan.expected_return_date >= ${todayIso}::date
          ),
          'YYYY-MM-DD'
        ) AS "nearestReturnDate",
        (count(*) FILTER (WHERE loan.expected_return_date < ${todayIso}::date))::int AS "overdueCount",
        to_char(
          min(loan.expected_return_date) FILTER (
            WHERE loan.expected_return_date < ${todayIso}::date
          ),
          'YYYY-MM-DD'
        ) AS "oldestOverdueReturnDate",
        (count(*) FILTER (
          WHERE loan.loan_date <= ${longHeldBeforeIso}::date
        ))::int AS "longHeldCount",
        to_char(min(loan.loan_date), 'YYYY-MM-DD') AS "earliestLoanDate",
        (count(*) FILTER (WHERE loan.expected_return_date IS NULL))::int AS "noReturnDateCount",
        (count(DISTINCT loan.person_name) FILTER (
          WHERE loan.expected_return_date IS NULL
        ))::int AS "noReturnDatePeopleCount"
      FROM book_loans loan
      JOIN books book ON book.id = loan.book_id
      WHERE loan.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
        AND loan.status = ${LOAN_STATUS_ACTIVE}
      GROUP BY loan.type
    `);

    return z.array(LoanDirectionCountsRowSchema).parse(rows);
  }

  upcomingReturns({ take, today, type, userId }: UpcomingReturnsInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_SORT_ORDER_BY.return_date,
      take,
      where: {
        ...buildActiveLoansWhere({ type, userId }),
        expectedReturnDate: { gte: today },
      },
      ...loanBookInclude,
    });
  }
}

const ID_TIEBREAKER: Prisma.BookLoanOrderByWithRelationInput = { id: "asc" };

const LOAN_DATE_ASC_ORDER: Prisma.BookLoanOrderByWithRelationInput[] = [
  { loanDate: { nulls: "last", sort: "asc" } },
  ID_TIEBREAKER,
];

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

function buildActiveLoansWhere({
  type,
  userId,
}: {
  type: LoanType | undefined;
  userId: string;
}): Prisma.BookLoanWhereInput {
  const where: Prisma.BookLoanWhereInput = {
    book: SOFT_DELETE_SCOPE.active,
    status: LOAN_STATUS_ACTIVE,
    userId,
  };

  if (type !== undefined) {
    where.type = type;
  }

  return where;
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
  const where = buildActiveLoansWhere({ type, userId });

  applyLoanFilter({ filter, soonEnd, today, where });

  if (search !== undefined) {
    where.OR = buildLoanSearchConditions(search);
  }

  return where;
}
