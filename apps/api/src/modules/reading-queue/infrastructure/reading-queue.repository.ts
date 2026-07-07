import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { type BookWithRelations, withRelations } from "../../books/index.js";

@Injectable()
export class ReadingQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  listQueue(userId: string): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { queuePosition: "asc" },
      where: { queuePosition: { not: null }, userId },
    });
  }
}
