import type { LibrarySort, ListBookSort, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ListTabCounts } from "../domain/list-status-counts.js";
import type { LibraryFilter } from "./book-where.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import {
  isFinishedStatus,
  isStatusSort,
  selectStatusSortedPage,
} from "../domain/list-book-status-sort.js";
import { TAB_STATUSES } from "../domain/list-status-counts.js";
import { buildLibraryWhere } from "./book-where.js";
import { LIBRARY_ORDER_BY, withRelations } from "./books.repository.js";

const log = createLogger("list-books.repository");

const LIST_POSITION_RANK = {
  maxRows: 2000,
} as const;

const LIST_STATUS_SORT = {
  maxRows: 2000,
} as const;

const PositionRankRowSchema = z.object({
  bookId: z.string(),
  rank: z.number(),
});

const listItemWithBook = {
  include: { book: { include: withRelations } },
} satisfies Prisma.BookListItemDefaultArgs;

export type BookListItemWithBook = Prisma.BookListItemGetPayload<typeof listItemWithBook>;

type CountListBooksInput = {
  filter: LibraryFilter;
  listId: string;
};

type CountTabInput = CountListBooksInput & {
  statuses: ReadingStatus[] | undefined;
};

type ListListBooksInput = CountListBooksInput & {
  skip: number;
  sort: ListBookSort;
  take: number;
};

type PositionRanksInput = {
  listId: string;
  userId: string;
};

@Injectable()
export class ListBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBooks({ filter, listId }: CountListBooksInput): Promise<number> {
    return this.prisma.bookListItem.count({ where: buildListItemWhere({ filter, listId }) });
  }

  async countByTab({ filter, listId }: CountListBooksInput): Promise<ListTabCounts> {
    const [all, finished, notStarted, reading] = await Promise.all([
      this.countForStatuses({ filter, listId, statuses: TAB_STATUSES.all }),
      this.countForStatuses({ filter, listId, statuses: TAB_STATUSES.finished }),
      this.countForStatuses({ filter, listId, statuses: TAB_STATUSES.not_started }),
      this.countForStatuses({ filter, listId, statuses: TAB_STATUSES.reading }),
    ]);
    return { all, finished, notStarted, reading };
  }

  listBooks({
    filter,
    listId,
    skip,
    sort,
    take,
  }: ListListBooksInput): Promise<BookListItemWithBook[]> {
    if (isStatusSort(sort)) {
      return this.listByStatusGroup({ filter, listId, skip, sort, take });
    }
    return this.prisma.bookListItem.findMany({
      orderBy: LIST_BOOK_ORDER_BY[sort],
      skip,
      take,
      where: buildListItemWhere({ filter, listId }),
      ...listItemWithBook,
    });
  }

  async listPositionRanks({ listId, userId }: PositionRanksInput): Promise<Map<string, number>> {
    const result = await this.prisma.$queryRaw(PrismaNamespace.sql`
      SELECT
        i.book_id::text AS "bookId",
        row_number() OVER (ORDER BY i.position, i.book_id)::int AS "rank"
      FROM book_list_items i
      JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
      WHERE i.list_id = ${listId}::uuid AND b.user_id = ${userId}::uuid
      ORDER BY i.position, i.book_id
      LIMIT ${LIST_POSITION_RANK.maxRows}
    `);
    const rows = z.array(PositionRankRowSchema).parse(result);
    if (rows.length === LIST_POSITION_RANK.maxRows) {
      log.warn(
        { cap: LIST_POSITION_RANK.maxRows, listId, userId },
        "position ranks truncated at the cap",
      );
    }
    return new Map(rows.map((row) => [row.bookId, row.rank]));
  }

  private countForStatuses({ filter, listId, statuses }: CountTabInput): Promise<number> {
    return this.prisma.bookListItem.count({
      where: buildListItemWhere({ filter: { ...filter, readingStatuses: statuses }, listId }),
    });
  }

  private async listByStatusGroup({
    filter,
    listId,
    skip,
    sort,
    take,
  }: ListListBooksInput): Promise<BookListItemWithBook[]> {
    const rows = await this.prisma.bookListItem.findMany({
      orderBy: [{ position: "asc" }, { bookId: "asc" }],
      select: { book: { select: { readingStatus: true } }, bookId: true },
      take: LIST_STATUS_SORT.maxRows,
      where: buildListItemWhere({ filter, listId }),
    });
    if (rows.length === LIST_STATUS_SORT.maxRows) {
      log.warn({ cap: LIST_STATUS_SORT.maxRows, listId }, "status sort truncated at the cap");
    }

    const pageIds = selectStatusSortedPage({
      entries: rows.map((row) => ({
        bookId: row.bookId,
        isFinished: isFinishedStatus(row.book.readingStatus),
      })),
      skip,
      sort,
      take,
    });
    if (pageIds.length === 0) {
      return [];
    }

    const items = await this.prisma.bookListItem.findMany({
      where: { bookId: { in: pageIds }, listId },
      ...listItemWithBook,
    });
    const byBookId = new Map(items.map((item) => [item.bookId, item]));
    return pageIds.flatMap((bookId) => {
      const item = byBookId.get(bookId);
      return item === undefined ? [] : [item];
    });
  }
}

const BOOK_ID_TIEBREAKER: Prisma.BookListItemOrderByWithRelationInput = { book: { id: "asc" } };

function nestBookOrderBy(sort: LibrarySort): Prisma.BookListItemOrderByWithRelationInput[] {
  return LIBRARY_ORDER_BY[sort].map((fragment) => ({ book: fragment }));
}

const LIST_BOOK_ORDER_BY: Record<ListBookSort, Prisma.BookListItemOrderByWithRelationInput[]> = {
  added_asc: [{ addedAt: "asc" }, BOOK_ID_TIEBREAKER],
  added_desc: [{ addedAt: "desc" }, BOOK_ID_TIEBREAKER],
  author_asc: nestBookOrderBy("author_asc"),
  author_desc: nestBookOrderBy("author_desc"),
  pages_asc: nestBookOrderBy("pages_asc"),
  pages_desc: nestBookOrderBy("pages_desc"),
  position: [{ position: "asc" }, BOOK_ID_TIEBREAKER],
  rating_asc: nestBookOrderBy("rating_asc"),
  rating_desc: nestBookOrderBy("rating_desc"),
  status_read_first: [{ position: "asc" }, BOOK_ID_TIEBREAKER],
  status_unread_first: [{ position: "asc" }, BOOK_ID_TIEBREAKER],
  title_asc: nestBookOrderBy("title_asc"),
  title_desc: nestBookOrderBy("title_desc"),
  year_asc: nestBookOrderBy("year_asc"),
  year_desc: nestBookOrderBy("year_desc"),
};

function buildListItemWhere({
  filter,
  listId,
}: CountListBooksInput): Prisma.BookListItemWhereInput {
  return {
    book: buildLibraryWhere(filter),
    list: { ...SOFT_DELETE_SCOPE.active, userId: filter.userId },
    listId,
  };
}
