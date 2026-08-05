import type { LibrarySort, ListBookSort } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { buildBookSearchConditions } from "./book-search.js";
import { LIBRARY_ORDER_BY, withRelations } from "./books.repository.js";

const listItemWithBook = {
  include: { book: { include: withRelations } },
} satisfies Prisma.BookListItemDefaultArgs;

export type BookListItemWithBook = Prisma.BookListItemGetPayload<typeof listItemWithBook>;

type CountListBooksInput = {
  listId: string;
  search: string | undefined;
  searchGenreKeys: string[] | undefined;
  userId: string;
};

type ListListBooksInput = CountListBooksInput & {
  skip: number;
  sort: ListBookSort;
  take: number;
};

@Injectable()
export class ListBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBooks({ listId, search, searchGenreKeys, userId }: CountListBooksInput): Promise<number> {
    return this.prisma.bookListItem.count({
      where: buildListItemWhere({ listId, search, searchGenreKeys, userId }),
    });
  }

  listBooks({
    listId,
    search,
    searchGenreKeys,
    skip,
    sort,
    take,
    userId,
  }: ListListBooksInput): Promise<BookListItemWithBook[]> {
    return this.prisma.bookListItem.findMany({
      orderBy: LIST_BOOK_ORDER_BY[sort],
      skip,
      take,
      where: buildListItemWhere({ listId, search, searchGenreKeys, userId }),
      ...listItemWithBook,
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
  pages_asc: nestBookOrderBy("pages_asc"),
  pages_desc: nestBookOrderBy("pages_desc"),
  position: [{ position: "asc" }, BOOK_ID_TIEBREAKER],
  rating_desc: nestBookOrderBy("rating_desc"),
  title_asc: nestBookOrderBy("title_asc"),
  title_desc: nestBookOrderBy("title_desc"),
};

function buildListItemWhere({
  listId,
  search,
  searchGenreKeys,
  userId,
}: CountListBooksInput): Prisma.BookListItemWhereInput {
  const where: Prisma.BookListItemWhereInput = {
    book: SOFT_DELETE_SCOPE.active,
    list: { ...SOFT_DELETE_SCOPE.active, userId },
    listId,
  };
  const conditions = buildBookSearchConditions({ search, searchGenreKeys });
  if (conditions !== undefined) {
    where.book = { ...SOFT_DELETE_SCOPE.active, OR: conditions };
  }
  return where;
}
