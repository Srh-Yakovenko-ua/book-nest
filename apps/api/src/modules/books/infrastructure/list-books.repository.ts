import type { LibrarySort, ListBookSort, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ListTabCounts } from "../domain/list-status-counts.js";
import type { LibraryFilter } from "./book-where.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { TAB_STATUSES } from "../domain/list-status-counts.js";
import { buildLibraryWhere } from "./book-where.js";
import { LIBRARY_ORDER_BY, withRelations } from "./books.repository.js";

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
    return this.prisma.bookListItem.findMany({
      orderBy: LIST_BOOK_ORDER_BY[sort],
      skip,
      take,
      where: buildListItemWhere({ filter, listId }),
      ...listItemWithBook,
    });
  }

  private countForStatuses({ filter, listId, statuses }: CountTabInput): Promise<number> {
    return this.prisma.bookListItem.count({
      where: buildListItemWhere({ filter: { ...filter, readingStatuses: statuses }, listId }),
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
  title_asc: nestBookOrderBy("title_asc"),
  title_desc: nestBookOrderBy("title_desc"),
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
