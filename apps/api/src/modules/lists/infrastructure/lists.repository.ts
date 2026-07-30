import type { ListSort, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookListModel } from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";

const PREVIEW_COVERS_LIMIT = 4;

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

type SearchListCardsInput = {
  query: string | undefined;
  skip: number;
  sort: ListSort;
  take: number;
  userId: string;
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

  countItems(listId: string): Promise<number> {
    return this.prisma.bookListItem.count({
      where: { book: SOFT_DELETE_SCOPE.active, listId },
    });
  }

  countOwned({ query, userId }: { query: string | undefined; userId: string }): Promise<number> {
    return this.prisma.bookList.count({ where: buildOwnedWhere(userId, query) });
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

  findOwnedCardById({
    listId,
    userId,
  }: {
    listId: string;
    userId: string;
  }): Promise<Nullable<BookListCard>> {
    return this.prisma.bookList.findFirst({
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

  searchOwnedCards({
    query,
    skip,
    sort,
    take,
    userId,
  }: SearchListCardsInput): Promise<BookListCard[]> {
    return this.prisma.bookList.findMany({
      orderBy: LIST_ORDER_BY[sort],
      skip,
      take,
      where: buildOwnedWhere(userId, query),
      ...listCardArgs,
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

const NAME_ASC: Prisma.BookListOrderByWithRelationInput = { name: "asc" };

const ID_ASC: Prisma.BookListOrderByWithRelationInput = { id: "asc" };

const LIST_ORDER_BY: Record<ListSort, Prisma.BookListOrderByWithRelationInput[]> = {
  books_count_asc: [{ items: { _count: "asc" } }, NAME_ASC, ID_ASC],
  books_count_desc: [{ items: { _count: "desc" } }, NAME_ASC, ID_ASC],
  created_asc: [{ createdAt: "asc" }, ID_ASC],
  created_desc: [{ createdAt: "desc" }, ID_ASC],
  title_asc: [{ name: "asc" }, ID_ASC],
  title_desc: [{ name: "desc" }, ID_ASC],
  updated_desc: [{ updatedAt: "desc" }, ID_ASC],
};

function buildOwnedWhere(userId: string, query: string | undefined): Prisma.BookListWhereInput {
  if (query === undefined || query.length === 0) {
    return { ...SOFT_DELETE_SCOPE.active, userId };
  }

  return {
    ...SOFT_DELETE_SCOPE.active,
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
    userId,
  };
}
