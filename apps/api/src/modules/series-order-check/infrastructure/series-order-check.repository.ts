import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const READING_STATUSES_IN_PLAY = ["reading", "rereading"];

const relevantSeriesBookSelect = {
  coverMedia: true,
  coverMediaId: true,
  createdAt: true,
  id: true,
  ownershipStatus: true,
  partNumber: true,
  queuePosition: true,
  readingStatus: true,
  series: { select: { id: true, name: true } },
  seriesId: true,
  title: true,
} satisfies Prisma.BookSelect;

export type QueueSignatureEntry = {
  id: string;
  queuePosition: number;
};

export type RelevantSeriesBook = Prisma.BookGetPayload<{ select: typeof relevantSeriesBookSelect }>;

@Injectable()
export class SeriesOrderCheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDisabledSeriesIds(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.seriesOrderDisabledSeries.findMany({
      select: { seriesId: true },
      where: { userId },
    });
    return rows.map((row) => row.seriesId);
  }

  async listIgnoredFingerprints(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.seriesOrderIgnoredIssue.findMany({
      select: { fingerprint: true },
      where: { userId },
    });
    return rows.map((row) => row.fingerprint);
  }

  async loadQueueSignature(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<QueueSignatureEntry[]> {
    const rows = await client.book.findMany({
      orderBy: { queuePosition: "asc" },
      select: { id: true, queuePosition: true },
      where: { queuePosition: { not: null }, userId },
    });

    return rows.flatMap((row) =>
      row.queuePosition === null ? [] : [{ id: row.id, queuePosition: row.queuePosition }],
    );
  }

  async loadRelevantSeries(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<RelevantSeriesBook[]> {
    const seriesIdRows = await client.book.findMany({
      distinct: ["seriesId"],
      select: { seriesId: true },
      where: {
        OR: [{ queuePosition: { not: null } }, { readingStatus: { in: READING_STATUSES_IN_PLAY } }],
        seriesId: { not: null },
        userId,
      },
    });

    const seriesIds = seriesIdRows.flatMap((row) => (row.seriesId === null ? [] : [row.seriesId]));
    if (seriesIds.length === 0) {
      return [];
    }

    return client.book.findMany({
      select: relevantSeriesBookSelect,
      where: { seriesId: { in: seriesIds }, userId },
    });
  }
}
