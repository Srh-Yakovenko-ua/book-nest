import type { Nullable, OwnershipStatus, ReadingStatus, RelatedListView } from "@app/shared";

import { RelatedListViewSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookListItemWithBook } from "./list-books.repository.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { LIST_OVERVIEW } from "../domain/list-overview.js";
import { withRelations } from "./books.repository.js";

const DistinctCountRowSchema = z.object({ count: z.number() });

export type ListPagesAggregate = {
  knownCount: number;
  totalPages: number;
};

export type ListStructureCounts = {
  seriesCount: number;
  soloCount: number;
};

type ListScope = {
  listId: string;
  userId: string;
};

type OwnershipScope = ListScope & {
  statuses: OwnershipStatus[];
};

type StatusScope = ListScope & {
  statuses: ReadingStatus[];
};

@Injectable()
export class ListOverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByOwnership({ listId, statuses, userId }: OwnershipScope): Promise<number> {
    return this.prisma.bookListItem.count({
      where: listItemWhere({ book: { ownershipStatus: { in: statuses } }, listId, userId }),
    });
  }

  countByReadingStatus({ listId, statuses, userId }: StatusScope): Promise<number> {
    return this.prisma.bookListItem.count({
      where: listItemWhere({ book: { readingStatus: { in: statuses } }, listId, userId }),
    });
  }

  countInQueue({ listId, userId }: ListScope): Promise<number> {
    return this.prisma.bookListItem.count({
      where: listItemWhere({ book: { queuePosition: { not: null } }, listId, userId }),
    });
  }

  countTotal({ listId, userId }: ListScope): Promise<number> {
    return this.prisma.bookListItem.count({ where: listItemWhere({ listId, userId }) });
  }

  async distinctAuthorsCount({ listId, userId }: ListScope): Promise<number> {
    const result = await this.prisma.$queryRaw(PrismaNamespace.sql`
      SELECT count(DISTINCT ba.author_id)::int AS "count"
      FROM book_list_items i
      JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
      JOIN book_authors ba ON ba.book_id = b.id
      WHERE i.list_id = ${listId}::uuid AND b.user_id = ${userId}::uuid
    `);
    return z.array(DistinctCountRowSchema).parse(result)[0]?.count ?? 0;
  }

  findCurrentlyReading({
    listId,
    statuses,
    userId,
  }: StatusScope): Promise<Nullable<BookListItemWithBook>> {
    return this.prisma.bookListItem.findFirst({
      include: { book: { include: withRelations } },
      orderBy: [
        { book: { readingProgress: { lastProgressUpdateAt: { nulls: "last", sort: "desc" } } } },
        { book: { updatedAt: "desc" } },
        { book: { id: "asc" } },
      ],
      where: listItemWhere({ book: { readingStatus: { in: statuses } }, listId, userId }),
    });
  }

  async findRelatedLists({ listId, userId }: ListScope): Promise<RelatedListView[]> {
    const result = await this.prisma.$queryRaw(PrismaNamespace.sql`
      SELECT
        other.list_id AS "id",
        bl.name AS "name",
        count(*)::int AS "sharedCount",
        (SELECT count(*)::int
           FROM book_list_items i
           JOIN books ab ON ab.id = i.book_id AND ab.deleted_at IS NULL
          WHERE i.list_id = other.list_id) AS "bookCount"
      FROM book_list_items current_item
      JOIN books b ON b.id = current_item.book_id AND b.deleted_at IS NULL
      JOIN book_list_items other
        ON other.book_id = current_item.book_id AND other.list_id <> current_item.list_id
      JOIN book_lists bl
        ON bl.id = other.list_id AND bl.deleted_at IS NULL AND bl.user_id = ${userId}::uuid
      WHERE current_item.list_id = ${listId}::uuid
      GROUP BY other.list_id, bl.name
      ORDER BY "sharedCount" DESC, bl.name ASC
      LIMIT ${LIST_OVERVIEW.relatedListsLimit}
    `);
    return z.array(RelatedListViewSchema).parse(result);
  }

  async pagesAggregate({ listId, userId }: ListScope): Promise<ListPagesAggregate> {
    const result = await this.prisma.book.aggregate({
      _count: { pagesCount: true },
      _sum: { pagesCount: true },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        lists: { some: { list: { ...SOFT_DELETE_SCOPE.active, userId }, listId } },
        userId,
      },
    });
    return { knownCount: result._count.pagesCount, totalPages: result._sum.pagesCount ?? 0 };
  }

  async structureCounts({ listId, userId }: ListScope): Promise<ListStructureCounts> {
    const [seriesCount, soloCount] = await Promise.all([
      this.prisma.bookListItem.count({
        where: listItemWhere({ book: { seriesId: { not: null } }, listId, userId }),
      }),
      this.prisma.bookListItem.count({
        where: listItemWhere({ book: { seriesId: null }, listId, userId }),
      }),
    ]);
    return { seriesCount, soloCount };
  }
}

function listItemWhere({
  book,
  listId,
  userId,
}: ListScope & { book?: Prisma.BookWhereInput }): Prisma.BookListItemWhereInput {
  return {
    book: { ...SOFT_DELETE_SCOPE.active, ...book, userId },
    list: { ...SOFT_DELETE_SCOPE.active, userId },
    listId,
  };
}
