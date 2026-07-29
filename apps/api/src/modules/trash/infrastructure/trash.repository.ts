import type { TrashEntityType } from "@app/shared";

import { TrashEntityTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

const TrashRowSchema = z.object({
  context: z.string().nullable(),
  deletedAt: z.date(),
  entityType: TrashEntityTypeSchema,
  id: z.string(),
  title: z.string(),
});

const TrashCountRowSchema = z.object({
  count: z.bigint(),
  entityType: TrashEntityTypeSchema,
});

export type TrashCountRow = { count: number; entityType: TrashEntityType };

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
  const sources = {
    book: Prisma.sql`
      SELECT b.id::text AS "id", b.title AS "title",
             NULLIF(b.first_author_name, '') AS "context", b.deleted_at AS "deletedAt"
      FROM books b
      WHERE b.user_id = ${userId}::uuid AND b.deleted_at IS NOT NULL
    `,
    book_list: Prisma.sql`
      SELECT l.id::text, l.name, NULL, l.deleted_at
      FROM book_lists l
      WHERE l.user_id = ${userId}::uuid AND l.deleted_at IS NOT NULL
    `,
    character: Prisma.sql`
      SELECT c.id::text, c.name, NULL, c.deleted_at
      FROM characters c
      WHERE c.user_id = ${userId}::uuid AND c.deleted_at IS NOT NULL
    `,
    note: Prisma.sql`
      SELECT n.id::text, n.text, COALESCE(nb.title, ns.name), n.deleted_at
      FROM notes n
      LEFT JOIN books nb ON nb.id = n.book_id
      LEFT JOIN series ns ON ns.id = n.series_id
      WHERE n.user_id = ${userId}::uuid AND n.deleted_at IS NOT NULL
        AND (n.book_id IS NULL OR nb.deleted_at IS NULL)
        AND (n.series_id IS NULL OR ns.deleted_at IS NULL)
    `,
    quote: Prisma.sql`
      SELECT q.id::text, q.text, qb.title, q.deleted_at
      FROM quotes q
      JOIN books qb ON qb.id = q.book_id
      WHERE q.user_id = ${userId}::uuid AND q.deleted_at IS NOT NULL
        AND qb.deleted_at IS NULL
    `,
    series: Prisma.sql`
      SELECT s.id::text, s.name, NULL, s.deleted_at
      FROM series s
      WHERE s.user_id = ${userId}::uuid AND s.deleted_at IS NOT NULL
    `,
    timeline: Prisma.sql`
      SELECT t.id::text, t.name, tb.title, t.deleted_at
      FROM book_timelines t
      JOIN books tb ON tb.id = t.book_id
      WHERE tb.user_id = ${userId}::uuid AND t.deleted_at IS NOT NULL
        AND tb.deleted_at IS NULL
    `,
  } satisfies Record<TrashEntityType, Prisma.Sql>;

  const arms = Object.entries(sources).map(
    ([entityType, source]) => Prisma.sql`SELECT ${entityType}::text AS "entityType", tagged.*
       FROM (${source}) AS tagged`,
  );
  return Prisma.join(arms, "\nUNION ALL\n");
}
