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
  purgeAt: z.date(),
  title: z.string(),
});

const TrashCountRowSchema = z.object({
  count: z.bigint(),
  entityType: TrashEntityTypeSchema,
});

const TotalCountRowSchema = z.object({ count: z.bigint() });

export type TrashCountRow = { count: number; entityType: TrashEntityType };

export type TrashRow = z.infer<typeof TrashRowSchema>;

@Injectable()
export class TrashRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count({
    entityType,
    userId,
  }: {
    entityType: TrashEntityType | undefined;
    userId: string;
  }): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT count(*) AS count
      FROM (${trashUnion({ entityType, userId })}) AS trash
    `);
    return Number(z.array(TotalCountRowSchema).parse(rows).at(0)?.count ?? 0);
  }

  async countByType({ userId }: { userId: string }): Promise<TrashCountRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT "entityType", count(*) AS count
      FROM (${trashUnion({ entityType: undefined, userId })}) AS trash
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
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT "entityType", "id", "title", "context", "deletedAt", "purgeAt"
      FROM (${trashUnion({ entityType, userId })}) AS trash
      ORDER BY "deletedAt" DESC, "id" ASC
      LIMIT ${take} OFFSET ${skip}
    `);
    return z.array(TrashRowSchema).parse(rows);
  }
}

function trashUnion({
  entityType,
  userId,
}: {
  entityType: TrashEntityType | undefined;
  userId: string;
}): Prisma.Sql {
  const sources = {
    book: Prisma.sql`
      SELECT b.id::text AS "id", b.title AS "title",
             NULLIF(b.first_author_name, '') AS "context", b.deleted_at AS "deletedAt",
             b.purge_at AS "purgeAt"
      FROM books b
      WHERE b.user_id = ${userId}::uuid AND b.deleted_at IS NOT NULL
    `,
    book_list: Prisma.sql`
      SELECT l.id::text AS "id", l.name AS "title",
             NULL::text AS "context", l.deleted_at AS "deletedAt",
             l.purge_at AS "purgeAt"
      FROM book_lists l
      WHERE l.user_id = ${userId}::uuid AND l.deleted_at IS NOT NULL
    `,
    character: Prisma.sql`
      SELECT c.id::text AS "id", c.name AS "title",
             NULL::text AS "context", c.deleted_at AS "deletedAt",
             c.purge_at AS "purgeAt"
      FROM characters c
      WHERE c.user_id = ${userId}::uuid AND c.deleted_at IS NOT NULL
    `,
    note: Prisma.sql`
      SELECT n.id::text AS "id", n.text AS "title",
             COALESCE(nb.title, ns.name) AS "context", n.deleted_at AS "deletedAt",
             n.purge_at AS "purgeAt"
      FROM notes n
      LEFT JOIN books nb ON nb.id = n.book_id
      LEFT JOIN series ns ON ns.id = n.series_id
      WHERE n.user_id = ${userId}::uuid AND n.deleted_at IS NOT NULL
        AND (n.book_id IS NULL OR nb.deleted_at IS NULL)
        AND (n.series_id IS NULL OR ns.deleted_at IS NULL)
    `,
    quote: Prisma.sql`
      SELECT q.id::text AS "id", q.text AS "title",
             qb.title AS "context", q.deleted_at AS "deletedAt",
             q.purge_at AS "purgeAt"
      FROM quotes q
      JOIN books qb ON qb.id = q.book_id
      WHERE q.user_id = ${userId}::uuid AND q.deleted_at IS NOT NULL
        AND qb.deleted_at IS NULL
    `,
    series: Prisma.sql`
      SELECT s.id::text AS "id", s.name AS "title",
             NULL::text AS "context", s.deleted_at AS "deletedAt",
             s.purge_at AS "purgeAt"
      FROM series s
      WHERE s.user_id = ${userId}::uuid AND s.deleted_at IS NOT NULL
    `,
    timeline: Prisma.sql`
      SELECT t.id::text AS "id", t.name AS "title",
             tb.title AS "context", t.deleted_at AS "deletedAt",
             t.purge_at AS "purgeAt"
      FROM book_timelines t
      JOIN books tb ON tb.id = t.book_id
      WHERE tb.user_id = ${userId}::uuid AND t.deleted_at IS NOT NULL
        AND tb.deleted_at IS NULL
    `,
  } satisfies Record<TrashEntityType, Prisma.Sql>;

  const arms = Object.entries(sources)
    .filter(([name]) => entityType === undefined || name === entityType)
    .map(
      ([name, source]) => Prisma.sql`SELECT ${name}::text AS "entityType", tagged.*
       FROM (${source}) AS tagged`,
    );
  return Prisma.join(arms, "\nUNION ALL\n");
}
