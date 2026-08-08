import type {
  ListAttentionReason,
  ListDescriptionFilter,
  ListFillFilter,
  ListSizeFilter,
  ListSort,
  Nullable,
} from "@app/shared";

import { LIST_STALE_MONTHS } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { subMonths } from "date-fns";
import { z } from "zod";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { BookListModel } from "../../../generated/prisma/models.js";
import type { ListsSummaryCounts } from "../domain/lists-summary.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";

const PREVIEW_COVERS_LIMIT = 4;
const LIST_COPY_MAX_ITEMS = 5000;

const log = createLogger("lists.repository");

const trashedListSelect = {
  _count: { select: { items: { where: { book: SOFT_DELETE_SCOPE.active } } } },
  deletedAt: true,
  id: true,
  name: true,
  purgeAt: true,
} satisfies Prisma.BookListSelect;

export type CreateBookListData = {
  description: Nullable<string>;
  name: string;
  normalizedName: string;
};

export type TrashedListRow = Trashed<TrashedListSelection>;

export type UpdateBookListData = {
  description: Nullable<string>;
  name: string;
  normalizedName: string;
};

type TrashedListSelection = Prisma.BookListGetPayload<{ select: typeof trashedListSelect }>;

const listCardArgs = {
  include: {
    _count: { select: { items: { where: { book: SOFT_DELETE_SCOPE.active } } } },
    items: {
      include: { book: { select: { coverMedia: true } } },
      orderBy: { position: "asc" },
      take: PREVIEW_COVERS_LIMIT,
      where: { book: { ...SOFT_DELETE_SCOPE.active, coverMediaId: { not: null } } },
    },
  },
} satisfies Prisma.BookListDefaultArgs;

export type BookListCard = Prisma.BookListGetPayload<typeof listCardArgs>;

export type ListFilters = {
  attention: ListAttentionReason | undefined;
  description: ListDescriptionFilter[] | undefined;
  fill: ListFillFilter[] | undefined;
  query: string | undefined;
  size: ListSizeFilter[] | undefined;
};

type CountOwnedInput = ListFilters & {
  now: Date;
  userId: string;
};

type SearchListCardsInput = ListFilters & {
  now: Date;
  skip: number;
  sort: ListSort;
  take: number;
  userId: string;
};

const LIST_SIZE_BOUNDS: Record<ListSizeFilter, { max: null | number; min: number }> = {
  huge: { max: null, min: 51 },
  large: { max: 50, min: 21 },
  medium: { max: 20, min: 6 },
  small: { max: 5, min: 1 },
};

const ListIdRowSchema = z.object({ id: z.string() });

const ListCountRowSchema = z.object({ count: z.number() });

const ListsSummaryCountsRowSchema = z.object({
  largestListBookCount: z.number(),
  listsWithBooksCount: z.number(),
  maxListsPerBook: z.number(),
  multiListBookCount: z.number(),
  noDescriptionListCount: z.number(),
  staleListCount: z.number(),
  totalListCount: z.number(),
  totalMembershipCount: z.number(),
  uniqueBookCount: z.number(),
});

const EMPTY_LISTS_SUMMARY_COUNTS: ListsSummaryCounts = {
  largestListBookCount: 0,
  listsWithBooksCount: 0,
  maxListsPerBook: 0,
  multiListBookCount: 0,
  noDescriptionListCount: 0,
  staleListCount: 0,
  totalListCount: 0,
  totalMembershipCount: 0,
  uniqueBookCount: 0,
};

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireCreateLock(userId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.bookLists, key: `list:create:${userId}` },
      client,
    );
  }

  async copyItems(
    { sourceListId, targetListId }: { sourceListId: string; targetListId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const items = await client.bookListItem.findMany({
      orderBy: { position: "asc" },
      select: { bookId: true },
      take: LIST_COPY_MAX_ITEMS,
      where: { book: SOFT_DELETE_SCOPE.active, listId: sourceListId },
    });
    if (items.length === 0) {
      return 0;
    }
    if (items.length === LIST_COPY_MAX_ITEMS) {
      log.warn(
        { cap: LIST_COPY_MAX_ITEMS, sourceListId, targetListId },
        "duplicated list truncated at the safety cap",
      );
    }
    const created = await client.bookListItem.createMany({
      data: items.map((item, index) => ({
        bookId: item.bookId,
        listId: targetListId,
        position: index + 1,
      })),
    });
    return created.count;
  }

  countItems({ listId }: { listId: string }): Promise<number> {
    return this.prisma.bookListItem.count({
      where: { book: SOFT_DELETE_SCOPE.active, listId },
    });
  }

  async countOwned({ now, userId, ...filters }: CountOwnedInput): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(*))::int AS "count"
      FROM (${buildFilteredListIds({ filters, now, userId })}) filtered
    `);
    return z.array(ListCountRowSchema).parse(rows)[0]?.count ?? 0;
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.bookList.count({ where: { ...SOFT_DELETE_SCOPE.trashed, userId } });
  }

  create(
    { data, userId }: { data: CreateBookListData; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListCard> {
    return client.bookList.create({ data: { ...data, userId }, ...listCardArgs });
  }

  createByNormalized(
    { data, userId }: { data: CreateBookListData; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListModel> {
    return client.bookList.create({ data: { ...data, userId } });
  }

  findByNormalized(
    {
      normalizedName,
      userId,
    }: {
      normalizedName: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookListModel>> {
    return client.bookList.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, normalizedName, userId },
    });
  }

  findForPurge({
    listId,
    userId,
  }: {
    listId: string;
    userId: string;
  }): Promise<Nullable<{ deletedAt: Nullable<Date> }>> {
    return this.prisma.bookList.findFirst({
      select: { deletedAt: true },
      where: { id: listId, userId },
    });
  }

  findOwnedById({ id, userId }: { id: string; userId: string }): Promise<Nullable<BookListModel>> {
    return this.prisma.bookList.findFirst({ where: { ...SOFT_DELETE_SCOPE.active, id, userId } });
  }

  findOwnedByIds(
    { ids, userId }: { ids: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListModel[]> {
    return client.bookList.findMany({
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: ids }, userId },
    });
  }

  findOwnedCardById(
    {
      listId,
      userId,
    }: {
      listId: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookListCard>> {
    return client.bookList.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, id: listId, userId },
      ...listCardArgs,
    });
  }

  findPurgeCandidates({
    limit,
    now,
  }: {
    limit: number;
    now: Date;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.bookList.findMany({
      orderBy: { purgeAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: SOFT_DELETE_SCOPE.overdue(now),
    });
  }

  async hardDeleteIfTrashed({
    listId,
    now,
    userId,
  }: {
    listId: string;
    now: Date;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.bookList.deleteMany({
      where: { ...SOFT_DELETE_SCOPE.overdue(now), id: listId, userId },
    });
    return purged.count;
  }

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedListRow[]> {
    const rows = await this.prisma.bookList.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedListSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, userId },
    });
    return rows.filter(isTrashed);
  }

  async restore({ listId, userId }: { listId: string; userId: string }): Promise<number> {
    const restored = await this.prisma.bookList.updateMany({
      data: SOFT_DELETE_SCOPE.restored,
      where: { ...SOFT_DELETE_SCOPE.trashed, id: listId, userId },
    });
    return restored.count;
  }

  async searchOwnedCards({
    now,
    skip,
    sort,
    take,
    userId,
    ...filters
  }: SearchListCardsInput): Promise<BookListCard[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id FROM (${buildFilteredListIds({ filters, now, userId })}) filtered
      ORDER BY ${LIST_ORDER_BY[sort]}
      LIMIT ${take} OFFSET ${skip}
    `);
    const ids = z
      .array(ListIdRowSchema)
      .parse(rows)
      .map((row) => row.id);
    if (ids.length === 0) return [];

    const cards = await this.prisma.bookList.findMany({
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: ids }, userId },
      ...listCardArgs,
    });
    const byId = new Map(cards.map((card) => [card.id, card]));
    return ids.flatMap((id) => {
      const card = byId.get(id);
      return card === undefined ? [] : [card];
    });
  }

  async softDelete({
    listId,
    stamp,
    userId,
  }: {
    listId: string;
    stamp: TrashStamp;
    userId: string;
  }): Promise<number> {
    const deleted = await this.prisma.bookList.updateMany({
      data: stamp,
      where: { ...SOFT_DELETE_SCOPE.active, id: listId, userId },
    });
    return deleted.count;
  }

  async summaryCounts({ now, userId }: { now: Date; userId: string }): Promise<ListsSummaryCounts> {
    const staleBefore = subMonths(now, LIST_STALE_MONTHS);
    const rows = await this.prisma.$queryRaw`
      WITH membership AS (
        SELECT item.list_id AS list_id, item.book_id AS book_id
        FROM book_list_items item
        JOIN book_lists list ON list.id = item.list_id
        JOIN books book ON book.id = item.book_id
        WHERE list.user_id = ${userId}::uuid
          AND list.deleted_at IS NULL
          AND book.deleted_at IS NULL
      ),
      list_size AS (
        SELECT
          list.id AS list_id,
          count(membership.book_id) AS book_count,
          (list.description IS NULL OR btrim(list.description) = '') AS has_no_description,
          (list.updated_at < ${staleBefore}) AS is_stale
        FROM book_lists list
        LEFT JOIN membership ON membership.list_id = list.id
        WHERE list.user_id = ${userId}::uuid
          AND list.deleted_at IS NULL
        GROUP BY list.id
      ),
      book_reach AS (
        SELECT membership.book_id AS book_id, count(*) AS list_count
        FROM membership
        GROUP BY membership.book_id
      )
      SELECT
        (SELECT count(*) FROM list_size)::int AS "totalListCount",
        (SELECT count(*) FILTER (WHERE book_count > 0) FROM list_size)::int AS "listsWithBooksCount",
        (SELECT coalesce(max(book_count), 0) FROM list_size)::int AS "largestListBookCount",
        (SELECT count(*) FILTER (WHERE has_no_description) FROM list_size)::int AS "noDescriptionListCount",
        (SELECT count(*) FILTER (WHERE is_stale) FROM list_size)::int AS "staleListCount",
        (SELECT count(*) FROM membership)::int AS "totalMembershipCount",
        (SELECT count(*) FROM book_reach)::int AS "uniqueBookCount",
        (SELECT count(*) FILTER (WHERE list_count > 1) FROM book_reach)::int AS "multiListBookCount",
        (SELECT coalesce(max(list_count), 0) FROM book_reach)::int AS "maxListsPerBook"
    `;
    return z.array(ListsSummaryCountsRowSchema).parse(rows)[0] ?? EMPTY_LISTS_SUMMARY_COUNTS;
  }

  async updateOwned({
    data,
    id,
    userId,
  }: {
    data: UpdateBookListData;
    id: string;
    userId: string;
  }): Promise<BookListCard> {
    const updated = await this.prisma.bookList.updateMany({
      data,
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
    });
    if (updated.count === 0) {
      throw new NotFoundError("List not found");
    }
    return this.prisma.bookList.findFirstOrThrow({
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
      ...listCardArgs,
    });
  }
}

const LIST_ORDER_BY: Record<ListSort, Prisma.Sql> = {
  books_count_asc: Prisma.sql`book_count ASC, name ASC, id ASC`,
  books_count_desc: Prisma.sql`book_count DESC, name ASC, id ASC`,
  created_asc: Prisma.sql`created_at ASC, id ASC`,
  created_desc: Prisma.sql`created_at DESC, id ASC`,
  title_asc: Prisma.sql`name ASC, id ASC`,
  title_desc: Prisma.sql`name DESC, id ASC`,
  updated_desc: Prisma.sql`updated_at DESC, id ASC`,
};

function buildFilteredListIds({
  filters,
  now,
  userId,
}: {
  filters: ListFilters;
  now: Date;
  userId: string;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT
      list.id AS id,
      list.name AS name,
      list.created_at AS created_at,
      list.updated_at AS updated_at,
      count(book.id) AS book_count
    FROM book_lists list
    LEFT JOIN book_list_items item ON item.list_id = list.id
    LEFT JOIN books book ON book.id = item.book_id AND book.deleted_at IS NULL
    WHERE ${buildListWhere(filters, now, userId)}
    GROUP BY list.id
    ${buildListHaving(filters)}
  `;
}

function buildListHaving({ attention, fill, size }: ListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const fillCondition = buildFillCondition(fill);
  if (fillCondition !== null) conditions.push(fillCondition);
  const sizeCondition = buildSizeCondition(size);
  if (sizeCondition !== null) conditions.push(sizeCondition);
  if (attention === "empty") conditions.push(Prisma.sql`count(book.id) = 0`);
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`HAVING ${Prisma.join(conditions, " AND ")}`;
}

function buildListWhere(
  { attention, description, query }: ListFilters,
  now: Date,
  userId: string,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`list.user_id = ${userId}::uuid`,
    Prisma.sql`list.deleted_at IS NULL`,
  ];
  if (query !== undefined && query.length > 0) {
    const pattern = `%${query}%`;
    conditions.push(Prisma.sql`(list.name ILIKE ${pattern} OR list.description ILIKE ${pattern})`);
  }
  const descriptionCondition = buildDescriptionCondition(description);
  if (descriptionCondition !== null) conditions.push(descriptionCondition);
  if (attention === "no_description") conditions.push(NO_DESCRIPTION_SQL);
  if (attention === "stale") {
    conditions.push(Prisma.sql`list.updated_at < ${subMonths(now, LIST_STALE_MONTHS)}`);
  }
  return Prisma.join(conditions, " AND ");
}

const NO_DESCRIPTION_SQL = Prisma.sql`(list.description IS NULL OR btrim(list.description) = '')`;

const HAS_DESCRIPTION_SQL = Prisma.sql`(list.description IS NOT NULL AND btrim(list.description) <> '')`;

function buildDescriptionCondition(
  description: ListDescriptionFilter[] | undefined,
): Nullable<Prisma.Sql> {
  if (description === undefined || description.length === 0) return null;
  const conditions = description.map((value) =>
    value === "with_description" ? HAS_DESCRIPTION_SQL : NO_DESCRIPTION_SQL,
  );
  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}

function buildFillCondition(fill: ListFillFilter[] | undefined): Nullable<Prisma.Sql> {
  if (fill === undefined || fill.length === 0) return null;
  const conditions = fill.map((value) =>
    value === "with_books" ? Prisma.sql`count(book.id) > 0` : Prisma.sql`count(book.id) = 0`,
  );
  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}

function buildSizeCondition(size: ListSizeFilter[] | undefined): Nullable<Prisma.Sql> {
  if (size === undefined || size.length === 0) return null;
  const conditions = size.map((value) => {
    const { max, min } = LIST_SIZE_BOUNDS[value];
    return max === null
      ? Prisma.sql`count(book.id) >= ${min}`
      : Prisma.sql`count(book.id) BETWEEN ${min} AND ${max}`;
  });
  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}
