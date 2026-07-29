import type { TrashEntityType } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

const TrashRowSchema = z.object({
  context: z.string().nullable(),
  deletedAt: z.date(),
  entityType: z.string(),
  id: z.string(),
  title: z.string(),
});

const TrashCountRowSchema = z.object({
  count: z.bigint(),
  entityType: z.string(),
});

export type TrashCountRow = { count: number; entityType: string };

export type TrashRow = z.infer<typeof TrashRowSchema>;

@Injectable()
export class TrashRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countByType({ userId }: { userId: string }): Promise<TrashCountRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT "entityType", count(*) AS count
      FROM (${trashUnion(userId)}) AS trash
      GROUP BY "entityType"
    `);
    return z
      .array(TrashCountRowSchema)
      .parse(rows)
      .map((row) => ({ count: Number(row.count), entityType: row.entityType }));
  }

  async list({
    entityType,
    skip,
    take,
    userId,
  }: {
    entityType: TrashEntityType | undefined;
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashRow[]> {
    const typeFilter =
      entityType === undefined ? Prisma.empty : Prisma.sql`WHERE "entityType" = ${entityType}`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT "entityType", "id", "title", "context", "deletedAt"
      FROM (${trashUnion(userId)}) AS trash
      ${typeFilter}
      ORDER BY "deletedAt" DESC, "id" ASC
      LIMIT ${take} OFFSET ${skip}
    `);
    return z.array(TrashRowSchema).parse(rows);
  }
}

function trashUnion(userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT 'book' AS "entityType", b.id::text AS "id", b.title AS "title",
           NULLIF(b.first_author_name, '') AS "context", b.deleted_at AS "deletedAt"
    FROM books b
    WHERE b.user_id = ${userId}::uuid AND b.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'series', s.id::text, s.name, NULL, s.deleted_at
    FROM series s
    WHERE s.user_id = ${userId}::uuid AND s.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'book_list', l.id::text, l.name, NULL, l.deleted_at
    FROM book_lists l
    WHERE l.user_id = ${userId}::uuid AND l.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'quote', q.id::text, q.text, qb.title, q.deleted_at
    FROM quotes q
    JOIN books qb ON qb.id = q.book_id
    WHERE q.user_id = ${userId}::uuid AND q.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'note', n.id::text, n.text, COALESCE(nb.title, ns.name), n.deleted_at
    FROM notes n
    LEFT JOIN books nb ON nb.id = n.book_id
    LEFT JOIN series ns ON ns.id = n.series_id
    WHERE n.user_id = ${userId}::uuid AND n.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'timeline', t.id::text, t.name, tb.title, t.deleted_at
    FROM book_timelines t
    JOIN books tb ON tb.id = t.book_id
    WHERE tb.user_id = ${userId}::uuid AND t.deleted_at IS NOT NULL

    UNION ALL
    SELECT 'character', c.id::text, c.name, NULL, c.deleted_at
    FROM characters c
    WHERE c.user_id = ${userId}::uuid AND c.deleted_at IS NOT NULL
  `;
}
