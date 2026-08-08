import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";

const log = createLogger("list-facets.repository");

export const LIST_FACETS = {
  maxRows: 200,
} as const;

const AuthorFacetRowSchema = z.object({
  count: z.number(),
  id: z.string(),
  name: z.string(),
});

const GenreFacetRowSchema = z.object({
  count: z.number(),
  key: z.string(),
});

export type AuthorFacetRow = z.infer<typeof AuthorFacetRowSchema>;

export type GenreFacetRow = z.infer<typeof GenreFacetRowSchema>;

type ListFacetsInput = {
  listId: string;
  userId: string;
};

@Injectable()
export class ListFacetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async authorFacets({ listId, userId }: ListFacetsInput): Promise<AuthorFacetRow[]> {
    const result = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        a.id::text AS "id",
        a.name AS "name",
        count(*)::int AS "count"
      FROM book_list_items i
      JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
      JOIN book_authors ba ON ba.book_id = b.id
      JOIN authors a ON a.id = ba.author_id
      WHERE i.list_id = ${listId}::uuid AND b.user_id = ${userId}::uuid
      GROUP BY a.id, a.name
      ORDER BY count(*) DESC, a.name ASC
      LIMIT ${LIST_FACETS.maxRows}
    `);
    const rows = z.array(AuthorFacetRowSchema).parse(result);
    if (rows.length === LIST_FACETS.maxRows) {
      log.warn({ cap: LIST_FACETS.maxRows, listId, userId }, "author facets truncated at the cap");
    }
    return rows;
  }

  async genreFacets({ listId, userId }: ListFacetsInput): Promise<GenreFacetRow[]> {
    const result = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        g.key AS "key",
        count(*)::int AS "count"
      FROM book_list_items i
      JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
      CROSS JOIN LATERAL unnest(b.genres) AS g(key)
      WHERE i.list_id = ${listId}::uuid AND b.user_id = ${userId}::uuid
      GROUP BY g.key
      ORDER BY count(*) DESC, g.key ASC
      LIMIT ${LIST_FACETS.maxRows}
    `);
    const rows = z.array(GenreFacetRowSchema).parse(result);
    if (rows.length === LIST_FACETS.maxRows) {
      log.warn({ cap: LIST_FACETS.maxRows, listId, userId }, "genre facets truncated at the cap");
    }
    return rows;
  }
}
