import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { QUOTE_PAGE_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { QuoteBookCount, QuotesSummaryData } from "../domain/quotes-summary.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildAuthorSearchConditions } from "../../books/index.js";

const quoteWithBook = {
  include: { book: { include: { coverMedia: true } } },
} satisfies Prisma.QuoteDefaultArgs;

export type BookQuoteCounts = {
  favorites: number;
  spoiler: number;
  total: number;
};

export type OwnedBook = {
  id: string;
  pagesCount: Nullable<number>;
};

export type QuotesFilterInput = {
  bookId: string | undefined;
  filter: QuoteFilter;
  search: string | undefined;
  userId: string;
};

export type QuoteUpdateData = Partial<QuoteWriteData>;

export type QuoteWithBook = Prisma.QuoteGetPayload<typeof quoteWithBook>;

export type QuoteWriteData = {
  chapter: Nullable<string>;
  comment: Nullable<string>;
  isFavorite: boolean;
  isSpoiler: boolean;
  page: Nullable<number>;
  text: string;
};

type ListQuotesInput = QuotesFilterInput & {
  skip: number;
  sort: QuoteSort;
  take: number;
};

@Injectable()
export class QuotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bookCounts(userId: string, bookId: string): Promise<BookQuoteCounts> {
    const base: Prisma.QuoteWhereInput = { bookId, userId };
    const [total, favorites, spoiler] = await Promise.all([
      this.prisma.quote.count({ where: base }),
      this.prisma.quote.count({ where: { ...base, isFavorite: true } }),
      this.prisma.quote.count({ where: { ...base, isSpoiler: true } }),
    ]);

    return { favorites, spoiler, total };
  }

  count(filter: QuotesFilterInput): Promise<number> {
    return this.prisma.quote.count({ where: buildQuotesWhere(filter) });
  }

  create(
    {
      bookId,
      data,
      userId,
    }: {
      bookId: string;
      data: QuoteWriteData;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<QuoteWithBook> {
    return client.quote.create({ data: { ...data, bookId, userId }, ...quoteWithBook });
  }

  async delete(
    { quoteId }: { quoteId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.quote.delete({ where: { id: quoteId } });
  }

  findOwnedBook(userId: string, bookId: string): Promise<Nullable<OwnedBook>> {
    return this.prisma.book.findFirst({
      select: { id: true, pagesCount: true },
      where: { id: bookId, userId },
    });
  }

  findOwnedQuote({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<Nullable<QuoteWithBook>> {
    return this.prisma.quote.findFirst({
      where: { bookId, id: quoteId, userId },
      ...quoteWithBook,
    });
  }

  list({ skip, sort, take, ...filter }: ListQuotesInput): Promise<QuoteWithBook[]> {
    return this.prisma.quote.findMany({
      orderBy: QUOTE_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildQuotesWhere(filter),
      ...quoteWithBook,
    });
  }

  listForBook(userId: string, bookId: string): Promise<QuoteWithBook[]> {
    return this.prisma.quote.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: { bookId, userId },
      ...quoteWithBook,
    });
  }

  async summaryData(userId: string): Promise<QuotesSummaryData> {
    const base: Prisma.QuoteWhereInput = { userId };
    const [total, favorites, spoiler, withComment, groups] = await Promise.all([
      this.prisma.quote.count({ where: base }),
      this.prisma.quote.count({ where: { ...base, isFavorite: true } }),
      this.prisma.quote.count({ where: { ...base, isSpoiler: true } }),
      this.prisma.quote.count({ where: { ...base, comment: { not: null } } }),
      this.prisma.quote.groupBy({ _count: { _all: true }, by: ["bookId"], where: base }),
    ]);

    return {
      bookCounts: await this.resolveBookCounts(userId, groups),
      favorites,
      spoiler,
      total,
      withComment,
    };
  }

  update(
    {
      data,
      quoteId,
    }: {
      data: QuoteUpdateData;
      quoteId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<QuoteWithBook> {
    return client.quote.update({ data, where: { id: quoteId }, ...quoteWithBook });
  }

  private async resolveBookCounts(
    userId: string,
    groups: Array<{ _count: { _all: number }; bookId: string }>,
  ): Promise<QuoteBookCount[]> {
    if (groups.length === 0) {
      return [];
    }

    const books = await this.prisma.book.findMany({
      select: { firstAuthorName: true, id: true, title: true },
      where: { id: { in: groups.map((group) => group.bookId) }, userId },
    });
    const bookById = new Map(books.map((book) => [book.id, book]));

    return groups.flatMap((group) => {
      const book = bookById.get(group.bookId);
      if (book === undefined) {
        return [];
      }
      return [
        {
          bookId: group.bookId,
          count: group._count._all,
          firstAuthorName: book.firstAuthorName,
          title: book.title,
        },
      ];
    });
  }
}

const ID_TIEBREAKER: Prisma.QuoteOrderByWithRelationInput = { id: "asc" };
const RECENT_TIEBREAKER: Prisma.QuoteOrderByWithRelationInput = { createdAt: "desc" };

const QUOTE_SORT_ORDER_BY: Record<QuoteSort, Prisma.QuoteOrderByWithRelationInput[]> = {
  book_author: [{ book: { firstAuthorName: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  book_title: [{ book: { title: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  favorites_first: [{ isFavorite: "desc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  newest: [{ createdAt: "desc" }, ID_TIEBREAKER],
  no_spoiler_first: [{ isSpoiler: "asc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  oldest: [{ createdAt: "asc" }, ID_TIEBREAKER],
  page: [{ page: { nulls: "last", sort: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  with_spoiler_first: [{ isSpoiler: "desc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
};

function applyQuoteFilter(filter: QuoteFilter, where: Prisma.QuoteWhereInput): void {
  switch (filter) {
    case "all":
      return;
    case "favorites":
      where.isFavorite = true;
      return;
    case "no_spoiler":
      where.isSpoiler = false;
      return;
    case "with_comment":
      where.comment = { not: null };
      return;
    case "with_spoiler":
      where.isSpoiler = true;
      return;
    case "without_comment":
      where.comment = null;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildQuoteSearchConditions(search: string): Prisma.QuoteWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  const conditions: Prisma.QuoteWhereInput[] = [
    { text: contains },
    { comment: contains },
    { chapter: contains },
    { book: { title: contains } },
    { book: { originalTitle: contains } },
    ...buildAuthorSearchConditions(search).map((condition) => ({ book: condition })),
  ];

  const pageMatch = Number.parseInt(search, 10);
  if (
    Number.isInteger(pageMatch) &&
    pageMatch > 0 &&
    pageMatch <= QUOTE_PAGE_MAX &&
    String(pageMatch) === search
  ) {
    conditions.push({ page: pageMatch });
  }

  return conditions;
}

function buildQuotesWhere({
  bookId,
  filter,
  search,
  userId,
}: QuotesFilterInput): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = { userId };

  if (bookId !== undefined) {
    where.bookId = bookId;
  }

  applyQuoteFilter(filter, where);

  if (search !== undefined) {
    where.OR = buildQuoteSearchConditions(search);
  }

  return where;
}
