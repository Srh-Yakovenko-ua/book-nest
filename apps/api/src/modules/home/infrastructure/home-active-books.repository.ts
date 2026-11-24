import type { HomeActiveReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { READING_CYCLE_STATE } from "../../books/index.js";

const ACTIVE_READING_STATUSES: HomeActiveReadingStatus[] = ["reading", "rereading"];

const ActiveBookKeyRowSchema = z.object({
  cycleStartedAt: z.date().nullable(),
  id: z.string(),
  lastProgressAt: z.date().nullable(),
  title: z.string(),
});

export type ActiveBookKeyRow = z.infer<typeof ActiveBookKeyRowSchema>;

@Injectable()
export class HomeActiveBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBookKeys(userId: string): Promise<ActiveBookKeyRow[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        book.id AS "id",
        book.title AS "title",
        cycle.started_at AS "cycleStartedAt",
        (
          SELECT max(event.date)
          FROM book_reading_progress_events event
          WHERE event.reading_cycle_id = cycle.id
        ) AS "lastProgressAt"
      FROM books book
      LEFT JOIN book_reading_cycles cycle
        ON cycle.book_id = book.id
        AND cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.active}
      WHERE book.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
        AND book.reading_status = ANY(${ACTIVE_READING_STATUSES}::text[])
    `;

    return z.array(ActiveBookKeyRowSchema).parse(rows);
  }
}
