import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type StoreLinkUpdateData = Partial<StoreLinkWriteData>;

export type StoreLinkWriteData = {
  currency: Nullable<string>;
  price: Nullable<number>;
  storeName: string;
  url: string;
};

type CountByBookArgs = WithClient & { bookId: string; userId: string };

type CreateArgs = WithClient & { bookId: string; data: StoreLinkWriteData; userId: string };

type DeleteByIdArgs = WithClient & { id: string; userId: string };

type FindByBookAndUrlArgs = WithClient & { bookId: string; url: string };

type FindOwnedByIdArgs = WithClient & { id: string; userId: string };

type ListByBookArgs = WithClient & { bookId: string; userId: string };

type UpdateArgs = WithClient & { data: StoreLinkUpdateData; id: string; userId: string };

type WithClient = { client?: Prisma.TransactionClient };

@Injectable()
export class BookStoreLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByBook({ bookId, client, userId }: CountByBookArgs): Promise<number> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.count({ where: { bookId, userId } });
  }

  create({ bookId, client, data, userId }: CreateArgs): Promise<BookStoreLinkModel> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.create({ data: { ...data, bookId, userId } });
  }

  async deleteById({ client, id, userId }: DeleteByIdArgs): Promise<number> {
    const db = client ?? this.prisma;
    const result = await db.bookStoreLink.deleteMany({ where: { id, userId } });
    return result.count;
  }

  findByBookAndUrl({
    bookId,
    client,
    url,
  }: FindByBookAndUrlArgs): Promise<Nullable<BookStoreLinkModel>> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.findUnique({ where: { bookId_url: { bookId, url } } });
  }

  findOwnedById({ client, id, userId }: FindOwnedByIdArgs): Promise<Nullable<BookStoreLinkModel>> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.findFirst({ where: { id, userId } });
  }

  listByBook({ bookId, client, userId }: ListByBookArgs): Promise<BookStoreLinkModel[]> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.findMany({
      orderBy: { createdAt: "asc" },
      where: { bookId, userId },
    });
  }

  update({ client, data, id, userId }: UpdateArgs): Promise<BookStoreLinkModel> {
    const db = client ?? this.prisma;
    return db.bookStoreLink.update({ data, where: { id, userId } });
  }
}
