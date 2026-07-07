import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { type BookWithRelations, withRelations } from "../../books/index.js";

@Injectable()
export class ReadingQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(userId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.book.count({ where: { queuePosition: { not: null }, userId } });
  }

  listQueue(userId: string): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { queuePosition: "asc" },
      where: { queuePosition: { not: null }, userId },
    });
  }

  async setPosition(
    userId: string,
    bookId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: position },
      where: { id: bookId, userId },
    });
  }

  async shiftDownFrom(
    userId: string,
    fromPosition: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { increment: 1 } },
      where: { queuePosition: { gte: fromPosition }, userId },
    });
  }
}
