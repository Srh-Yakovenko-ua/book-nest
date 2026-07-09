import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ChangelogEntryModel, ChangelogReadModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CountPublishedAfterInput = {
  after: Date;
  now: Date;
};

type FindPublishedInput = {
  cursor: string | undefined;
  limit: number | undefined;
  now: Date;
};

type UpsertReadInput = {
  lastSeenAt: Date;
  userId: string;
};

@Injectable()
export class ChangelogRepository {
  constructor(private readonly prisma: PrismaService) {}

  countPublished(
    { now }: { now: Date },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.changelogEntry.count({ where: { publishedAt: { lte: now, not: null } } });
  }

  countPublishedAfter(
    { after, now }: CountPublishedAfterInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.changelogEntry.count({
      where: { publishedAt: { gt: after, lte: now, not: null } },
    });
  }

  findPublished(
    { cursor, limit, now }: FindPublishedInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ChangelogEntryModel[]> {
    return client.changelogEntry.findMany({
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      where: { publishedAt: { lte: now, not: null } },
      ...(limit === undefined ? {} : { take: limit + 1 }),
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
  }

  getRead(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ChangelogReadModel>> {
    return client.changelogRead.findUnique({ where: { userId } });
  }

  upsertRead(
    { lastSeenAt, userId }: UpsertReadInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ChangelogReadModel> {
    return client.changelogRead.upsert({
      create: { lastSeenAt, userId },
      update: { lastSeenAt },
      where: { userId },
    });
  }
}
